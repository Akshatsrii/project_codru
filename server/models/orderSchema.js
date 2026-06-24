const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    orderId: { type: String, required: true, unique: true }, 
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    planId: { type: String, required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['PENDING', 'SUCCESS', 'FAILED'], default: 'PENDING' },
    
    // Core Transaction IDs
    phonepeOrderId: { type: String },       
    phonepeTransactionId: { type: String }, 
    bankReference: { type: String },        
    
    // 🚨 MAX DETAIL: New Financial Fields 🚨
    paymentMode: { type: String },          // e.g., "UPI_QR"
    paymentInstrumentType: { type: String },// e.g., "UPI", "ACCOUNT"
    vpa: { type: String },                  // UPI ID (e.g., user@ybl)
    accountType: { type: String },          // e.g., "SAVINGS"
    ifsc: { type: String },                 // e.g., "BKID0000508"
    
    // User Snapshot
    studentName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    whatsapp: { type: String } 
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);