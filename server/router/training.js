const express = require("express");
const router = express.Router();
const contact = require("../models/trainingSchema"); // Ensure this path is correct
const dotenv = require("dotenv");
const platformAudit = require("../models/platformAuditSchema");
const cookieParser = require("cookie-parser");
const authenticate = require("../middleware/authenticate"); // Uncomment only if auth is required
const User = require("../models/userSchema");
const multer = require('multer');
const { plantformAuditTemplate } = require("../utils/platformAuditTemplate");
const transporter = require('../utils/transporter'); 
const { bulkEmailTemplate } = require("../utils/bulkEmailTemplate");
const path = require('path');
const fs = require('fs');
const Internship = require("../models/InternshipSchema");

const upload = multer({ storage: multer.memoryStorage() });
router.use(cookieParser());
dotenv.config({ path: "./config.env" });
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const { generateProposalTemplate } = require("../utils/proposalPdfTemplate"); // 🚨 Import your template!

const pdfmake = require('pdfmake');

// 🚨 Setup Fonts ONCE outside the route
const fonts = {
  Roboto: {
    normal: path.join(__dirname, '..', 'public', 'fonts', 'Roboto-Regular.ttf'),
    bold: path.join(__dirname, '..', 'public', 'fonts', 'Roboto-Medium.ttf'),
    italics: path.join(__dirname, '..', 'public', 'fonts', 'Roboto-Italic.ttf'),
    bolditalics: path.join(__dirname, '..', 'public', 'fonts', 'Roboto-MediumItalic.ttf')
  }
};
pdfmake.addFonts(fonts);

// --- MULTER SETUP FOR FILE UPLOADS ---
// This saves the uploaded resumes to a 'uploads/resumes' folder on your server
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/resumes/"); // Ensure this directory exists in your project
  },
  filename: function (req, file, cb) {
    // Creates a unique filename: timestamp-originalName (e.g., 163456789-resume.pdf)
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// Restrict file types to PDF and Word documents
const fileFilter = (req, file, cb) => {
  const allowedTypes = /pdf|doc|docx/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  if (extname) {
    return cb(null, true);
  } else {
    cb(new Error("Only .pdf, .doc, and .docx files are allowed!"));
  }
};

//for user details
router.get("/training", authenticate, async (req, res) => {
      try {
         // Get user ID from authenticated request
        const userId = req.userId; // Ensure this is set in your authenticate middleware
        console.log("User ID:", userId);
        if(!userId) {
          return res.status(400).json({ error: "User ID not found" });
        }
        const user = await User.findOne({ _id: userId });
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }
        // console.log("User details:", user);
        const userDetails = {
          name: user.name,
          username: user.username, 
          email: user.email,
          phone: user.phone,
        };
        res.status(200).json(userDetails);
        // console.log("User details fetched:", user);
      }catch (error) {
        console.error("Error fetching user details:", error);
        return res.status(500).json({ error: "Internal Server Error" });
      }
});


