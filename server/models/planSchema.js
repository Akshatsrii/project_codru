const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
    planId: { type: String, required: true, unique: true }, // e.g., 'doubt-session'
    name: { type: String, required: true },
    description: { type: String },
    billingCycle: { type: String, enum: ['ONE_TIME', 'MONTHLY', 'YEARLY'], default: 'MONTHLY' },
    price: { type: Number, required: true }, // Real price in INR
    originalPrice: { type: Number }, // Crossed-out price
    features: [{ type: String }],
    isActive: { type: Boolean, default: true },
    tag: { type: String } // e.g., 'Best Seller'
}, { timestamps: true });

module.exports = mongoose.model('Plan', planSchema);