require("dotenv").config();
const express = require("express");
const router = express.Router();

const User = require("../models/userSchema");
const Plan = require("../models/planSchema");
const Order = require("../models/orderSchema");

const {
  StandardCheckoutClient,
  Env,
  StandardCheckoutPayRequest
} = require("phonepe-pg-sdk-node");

// Initialize PhonePe Client
const phonepeClient = StandardCheckoutClient.getInstance(
  process.env.PHONEPE_CLIENT_ID,
  process.env.PHONEPE_CLIENT_SECRET,
  Number(process.env.PHONEPE_CLIENT_VERSION),
  process.env.PHONEPE_ENV === 'PROD' ? Env.PRODUCTION : Env.SANDBOX
);

// ==========================
// 1. GET ACTIVE PLANS (For React Dropdown)
// ==========================
router.get("/active-plans", async (req, res) => {
  try {
    const activePlans = await Plan.find({ isActive: true });
    res.status(200).json({ success: true, plans: activePlans });
  } catch (error) {
    console.error("Fetch Plans Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch plans" });
  }
});

// ==========================
// 2. CREATE PAYMENT ORDER (Called by React /enrol)
// ==========================
router.post("/create-order", async (req, res) => {
  console.log("CREATE ORDER ROUTE STARTED");

  try {
    const { userId, planId, studentName, email, phone, whatsapp } = req.body;

    // 1. Fetch the real price from DB
    const plan = await Plan.findOne({ planId: planId, isActive: true });
    
    if (!plan) {
      return res.status(400).json({ success: false, message: "Invalid or inactive plan selected." });
    }

    // 2. 🚨 GUEST CHECKOUT / USER RESOLUTION LOGIC 🚨
    let actualUserId = userId;
    let userDoc = null;

    // If no userId was sent from React, check if the email exists
    if (!actualUserId && email) {
      userDoc = await User.findOne({ email: email.toLowerCase() });
      if (userDoc) {
        actualUserId = userDoc._id; // Attach to existing user
      }
    }

    // If still no user found, CREATE A NEW ONE
    if (!actualUserId) {
      // Generate a unique username (e.g., "johndoe8492")
      const baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const generatedUsername = `${baseUsername}${randomSuffix}`;

      // Generate a random temporary password
      const tempPassword = Math.random().toString(36).slice(-8) + "A1!";

      const newUser = new User({
        name: studentName,
        username: generatedUsername,
        email: email.toLowerCase(),
        password: tempPassword, 
        phone: phone,
        altPhone: whatsapp !== phone ? whatsapp : "", 
        role: "student",
      });

      await newUser.save();
      actualUserId = newUser._id;
      console.log(`New user created silently: ${generatedUsername}`);
    }

    const merchantOrderId = "ORDER_" + Date.now();

    // 3. Save Pending Order to MongoDB
    const newOrder = new Order({
      orderId: merchantOrderId,
      userId: actualUserId, 
      planId: plan.planId,
      amount: plan.price,
      studentName: studentName, 
      email: email,             
      phone: phone,             
      whatsapp: whatsapp,       
      status: "PENDING"
    });

    await newOrder.save();
    console.log("Order Saved As Pending for User:", actualUserId);

    // 4. Build PhonePe SDK Request
    const payRequest = StandardCheckoutPayRequest.builder()
      .merchantOrderId(merchantOrderId)
      .amount(plan.price * 100) // PhonePe expects Paise
      .redirectUrl(`${process.env.FRONTEND_URL}/payment-status?id=${merchantOrderId}`)
      .message(`Enrollment: ${plan.name}`)
      .build();

    // 5. Trigger PhonePe
    const response = await phonepeClient.pay(payRequest);

    res.status(200).json({
      success: true,
      redirectUrl: response.redirectUrl,
      orderId: merchantOrderId
    });

  } catch (error) {
    console.log("Payment Error:", error);
    res.status(500).json({ success: false, message: "Payment Initialization Failed" });
  }
});

// ==========================
// 3. WEBHOOK (Server-to-Server callback) 🚨 RESTORED 🚨
// ==========================
router.post("/webhook", async (req, res) => {
  try {
    console.log("WEBHOOK RECEIVED");
    
    // Depending on PhonePe's exact SDK response, the payload might be in req.body.response or req.body.payload
    const payloadBase64 = req.body.response; 
    let payload;

    if (payloadBase64) {
        // Decode the base64 payload from PhonePe
        const decodedPayload = Buffer.from(payloadBase64, 'base64').toString('utf-8');
        payload = JSON.parse(decodedPayload).data;
    } else {
        payload = req.body.payload || req.body;
    }

    if (!payload || !payload.merchantOrderId) {
        return res.status(400).send("Invalid Payload");
    }

    // Find the Order in our DB
    const order = await Order.findOne({ orderId: payload.merchantOrderId });

    if (order) {
      if (payload.state === "COMPLETED" || payload.code === "PAYMENT_SUCCESS") {
        order.status = "SUCCESS";
        
        // 🚨 NEW: Smart Extraction
        const inst = payload.paymentInstrument || {};
        
        // Grab PhonePe's ID
        order.phonepeTransactionId = payload.transactionId || "N/A"; 
        
        // Grab the Bank ID (Checks for UPI 'utr' first!)
        order.bankReference = inst.utr || inst.bankTransactionId || inst.pgTransactionId || "N/A";

        // Grant access
        await User.findByIdAndUpdate(order.userId, {
            $addToSet: { activePlans: order.planId }
        });
        console.log(`Course ${order.planId} granted to User ${order.userId}`);

      } else {
        order.status = "FAILED";
      }

      await order.save();
      console.log(`Order ${order.orderId} Updated to: ${order.status}`);
    } else {
      console.log("Order Not Found in DB:", payload.merchantOrderId);
    }

    // ALWAYS return 200 OK to PhonePe so they stop retrying the webhook
    res.status(200).send("OK");

  } catch (error) {
    console.log("Webhook Error:", error);
    res.status(500).send("Webhook Processing Error");
  }
});

