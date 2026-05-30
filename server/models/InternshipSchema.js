const mongoose = require('mongoose');

// Prevent OverwriteModelError in serverless environments (like Next.js)
if (mongoose.models.Internship) {
    delete mongoose.models.Internship;
}

const internshipSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true,
        trim: true
    },
    email: { 
        type: String, 
        required: true,
        trim: true,
        lowercase: true
    },
    subject: { 
        type: String, 
        required: true,
        trim: true
    },
    startDate: { 
        type: Date, 
        required: true 
    },
    endDate: { 
        type: Date, 
        required: true 
    },
    resumeUrl: { 
       
        type: String, 
        required: true 
    }
}, { 
    timestamps: true
});

module.exports = mongoose.models.Internship || mongoose.model('Internship', internshipSchema);