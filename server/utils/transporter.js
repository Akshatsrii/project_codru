// utils/transporter.js (On your Render Backend)
const axios = require('axios');

const transporter = {
  // We recreate the exact Nodemailer sendMail function signature
  sendMail: async (mailOptions, callback) => {
    try {
      // Secretly forward the mailOptions to Vercel
      const response = await axios.post('https://mail.curiousteamlearning.com/api/send', {
        mailOptions: mailOptions
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.MICROSERVICE_SECRET}`
        },
        // 🚨 CRITICAL AXIOS 1.16+ FIX: 
        // These MUST be root-level properties here, NOT inside the headers block!
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      });

      // If your old code uses a callback (error, info) => {...}
      if (callback) {
        callback(null, { response: "250 OK (Delivered via Vercel Microservice)" });
      }
      
      // If your old code uses 'await transporter.sendMail(...)'
      return { response: "250 OK (Delivered via Vercel Microservice)" };

    } catch (error) {
      console.error("❌ Fake Transporter Error:", error.message);
      
      // Pass the error back to your old code exactly how Nodemailer would
      if (callback) {
        callback(error, null);
      } else {
        throw error;
      }
    }
  }
};

module.exports = transporter;