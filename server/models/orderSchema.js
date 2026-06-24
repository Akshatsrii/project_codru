const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    orderId: { type: String, required: true, unique: true }, // Your ORDER_178...
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    planId: { type: String, required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['PENDING', 'SUCCESS', 'FAILED'], default: 'PENDING' },
    
    // 🚨 NEW: Upgraded Financial Tracking Fields 🚨
    phonepeOrderId: { type: String },       // Their OMO... ID
    phonepeTransactionId: { type: String }, // Their OM260... ID
    bankReference: { type: String },        // UTR or Bank Txn ID
    paymentMode: { type: String },          // e.g., "UPI_QR", "NETBANKING"
    paymentInstrumentType: { type: String },// e.g., "UPI", "ACCOUNT", "CARD"
    
    // Snapshot of user details
    studentName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    whatsapp: { type: String } 
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);