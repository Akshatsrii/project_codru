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

    // 2. GUEST CHECKOUT / USER RESOLUTION LOGIC
    let actualUserId = userId;
    let userDoc = null;

    if (!actualUserId && email) {
      userDoc = await User.findOne({ email: email.toLowerCase() });
      if (userDoc) {
        actualUserId = userDoc._id; 
      }
    }

    // CREATE A NEW USER IF NEEDED
    if (!actualUserId) {
      const baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const generatedUsername = `${baseUsername}${randomSuffix}`;
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
// 3. WEBHOOK (Server-to-Server callback)
// ==========================
router.post("/webhook", async (req, res) => {
  try {
    console.log("WEBHOOK RECEIVED");
    console.log("PHONEPE RAW WEBHOOK BODY:", JSON.stringify(req.body, null, 2));
    
    const payloadBase64 = req.body.response; 
    let payload;

    if (payloadBase64) {
        // Decode the base64 payload from PhonePe
        const decodedPayload = Buffer.from(payloadBase64, 'base64').toString('utf-8');
        payload = JSON.parse(decodedPayload).data || JSON.parse(decodedPayload).payload;
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
        
        // 🚨 MAXIMUM DETAIL EXTRACTION 🚨
        order.phonepeOrderId = payload.orderId || "N/A";
        
        const pDetails = payload.paymentDetails && payload.paymentDetails.length > 0 ? payload.paymentDetails[0] : {};
        order.paymentMode = pDetails.paymentMode || "UNKNOWN";
        order.phonepeTransactionId = pDetails.transactionId || payload.transactionId || "N/A";

        const splitInst = pDetails.splitInstruments && pDetails.splitInstruments.length > 0 ? pDetails.splitInstruments[0] : {};
        const rail = splitInst.rail || {};
        const instrument = splitInst.instrument || {};

        order.paymentInstrumentType = rail.type || instrument.type || "UNKNOWN";
        
        // Grab the extra details
        order.vpa = rail.vpa !== "<vpa>" ? rail.vpa : "N/A";
        order.accountType = instrument.accountType || "N/A";
        order.ifsc = instrument.ifsc || "N/A";

        // Sandbox clean-up for UTR
        let extractedUtr = rail.utr || rail.bankTransactionId || instrument.bankTransactionId || "N/A";
        if (extractedUtr === "<utr>") extractedUtr = order.phonepeTransactionId; // Replace fake string with PhonePe ID
        order.bankReference = extractedUtr;

        // Grant access
        await User.findByIdAndUpdate(order.userId, {
            $addToSet: { activePlans: order.planId }
        });
        
        console.log(`Order ${order.orderId} successfully captured with mode: ${order.paymentMode}`);
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
  console.log("STATUS CHECK ORDER ID:", req.params.orderId);

  try {
    const { orderId } = req.params;

    // Call PhonePe to get the absolute truth of the transaction
    const statusResponse = await phonepeClient.getOrderStatus(orderId);
    console.log("PHONEPE RAW STATUS:", JSON.stringify(statusResponse, null, 2));

    const order = await Order.findOne({ orderId: orderId });

    if (order) {
      if (statusResponse.state === "COMPLETED") {
        order.status = "SUCCESS";
        
        // 🚨 MAXIMUM DETAIL EXTRACTION 🚨
        const dataObj = statusResponse.data || statusResponse || {};
        if (!order.phonepeOrderId) order.phonepeOrderId = dataObj.orderId || "N/A";

        const pDetails = dataObj.paymentDetails && dataObj.paymentDetails.length > 0 ? dataObj.paymentDetails[0] : {};
        const splitInst = pDetails.splitInstruments && pDetails.splitInstruments.length > 0 ? pDetails.splitInstruments[0] : {};
        const rail = splitInst.rail || {};
        const instrument = splitInst.instrument || dataObj.paymentInstrument || {};

        if (!order.phonepeTransactionId || order.phonepeTransactionId === "N/A") {
            order.phonepeTransactionId = pDetails.transactionId || dataObj.transactionId || "N/A";
        }
        if (!order.paymentMode || order.paymentMode === "UNKNOWN") {
            order.paymentMode = pDetails.paymentMode || instrument.type || "UNKNOWN";
        }
        if (!order.paymentInstrumentType || order.paymentInstrumentType === "UNKNOWN") {
            order.paymentInstrumentType = rail.type || instrument.type || "UNKNOWN";
        }
        
        // Extra details
        if (!order.vpa || order.vpa === "N/A") order.vpa = rail.vpa !== "<vpa>" ? rail.vpa : "N/A";
        if (!order.accountType || order.accountType === "N/A") order.accountType = instrument.accountType || "N/A";
        if (!order.ifsc || order.ifsc === "N/A") order.ifsc = instrument.ifsc || "N/A";

        if (!order.bankReference || order.bankReference === "N/A") {
            let extractedUtr = rail.utr || rail.bankTransactionId || instrument.utr || instrument.bankTransactionId || instrument.pgTransactionId || order.phonepeTransactionId;
            if (extractedUtr === "<utr>") extractedUtr = order.phonepeTransactionId;
            order.bankReference = extractedUtr;
        }

        // Grant access (in case webhook was delayed)
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
// 5. GET ALL PAYMENTS (Admin Dashboard)
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

module.exports = router;