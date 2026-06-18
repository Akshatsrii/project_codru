require("dotenv").config();

const {
  StandardCheckoutClient,
  Env,
  CreateSdkOrderRequest,
  StandardCheckoutPayRequest,
  MetaInfo
} = require("phonepe-pg-sdk-node");
console.log(
  "CreateSdkOrderRequest methods:",
  Object.keys(CreateSdkOrderRequest)
);

console.log(
  "StandardCheckoutPayRequest methods:",
  Object.keys(StandardCheckoutPayRequest)
);


const phonepeClient = StandardCheckoutClient.getInstance(
  process.env.PHONEPE_CLIENT_ID,
  process.env.PHONEPE_CLIENT_SECRET,
  Number(process.env.PHONEPE_CLIENT_VERSION),
  Env.SANDBOX
);
console.log(
  "StandardCheckoutPayRequest:",
  StandardCheckoutPayRequest
);

console.log(
  "PAY REQUEST KEYS:",
  Object.keys(StandardCheckoutPayRequest)
);
console.log(StandardCheckoutPayRequest.toString());
console.log(
  "PAY METHOD:",
  phonepeClient.pay
);
console.log("PHONEPE CLIENT METHODS:");
console.log(Object.getOwnPropertyNames(
  Object.getPrototypeOf(phonepeClient)
));
console.log(
  "CLIENT OBJECT:",
  phonepeClient
);

console.log("Client ID:", process.env.PHONEPE_CLIENT_ID);
console.log("Client Version:", process.env.PHONEPE_CLIENT_VERSION);
console.log("ENV:", process.env.PHONEPE_ENV);

const express = require("express");

const router = express.Router();

const Payment =
  require("../models/paymentSchema");


// ==========================
// CREATE PAYMENT
// ==========================

router.post("/pay", async (req, res) => {

  console.log("PAY ROUTE STARTED");

  

  try {

    const { mobile } = req.body;

    console.log("Mobile:", mobile);

    const transactionId =
      "TXN" + Date.now();
      console.log("PHONEPE TEST START");
      console.log("BEFORE MONGODB SAVE");

    // const newPayment =
    //   new Payment({

    //     mobile,
    //     amount: 999,
    //     status: "Success",
    //     transactionId,

    //   });

    // // SAVE DATA
    // const savedPayment =
    //   await newPayment.save();
    //   console.log("AFTER MONGODB SAVE");

    // console.log(
    //   "Saved Payment:",
    //   savedPayment
    // );


    const merchantOrderId =
  "ORDER_" + Date.now();

console.log(
  "Merchant Order Id:",
  merchantOrderId
);
const newPayment =
  new Payment({

    mobile,
    amount: 999,
    status: "Pending",
    transactionId,
    merchantOrderId,

  });

await newPayment.save();

console.log(
  "Payment Saved As Pending"
);
const payRequest =
  StandardCheckoutPayRequest
    .builder()
    .merchantOrderId(merchantOrderId)
    .amount(99900)
    .redirectUrl(
  "http://localhost:5173/payment-success"
)
    .message("Codru Premium Plan")
    .build();

console.log("PAY REQUEST:");
console.dir(payRequest, { depth: null });

const response =
  await phonepeClient.pay(
    payRequest
  );
  console.log("ORDER ID:", response.orderId);
console.log("REDIRECT URL:", response.redirectUrl);
console.log("FULL RESPONSE:", response);
  console.log("PAY METHOD CODE:");
console.log(phonepeClient.pay.toString());
  console.log("FULL RESPONSE:");
console.dir(response, { depth: null });

console.log(
  JSON.stringify(response, null, 2)
);
console.log("FULL RESPONSE:");
console.dir(response, { depth: null });
console.log("RESPONSE KEYS:", Object.keys(response));
console.log("REDIRECT URL:", response.redirectUrl);

 res.status(200).json({

  success: true,

  redirectUrl: response.redirectUrl,

  orderId: response.orderId,

});

  } catch (error) {

    console.log(
      "Payment Error:",
      error
    );

    res.status(500).json({

      success: false,

      message:
        "Payment Failed",

    });

  }

});

router.get("/status/:orderId", async (req, res) => {

  try {

    const { orderId } = req.params;

    const statusResponse =
      await phonepeClient.getOrderStatus(
        orderId
      );

    console.log(
      "STATUS RESPONSE:",
      statusResponse
    );
    console.dir(
  statusResponse,
  { depth: null }
);

    const payment =
  await Payment.findOne({
    merchantOrderId: orderId
  });

if (payment) {

  if (
    statusResponse.state ===
    "COMPLETED"
  ) {

    payment.status =
      "Success";

  }

  else if (
    statusResponse.state ===
    "FAILED"
  ) {

    payment.status =
      "Failed";

  }

  await payment.save();

}

    res.json(statusResponse);

  } catch (error) {

    console.log(error);

    res.status(500).json({
      success: false,
      message: "Status Check Failed"
    });

  }

});
// ==========================
// GET ALL PAYMENTS
// ==========================

router.get(
  "/all-payments",
  async (req, res) => {

    try {

      const payments =
        await Payment.find()
        .sort({ createdAt: -1 });

      res.status(200).json({

        success: true,
        payments,

      });

    } catch (error) {

      console.log(error);

      res.status(500).json({

        success: false,

        message:
          "Failed to fetch payments",

      });

    }

  }
);

router.post("/webhook", async (req, res) => {

  console.log("WEBHOOK RECEIVED");
  console.log(req.body);

  res.status(200).send("OK");

});
module.exports = router;