// ==========================
// 4. CHECK STATUS (For the Payment Success Page)
// ==========================
router.get("/status/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    const statusResponse = await phonepeClient.getOrderStatus(orderId);
    const order = await Order.findOne({ orderId: orderId });

    if (order) {
      // 🚨 NEW LOGIC: Always aggressively grab the ID if we don't have it yet!
      const actualTxnId = 
        statusResponse.transactionId || 
        (statusResponse.data && statusResponse.data.transactionId) || 
        "TXN_NOT_PROVIDED";

      if (statusResponse.state === "COMPLETED") {
        order.status = "SUCCESS";
        
        // 🚨 NEW: Smart Extraction for the SDK response
        const dataObj = statusResponse.data || statusResponse || {};
        const inst = dataObj.paymentInstrument || {};

        if (!order.phonepeTransactionId || order.phonepeTransactionId === "N/A" || order.phonepeTransactionId === "TXN_NOT_PROVIDED") {
            order.phonepeTransactionId = dataObj.transactionId || "N/A";
        }
        
        if (!order.bankReference || order.bankReference === "N/A") {
            order.bankReference = inst.utr || inst.bankTransactionId || inst.pgTransactionId || "N/A";
        }

        await User.findByIdAndUpdate(order.userId, {
            $addToSet: { activePlans: order.planId }
        });

        await order.save();
      } else if (statusResponse.state === "FAILED") {
        order.status = "FAILED";
        await order.save();
      }
    }

    res.json({
        success: true, 
        state: statusResponse.state, 
        order: order 
    });

  } catch (error) {
    console.log("Status Check Error:", error);
    res.status(500).json({ success: false, message: "Status Check Failed" });
  }
});

// ==========================
// 5. GET ALL PAYMENTS (Admin Dashboard) 🚨 RESTORED 🚨
// ==========================
router.get("/all-payments", async (req, res) => {
  try {
    const payments = await Order.find().sort({ createdAt: -1 }).populate('userId', 'name email');
    res.status(200).json({ success: true, payments });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Failed to fetch payments" });
  }
});

// ==========================
// TEMPORARY ROUTE: SEED PLANS (Commented out for safety)
// ==========================
// router.get("/seed-plans", async (req, res) => {
//   try {
//     const plansToSeed = [
//       {
//         planId: "learning-exploration",
//         name: "Learning Exploration",
//         description: "Explore our Tools & Community",
//         billingCycle: "MONTHLY",
//         price: 0,
//         originalPrice: 0,
//         features: [
//           "Access to CuTe Tools & Community",
//           "5 Days Demo of 1 on 1 classes"
//         ],
//         isActive: true,
//         tag: null
//       },
//       {
//         planId: "doubt-session",
//         name: "Doubt Session",
//         description: "Topic-specific Support",
//         billingCycle: "ONE_TIME", // Because it is per class
//         price: 500,
//         originalPrice: 900,
//         features: [
//           "Access to CuTe Tools & Community",
//           "1 on 1 class (1 hour class)"
//         ],
//         isActive: true,
//         tag: null
//       },
//       {
//         planId: "self-study-support-monthly",
//         name: "Self Study Support",
//         description: "Small Group Focus",
//         billingCycle: "MONTHLY",
//         price: 3500,
//         originalPrice: 5000,
//         features: [
//           "Access to CuTe Tools & Community",
//           "Class of 5 students (Max)",
//           "Mentorship & Guidance",
//           "Collaborative Learning"
//         ],
//         isActive: true,
//         tag: null
//       },
//       {
//         planId: "subject-mastery-monthly",
//         name: "Subject Mastery",
//         description: "Deep Focus on 1 Area",
//         billingCycle: "MONTHLY",
//         price: 10000,
//         originalPrice: 18000,
//         features: [
//           "Access to CuTe Tools & Community",
//           "1 on 1 class (Upto 1:30 hour)",
//           "Mentorship & Guidance",
//           "Performance Report"
//         ],
//         isActive: true,
//         tag: "Best Seller"
//       },
//       {
//         planId: "homeschooling-bundle-monthly",
//         name: "Complete Homeschooling Bundle",
//         description: "All Subjects + Skills",
//         billingCycle: "MONTHLY",
//         price: 30000,
//         originalPrice: 54000,
//         features: [
//           "Access to CuTe Tools & Community",
//           "1 on 1 class (Up to 3 hours class)",
//           "Multiple Mentors & Experts",
//           "Collaborative Learning",
//           "Overall Performance Report",
//           "Skill Development Courses",
//           "Practical Hands-on Kits"
//         ],
//         isActive: true,
//         tag: "Best Value"
//       }
//     ];

//     // Loop through and upsert (Update if exists, Insert if it doesn't)
//     for (const planData of plansToSeed) {
//       await Plan.findOneAndUpdate(
//         { planId: planData.planId }, // Find by planId
//         { $set: planData },          // Update with these details
//         { upsert: true, new: true }  // Create if missing
//       );
//     }

//     console.log("Database Seeded with Plans!");
//     res.status(200).json({ success: true, message: "Plans successfully loaded into MongoDB!" });

//   } catch (error) {
//     console.error("Seeding Error:", error);
//     res.status(500).json({ success: false, message: "Failed to seed database", error: error.message });
//   }
// });

module.exports = router;