router.post("/training",authenticate, async (req, res) => {
  const username = req.user.username;
  const userEmail = req.user.email;
  const userPhone = req.user.phone; // Get username from authenticated request
  console.log("Authenticated username:", username,userEmail, userPhone);
  try {
    const {
      email,
      name,
      mobile,
      college,
      semester,
      year,
      courseName,
      startDate,
      endDate,
      feedback,
      improvement,
      duration,
    } = req.body;


    // OPTIONAL: Validate required fields
    if (
      !email ||
      !name ||
      !college ||
      !semester ||
      !year ||
      !courseName ||
      !startDate ||
      !endDate ||
      !feedback ||
      !improvement ||
      !duration||
      !mobile
    ) {
      return res.status(400).json({ error: "Please fill all required fields" });
    }

   // OPTIONAL: Use this if you're using authentication middleware
    const user_id = req.userId;

    const training = new contact({
      user_id, // Use this only if you're authenticating
      CollegeName: college,
      semester,
      year,
      trainingorCourse: courseName,
      startDate,
      endDate,
      comments: feedback,
      Suggestion: improvement,
    });
    
    await training.save();
    return res
      .status(201)
      .json({ message: "Training information saved successfully" });

  } catch (err) {
    console.error("Error in /training:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


router.post("/b2b-lead", async (req, res) => {
  try {
    // 1. Extract the exact fields from your frontend form
    // (Removed 'subject', added 'countryCode' and 'phone')
    const { contactName, contactPhone, schoolName, studentCount} = req.body;

    // 2. Validate all required fields based on your Schema
    if (!contactName || !contactPhone || !schoolName || !studentCount) {
      return res.status(400).json({ error: "Please fill in all required fields." });
    }

    // 3. Save to MongoDB First
    const newEnquiry = new platformAudit({
        contactName,
        contactPhone, 
        schoolName,
        studentCount,
       
    });
    
    await newEnquiry.save(); 

    // 4. Prepare HTML for the Email
    // Since 'subject' is gone, we just pass a hardcoded title to your template
    const emailTitle = "New Website Enquiry"; 
    const supportEmailHtml = plantformAuditTemplate(contactName, contactPhone, schoolName, studentCount);

    // 5. Send Email to Admin/Support Team
    const mailOptions = {
      from: process.env.EMAIL,
      to: process.env.EMAIL, 
      
      // Added the phone number to the email subject line so you see it instantly!
      subject: `📩 Enquiry from ${contactPhone})`,
      html: supportEmailHtml
    };

    transporter.sendMail(mailOptions, (error) => {
      if (error) console.error("Contact Email Error:", error);
    });

    // 6. Notify All Admins (In-App + Real-time)
    try {
      const admins = await User.find({ isAdmin: true });
      
      const notifyPromises = admins.map((admin) => 
        sendAutoNotification(
          req.app, 
          admin._id, 
          `📩 New Website Enquiry from ${contactName}`, 
          "admin/messages", 
          name 
        )
      );
      
      await Promise.all(notifyPromises);
    } catch (err) {
      console.error("Admin Notification Error:", err);
    }

    res.status(200).json({ success: true, message: "Your message has been sent and saved!" });
  } catch (error) {
    console.error("Contact Form Error:", error);
    res.status(500).json({ error: "Failed to send message." });
  }
});

// router.post("/send-bulk", async (req, res) => {
//   try {
//     // 1. Extract the data sent from React
//     const { recipientsData } = req.body;

//     // 2. Validate that we actually received an array of data
//     if (!recipientsData || !Array.isArray(recipientsData)) {
//       return res.status(400).json({ error: "Invalid data received. Expected an array of schools." });
//     }

//     console.log(`Backend received ${recipientsData.length} schools to process.`);

//     // 3. Loop through the array and send an email to each school
//     const emailPromises = recipientsData.map(async (school) => {
      
//       // Generate the HTML using your imported template
//       const emailHtml = bulkEmailTemplate(
//         school.schoolName, 
//         school.designationOfAddressee, 
//         school.nameOfAddresse
//       );

//       // Construct the Mail Options object
//       const mailOptions = {
//         from: process.env.EMAIL,
//         to: school.emailIds.join(", "), // Joins multiple emails with a comma
//         subject: `Scaling ${school.schoolName}'s admissions without new infrastructure`,
//         html: emailHtml
//       };

//       // Send the email using your existing Vercel transporter setup
//       return transporter.sendMail(mailOptions);
//     });

//     // 4. Wait for all emails to finish sending
//     await Promise.all(emailPromises);

//     // 5. Send a SUCCESS JSON response back to React! 
//     res.status(200).json({ message: `Successfully dispatched emails to ${recipientsData.length} schools.` });

//   } catch (error) {
//     console.error("Backend Bulk Email Error:", error);
//     // Send a FAILURE JSON response back to React
//     res.status(500).json({ error: "Failed to send bulk emails from the server." });
//   }
// });
router.post("/send-bulk", async (req, res) => {
  const { recipientsData } = req.body;

  if (!recipientsData || !Array.isArray(recipientsData)) {
    return res.status(400).json({ error: "Invalid data received." });
  }

  // 1. SET HEADERS FOR STREAMING
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders(); 

  let sentCount = 0;
  const total = recipientsData.length;

  for (const school of recipientsData) {
    try {
      
      const docDefinition = generateProposalTemplate(school.schoolName, school.nameOfAddresse);
      
      // 🚨 NEW PDFMAKE 0.3+ GENERATION (So much cleaner!)
      const pdf = pdfmake.createPdf(docDefinition);
      const personalizedPdfBase64 = await pdf.getBase64(); // Boom. Done.

      // Send Email via Vercel Microservice
      await transporter.sendMail({
        from: process.env.EMAIL, 
        to: school.emailIds.join(", "),
        subject: `Scaling ${school.schoolName}'s admissions without new infrastructure`,
        html: bulkEmailTemplate(school.schoolName, school.designationOfAddressee, school.nameOfAddresse),
        attachments: [{
          filename: `CuTeES_Proposal_${school.schoolName.replace(/\s+/g, '_')}.pdf`,
          content: personalizedPdfBase64,
          encoding: 'base64'
        }]
      });

      sentCount++;

      // 2. STREAM THE PROGRESS BACK TO REACT
      const progressData = JSON.stringify({ 
        current: sentCount, 
        total: total, 
        lastSchool: school.schoolName 
      });
      res.write(`data: ${progressData}\n\n`);

      // C. Sleep to avoid spam filters
      await sleep(2500); 

    } catch (err) {
      console.error(`Failed to send to ${school.schoolName}:`, err.message);
      sentCount++;
      res.write(`data: ${JSON.stringify({ current: sentCount, total: total, error: true, lastSchool: school.schoolName })}\n\n`);
    }
  }

  // 3. CLOSE THE STREAM WHEN FINISHED
  res.write(`data: ${JSON.stringify({ complete: true })}\n\n`);
  res.end();
});


// -------------------------------------

// The Route: Notice we added `upload.single("resume")` before the async handler
// "resume" matches the `name="resume"` attribute in your frontend HTML input
// router.post("/internship-register", upload.single("resume"), async (req, res) => {
 

//   try {
//     // Extract text fields from req.body
//     const {
//       name,
//       email,
//       subject,
//       startDate,
//       endDate
//     } = req.body;

//     // Validate required text fields
//     if (!name || !email || !subject || !startDate || !endDate) {
//       return res.status(400).json({ error: "Please fill all required fields." });
//     }

//     // Validate that the file was successfully uploaded by multer
//     if (!req.file) {
//       return res.status(400).json({ error: "Please upload your resume." });
//     }

//     // Date logic validation (Backend double-check)
//     if (new Date(startDate) > new Date(endDate)) {
//         return res.status(400).json({ error: "End Date cannot be earlier than Start Date." });
//     }

//     // Create the path/URL to save to the database
//     // Depending on your setup, this might be an S3 URL, but here it's a local path
//     const resumeUrl = req.file.path; 

//     // Create a new Internship document
//     const newInternship = new Internship({
//       // user_id: req.userId, // Optional: if you want to link it to the logged-in user's ID
//       name,
//       email,
//       subject,
//       startDate,
//       endDate,
//       resumeUrl
//     });
    
//     // Save to the database
//     await newInternship.save();

//     // Send success response
//     return res.status(201).json({ message: "Internship registration saved successfully!" });

//   } catch (err) {
//     console.error("Error in /internship-register:", err);
    
//     // Handle specific Multer errors (like file too large)
//     if (err instanceof multer.MulterError) {
//         return res.status(400).json({ error: err.message });
//     }
    
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// });

// Ensure multer is imported and configured properly above this route
// const multer = require('multer');
// const upload = multer({ dest: 'uploads/' }); // or your custom storage configuration

router.post("/internship-register", upload.single("resume"), async (req, res) => {
  try {
    // 1. Immediately validate that the file was intercepted by multer
    if (!req.file) {
      return res.status(400).json({ error: "Please upload your resume. File is missing or invalid." });
    }

    // 2. Extract text fields from req.body
    const { name, email, subject, startDate, endDate } = req.body;

    // 3. Validate required text fields
    if (!name || !email || !subject || !startDate || !endDate) {
      return res.status(400).json({ error: "Please fill all required fields." });
    }

    // 4. Date logic validation
    if (new Date(startDate) > new Date(endDate)) {
        return res.status(400).json({ error: "End Date cannot be earlier than Start Date." });
    }

    // 5. Create the path/URL to save to the database
    const resumeUrl = req.file.path; 

    // Create a new Internship document
    const newInternship = new Internship({
      name,
      email,
      subject,
      startDate,
      endDate,
      resumeUrl // This will now definitely be populated
    });
    
    // Save to the database
    await newInternship.save();

    return res.status(201).json({ message: "Internship registration saved successfully!" });

  } catch (err) {
    console.error("Error in /internship-register:", err);
    
    // If an error happens inside the try block that is Multer-related
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: `Upload error: ${err.message}` });
    }
    
    res.status(500).json({ error: "Internal Server Error" });
  }
});


module.exports = router;
