const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({

  mobile: {
    type: String,
    required: true,
  },

  amount: {
    type: Number,
    required: true,
  },

 status: {
  type: String,
  default: "Pending",
},
  transactionId: {
    type: String,
    required: true,
  },

  merchantOrderId: {
  type: String,
},

  createdAt: {
    type: Date,
    default: Date.now,
  },

});

module.exports =
  mongoose.model(
    "Payment",
    paymentSchema
  );