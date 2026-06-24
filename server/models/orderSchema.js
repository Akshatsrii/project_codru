const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    orderId: { type: String, required: true, unique: true }, // e.g., ORDER_169...
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    planId: { type: String, required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['PENDING', 'SUCCESS', 'FAILED'], default: 'PENDING' },
    phonepeTransactionId: { type: String }, // Populated by the webhook later
    
    // Snapshot of user details at the exact time of purchase
    studentName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    whatsapp: { type: String } 
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);