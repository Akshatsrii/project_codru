const express = require('express');
const axios = require('axios');
const router = express.Router();
const Contact = require('../models/Contact');
const Message = require('../models/Message');
const User = require("../models/userSchema"); 
const sendAutoNotification = require("../utils/notify");
const multer = require('multer');
const FormData = require('form-data');
const Lead = require('../models/Lead');
const Task = require('../models/Task');
const authenticate = require("../middleware/authenticate"); // Import it
const Template = require('../models/Template');
const upload = multer({ storage: multer.memoryStorage() });

// ==========================================
// 1. GET: FETCH CHAT HISTORY
// ==========================================
router.get('/chats/:userNumber', async (req, res) => {
    try {
        const { userNumber } = req.params;
        // We find messages where userNumber matches the student's phone
        const messages = await Message.find({ userNumber }).sort({ timestamp: 1 });
        res.status(200).json(messages);
    } catch (error) {
        res.status(500).json({ error: "Failed to load chat history." });
    }
});

// ==========================================
// 2. POST: SEND MANUAL REPLY
// ==========================================
router.post('/send', async (req, res) => {
    try {
        // 1. Grab 'to' and 'messageBody' from the React frontend
        const { to, messageBody } = req.body; 

        if (!to || !messageBody) {
            return res.status(400).json({ error: "Phone number and message are required." });
        }

        const botNumberId = "1049944734868137"; 

        // 2. Send via Meta API
        const response = await axios({
            method: "POST",
            url: `https://graph.facebook.com/v19.0/${botNumberId}/messages`,
            data: {
                messaging_product: "whatsapp",
                to: to,
                text: { body: messageBody },
            },
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`
            },
            // 🚨 AXIOS v1.16+ FIX: Prevents large text strings from triggering payload limits
            maxBodyLength: Infinity,
            maxContentLength: Infinity
        });

        if (response.data && response.data.messages) {
            // 3. Save to Message collection
            const savedMessage = await Message.create({
                wa_id: response.data.messages[0].id,
                senderName: "Admin (CuTe)",
                userNumber: to, // Ensure this uses 'to'
                botNumberId: botNumberId,
                messageBody: messageBody,
                messageType: 'text',
                direction: 'outgoing',
                status: 'sent'
            });

            // 4. THE CRITICAL FIX: Update Contact using 'to' (not 'from'!)
            await Contact.findOneAndUpdate(
                { phoneNumber: to }, // or 'fromNumber' in webhook
                { 
                    $set: { 
                        lastMessage: messageBody, 
                        lastSeen: new Date(),
                        unreadCount: 0
                    }
                },
                { 
                    upsert: true, 
                    new: true, 
                    // THIS IS THE FIX: It tells Mongoose to ignore schema strictness here
                    strict: false 
                }
            );

            // 5. Emit to UI via Socket
            if (req.app && req.app.get("io")) {
                req.app.get("io").emit("whatsapp_message_update", savedMessage);
            }

            // 6. Respond and STOP
            return res.status(200).json(savedMessage);
        }

    } catch (error) {
        console.error("Error in /send route:", error.message);
        
        // Prevent the "Headers already sent" crash
        if (!res.headersSent) {
            return res.status(500).json({ error: "Failed to send message." });
        }
    }
});

// ==========================================
// 3. GET: WEBHOOK VERIFY (Keep as is)
// ==========================================
router.get('/webhook', (req, res) => {
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (token === process.env.WHATSAPP_VERIFY_TOKEN) return res.status(200).send(challenge);
    res.sendStatus(403);
});

// ==========================================
// 4. POST: RECEIVE WEBHOOK
// ==========================================
router.post('/webhook', async (req, res) => {
    res.sendStatus(200); // Always tell Meta "Got it!" first
    const body = req.body;

    if (body.object === "whatsapp_business_account") {
        
        const value = body.entry?.[0]?.changes?.[0]?.value;
        if (!value) return; // Safety check

        // ----------------------------------------------------
        // BLOCK 1: INCOMING MESSAGES (Student texts you)
        // ----------------------------------------------------
        if (value.messages) {
            try {
                const msg = value.messages[0];
                const contactInfo = value.contacts ? value.contacts[0] : null;
                
                const fromNumber = msg.from; 
                const senderName = contactInfo?.profile?.name || "New Student";
                
                // Variables declared perfectly
                let msgText = "";
                let msgType = msg.type || "text";
                let mediaUrl = null;

                // Dynamically grab your live backend URL (or fallback to localhost)
                const BASE_URL = process.env.VITE_API || "https://api.curiousteamlearning.com";

                // Media Detection Logic
                if (msgType === "text") {
                    msgText = msg.text?.body || "";
                } else if (msgType === "image") {
                    // Uses your live API domain!
                    mediaUrl = `${BASE_URL}/media/${msg.image.id}`;
                    msgText = msg.image.caption || "📷 Image";
                } else if (msgType === "document") {
                    // Uses your live API domain!
                    mediaUrl = `${BASE_URL}/media/${msg.document.id}`;
                    msgText = msg.document.caption || msg.document.filename || "📄 Document";
                } else {
                    msgText = `[Unsupported message type: ${msgType}]`;
                }

                // Save to Message Collection
                const savedMessage = await Message.create({
                    wa_id: msg.id,
                    senderName: senderName,
                    userNumber: fromNumber,
                    botNumberId: value.metadata.phone_number_id,
                    messageBody: msgText,
                    messageType: msgType,   
                    mediaUrl: mediaUrl,     
                    direction: 'incoming',
                    status: 'received',
                    timestamp: new Date()
                });

                // Update Contact Sidebar & Unread Count
                const savedContact = await Contact.findOneAndUpdate(
                    { phoneNumber: fromNumber }, 
                    { 
                        $set: { 
                            name: senderName, 
                            lastMessage: msgText, 
                            lastSeen: new Date() 
                        },
                        $inc: { unreadCount: 1 }
                    },
                    { upsert: true, new: true, setDefaultsOnInsert: true, strict: false }
                );

                await Lead.findOneAndUpdate(
                    { phoneNumber: fromNumber },
                    {
                        $setOnInsert: {
                            contactId: savedContact._id,
                            // 🚨 Fixed the variable bug from 'incomingNumber' to 'fromNumber'
                            name: savedContact.name || fromNumber,
                            status: 'New' // Instantly marks them as a New Lead!
                        }
                    },
                    { upsert: true, setDefaultsOnInsert: true }
                );

                // 📣 BROADCAST TO UI
                if (req.app.get("io")) {
                    console.log(`[Socket] Broadcasting message from ${fromNumber}`);
                    req.app.get("io").emit("whatsapp_message_update", savedMessage);
                }

                // SYSTEM NOTIFICATIONS
                try {
                    const admins = await User.find({ isAdmin: true });
                    const previewText = msgText.length > 30 ? msgText.substring(0, 30) + "..." : msgText;
                    
                    const notifyPromises = admins.map(admin => 
                        sendAutoNotification(
                            req.app, 
                            admin._id, 
                            `💬 WhatsApp: ${senderName} sent ${msgType === 'text' ? `"${previewText}"` : `an ${msgType}`}`, 
                            "whatsapp-crm", 
                            "WhatsApp Bot" 
                        )
                    );
                    await Promise.all(notifyPromises);
                } catch (notifErr) {
                    console.error("❌ Failed to trigger Admin WhatsApp notifications:", notifErr);
                }

            } catch (e) { 
                console.error("❌ Webhook Messages Error:", e.message); 
            }
        }

        // ----------------------------------------------------
        // BLOCK 2: STATUS UPDATES (Sent, Delivered, Read)
        // ----------------------------------------------------
        if (value.statuses) {
            try {
                const statusObj = value.statuses[0];
                const wa_id = statusObj.id; // Match this to the sent message
                const status = statusObj.status; // 'sent', 'delivered', 'read', 'failed'
                
                // Meta timestamp is in seconds. Convert to JS milliseconds.
                const exactTime = new Date(statusObj.timestamp * 1000); 

                let updateData = { status: status };
                if (status === 'delivered') updateData.deliveredAt = exactTime;
                if (status === 'read') updateData.readAt = exactTime;

                // 1. Update the exact message timestamps
                const updatedMessage = await Message.findOneAndUpdate(
                    { wa_id: wa_id },
                    { $set: updateData },
                    { new: true }
                );

                // 2. 📣 BROADCAST STATUS UPDATE TO UI
                if (updatedMessage && req.app.get("io")) {
                    console.log(`[Status] Message ${status} at ${exactTime.toLocaleTimeString()}`);
                    req.app.get("io").emit("whatsapp_status_update", updatedMessage);
                }

            } catch (e) {
                console.error("❌ Status Webhook Error:", e.message);
            }
        }
    }
});

// ==========================================
// 5. GET: MASTER CONTACT LIST (Unified)
// ==========================================
router.get('/contacts', async (req, res) => {
    try {
        const contacts = await Contact.find({ isArchived: false })
                                      .sort({ lastSeen: -1 }) 
                                      .lean();
        
        const clean = contacts.map(c => ({
            _id: String(c._id),
            name: c.name || "Unknown Student",
            phoneNumber: String(c.phoneNumber || ""), 
            lastMessage: c.lastMessage || "",
            lastSeen: c.lastSeen || c.updatedAt,
            unreadCount: c.unreadCount || 0
        }));

        res.status(200).json(clean);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// 6. POST: RESET UNREAD COUNT
// ==========================================
router.post('/contacts/reset-unread/:id', async (req, res) => {
    try {
        await Contact.findByIdAndUpdate(req.params.id, { 
            $set: { unreadCount: 0 } 
        });
        res.sendStatus(200);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// 7. POST: MANUALLY ADD A NEW CONTACT
// ==========================================
router.post('/contacts', async (req, res) => {
    try {
        const { name, phoneNumber } = req.body;
        
        if (!phoneNumber) {
            return res.status(400).json({ error: "Phone number is required." });
        }

        const cleanNum = String(phoneNumber).replace(/\D/g, "");

        const savedContact = await Contact.findOneAndUpdate(
            { phoneNumber: cleanNum },
            {
                $set: { name: name || cleanNum },
                $setOnInsert: {
                    lastMessage: "New Contact Added",
                    unreadCount: 0,
                    lastSeen: new Date()
                }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true, strict: false }
        );

        await Lead.findOneAndUpdate(
            { phoneNumber: cleanNum },
            {
                $setOnInsert: {
                    contactId: savedContact._id,
                    name: savedContact.name,
                    status: 'New'
                }
            },
            { upsert: true, setDefaultsOnInsert: true }
        );

        res.status(200).json(savedContact);
    } catch (error) {
        res.status(500).json({ error: "Failed to add contact." });
    }
});

// ==========================================
// 6. POST: SEND TEMPLATE MESSAGE
// ==========================================
router.post('/send-template', async (req, res) => {
    try {
        const { 
            to, 
            templateName, 
            languageCode = "en", 
            variables = [], 
            headerUrl = null 
        } = req.body;

        const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
        const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

        const components = [];

        // 1. DYNAMIC HEADER FIX
        if (headerUrl && headerUrl.trim() !== "") {
            let mediaType = "image"; // Default
            const lowerUrl = headerUrl.toLowerCase();
            
            if (lowerUrl.match(/\.(pdf|doc|docx|ppt|pptx|xls|xlsx)$/i)) {
                mediaType = "document";
            } else if (lowerUrl.match(/\.(mp4|3gp|mov|avi)$/i)) {
                mediaType = "video";
            }

            components.push({
                type: "header",
                parameters: [
                    {
                        type: mediaType,
                        [mediaType]: { link: headerUrl }
                    }
                ]
            });
        }

        // 2. BODY VARIABLES
        if (variables.length > 0) {
            components.push({
                type: "body",
                parameters: variables.map(text => ({
                    type: "text",
                    text: String(text)
                }))
            });
        }

        // 3. WHATSAPP FLOW FIX
        // Look up the template in our DB to see if it's a Flow
        const templateDoc = await Template.findOne({ metaName: templateName });

        if (templateDoc && templateDoc.isFlow) {
            components.push({
                type: "button",
                sub_type: "flow", // This is the exact keyword Meta demands
                index: "0",       // Target the first button
                parameters: [
                    {
                        type: "action",
                        action: {
                            // Meta demands a unique flow token per session
                            flow_token: `crm_flow_${Date.now()}_${to}` 
                        }
                    }
                ]
            });
        }

        // 4. BUILD CLEAN PAYLOAD
        const templatePayload = {
            name: templateName,
            language: { code: languageCode }
        };
        
        // Only attach components if we actually have some (prevents empty array errors)
        if (components.length > 0) {
            templatePayload.components = components;
        }

        const payload = {
            messaging_product: "whatsapp",
            to: to,
            type: "template",
            template: templatePayload
        };

        // 5. SEND TO META
        const response = await axios.post(
            `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
            payload,
            { 
                headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
                // 🚨 AXIOS v1.16+ FIX: Safeguards variable arrays from strict length boundaries
                maxBodyLength: Infinity,
                maxContentLength: Infinity
            }
        );

        // 6. SAVE TO DATABASE
        const savedMessage = await Message.create({
            wa_id: response.data.messages[0].id,
            senderName: "System Template",
            userNumber: to,
            messageBody: `[Template: ${templateName}]`,
            botNumberId: PHONE_NUMBER_ID,
            messageType: 'template',
            direction: 'outgoing',
            status: 'sent',
            timestamp: new Date()
        });

        if (req.app.get("io")) req.app.get("io").emit("whatsapp_message_update", savedMessage);

        res.status(200).json({ success: true });

    } catch (error) {
        console.error("Template Error:", error.response?.data || error.message);
        res.status(500).json({ error: "Failed to send template" });
    }
});

// ==========================================
// 8. POST: SYNC TEMPLATES FROM META
// ==========================================
router.post('/templates/sync', async (req, res) => {
    try {
        const WABA_ID = process.env.WABA_ID; // 🚨 Add this to your .env file!
        const TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

        // 1. Fetch all templates from Meta
        const metaResponse = await axios.get(
            `https://graph.facebook.com/v19.0/${WABA_ID}/message_templates`,
            { headers: { Authorization: `Bearer ${TOKEN}` } }
        );

        const metaTemplates = metaResponse.data.data;
        let addedCount = 0;

        // 2. Loop through Meta's templates
        for (const mt of metaTemplates) {
            if (mt.status !== 'APPROVED') continue;

            const hasImageHeader = mt.components.some(
                comp => comp.type === 'HEADER' && comp.format === 'IMAGE'
            );

            // NEW: Auto-detect if this template has a Flow button!
            const hasFlowButton = mt.components.some(
                comp => comp.type === 'BUTTONS' && comp.buttons.some(b => b.type === 'FLOW')
            );

            const existing = await Template.findOne({ metaName: mt.name });

            if (!existing) {
                await Template.create({
                    metaName: mt.name,
                    displayName: mt.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                    language: mt.language,
                    metaStatus: mt.status,
                    requiresImage: hasImageHeader,
                    isFlow: hasFlowButton, // Saves the Flow status!
                    headerImageUrl: "", 
                    isConfigured: !hasImageHeader 
                });
                addedCount++;
            } else {
                existing.metaStatus = mt.status;
                existing.isFlow = hasFlowButton; // Update existing ones
                await existing.save();
            }
        } 

        res.status(200).json({ message: `Sync complete. Added ${addedCount} new templates.` });
    } catch (error) {
        console.error("Meta Sync Error:", error.response?.data || error.message);
        res.status(500).json({ error: "Failed to sync templates from Meta." });
    }
});

// ==========================================
// 9. GET: FETCH ONLY CONFIGURED TEMPLATES FOR UI
// ==========================================
router.get('/templates/ready', async (req, res) => {
    try {
        // This ensures the Chat UI only gets templates you have set up!
        const templates = await Template.find({ isConfigured: true, metaStatus: 'APPROVED' }).sort({ createdAt: -1 });
        res.status(200).json(templates);
    } catch (error) {
        res.status(500).json({ error: "Failed to load templates." });
    }
});

router.get('/templates', async (req, res) => {
    try {
        const templates = await Template.find({}).sort({ createdAt: -1 });
        res.status(200).json(templates);
    } catch (error) { res.status(500).json({ error: "Failed to load templates." }); }
});

router.post('/templates', async (req, res) => {
    try {
        const { displayName, metaName, language, headerImageUrl, buttonColor, variableCount, isVisible, sortOrder } = req.body;
        const savedTemplate = await Template.findOneAndUpdate(
            { metaName: metaName },
            {
                $set: {
                    displayName, language, headerImageUrl, buttonColor, variableCount, isVisible: isVisible !== false, sortOrder: sortOrder || 0,
                    isConfigured: true, // Marks it as ready for the Chat UI!
                    isActive: true
                }
            },
            { upsert: true, new: true }
        );
        res.status(200).json(savedTemplate);
    } catch (error) { res.status(500).json({ error: "Failed to save template." }); }
});

// ==========================================
// 10. GET: SECURE MEDIA PROXY
// ==========================================
router.get('/media/:mediaId', async (req, res) => {
    try {
        const { mediaId } = req.params;
        const TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

        // 1. Ask Meta for the true download URL using the Media ID
        const metaResponse = await axios.get(`https://graph.facebook.com/v19.0/${mediaId}`, {
            headers: { Authorization: `Bearer ${TOKEN}` }
        });
        
        const mediaUrl = metaResponse.data.url;
        const mimeType = metaResponse.data.mime_type;

        // 2. Download the file from Meta and pipe it directly to your React frontend!
        const imageStream = await axios.get(mediaUrl, {
            headers: { Authorization: `Bearer ${TOKEN}` },
            responseType: 'stream'
        });

        res.setHeader('Content-Type', mimeType);
        imageStream.data.pipe(res);
    } catch (error) {
        console.error("Media Proxy Error:", error.message);
        res.status(500).send("Failed to load media.");
    }
});

// ==========================================
// 2.5 POST: SEND MEDIA (Image/Document)
// ==========================================
router.post('/send-media', upload.single('file'), async (req, res) => {
    try {
        const { to, messageBody, mediaType } = req.body; 
        const file = req.file;

        if (!to || !file) {
            return res.status(400).json({ error: "Phone number and file are required." });
        }

        const botNumberId = process.env.PHONE_NUMBER_ID || "1049944734868137"; 
        const TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

        // 1. Upload File to Meta's Encrypted Vault
        const formData = new FormData();
        formData.append('file', file.buffer, file.originalname);
        formData.append('type', file.mimetype);
        formData.append('messaging_product', 'whatsapp');

        const mediaUploadRes = await axios.post(
            `https://graph.facebook.com/v19.0/${botNumberId}/media`,
            formData,
            { 
                headers: { ...formData.getHeaders(), Authorization: `Bearer ${TOKEN}` },
                // 🚨 AXIOS v1.16+ FIX: Explicitly allowed infinite binary streams
                maxBodyLength: Infinity,
                maxContentLength: Infinity
            }
        );

        const secureMediaId = mediaUploadRes.data.id;

        // 2. Send the Message using the Secure Media ID
        const payload = {
            messaging_product: "whatsapp",
            to: to,
            type: mediaType, // 'image' or 'document'
            [mediaType]: { id: secureMediaId }
        };

        // Meta only allows captions if we provide one
        if (messageBody && messageBody.trim()) {
            payload[mediaType].caption = messageBody; 
        }

        if (mediaType === 'document' && file.originalname) {
            payload.document.filename = file.originalname;
        }

        const response = await axios.post(
            `https://graph.facebook.com/v19.0/${botNumberId}/messages`,
            payload,
            { 
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
                // 🚨 AXIOS v1.16+ FIX: Explicitly settings roots here if captions run excessively long
                maxBodyLength: Infinity,
                maxContentLength: Infinity
            }
        );

        // 3. Save to CRM Database
        const BASE_URL = process.env.VITE_API || "https://api.curiousteamlearning.com";

        const savedMessage = await Message.create({
            wa_id: response.data.messages[0].id,
            senderName: "Admin (CuTe)",
            userNumber: to,
            botNumberId: botNumberId,
            messageBody: messageBody || "", // Make it blank instead of "[Sent image]" if no caption
            messageType: mediaType,
            mediaUrl: `${BASE_URL}/media/${secureMediaId}`, // USE THE LIVE URL HERE!
            direction: 'outgoing',
            status: 'sent',
            timestamp: new Date()
        });

        // 4. Update Contact Sidebar
        await Contact.findOneAndUpdate(
            { phoneNumber: to },
            { 
                $set: { 
                    lastMessage: mediaType === 'image' ? '📷 Image' : '📄 Document', 
                    lastSeen: new Date(),
                    unreadCount: 0
                }
            },
            { strict: false }
        );

        // 5. Emit to UI
        if (req.app.get("io")) req.app.get("io").emit("whatsapp_message_update", savedMessage);

        res.status(200).json(savedMessage);

    } catch (error) {
        console.error("Error sending media:", error.response?.data || error.message);
        res.status(500).json({ error: "Failed to send media." });
    }
});

// ==========================================
// UPDATE LEAD STATUS & NOTIFY
// ==========================================
router.put('/leads/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        
        const updatedLead = await Lead.findByIdAndUpdate(
            req.params.id,
            { $set: { status: status } },
            { new: true }
        );

        // CELEBRATION NOTIFICATION
        if (status === 'Converted') {
            try {
                // Find all CuTe Admins/Team to celebrate
                const admins = await User.find({ isCuTeTeam: true });
                const notifyPromises = admins.map(admin => 
                    sendAutoNotification(
                        req.app, 
                        admin._id, 
                        `🎉 Awesome! ${updatedLead.name} just converted!`, 
                        "/crm", 
                        "Sales Bot" 
                    )
                );
                await Promise.all(notifyPromises);
            } catch (notifErr) {
                console.error("Failed to send conversion notifications:", notifErr);
            }
        }

        res.status(200).json(updatedLead);
    } catch (error) {
        res.status(500).json({ error: "Failed to update lead status." });
    }
});

// ==========================================
// FETCH LEAD BY PHONE NUMBER (With Auto-Heal for old contacts)
// ==========================================
router.get('/leads/:phoneNumber', async (req, res) => {
    try {
        const cleanNum = String(req.params.phoneNumber).replace(/\D/g, "");
        
        let lead = await Lead.findOne({ phoneNumber: cleanNum });
        
        // AUTO-HEAL: If no lead exists, let's create one using their existing Contact info!
        if (!lead) {
            const Contact = require('../models/Contact'); // Import Contact model locally
            const existingContact = await Contact.findOne({ phoneNumber: cleanNum });
            
            if (existingContact) {
                lead = await Lead.create({
                    contactId: existingContact._id,
                    phoneNumber: cleanNum,
                    name: existingContact.name || cleanNum,
                    status: 'New' // Drop all old contacts into the 'New' stage
                });
            } else {
                return res.status(404).json({ error: "No contact found to create a lead from." });
            }
        }
        
        res.status(200).json(lead);
    } catch (error) {
        console.error("Lead Fetch Error:", error);
        res.status(500).json({ error: "Failed to fetch lead." });
    }
});

// ==========================================
// POST: CREATE NEW TASK
// ==========================================
router.post('/tasks', authenticate, async (req, res) => {
    try {
        // Destructure priority from req.body
        const { title, description, dueDate, leadId, assignedStaff, addToCalendar, priority } = req.body;
        
        const cleanLeadId = leadId && leadId.trim() !== "" ? leadId : undefined;

        let assignedUserIds = [];
        if (assignedStaff && assignedStaff.length > 0) {
            const users = await User.find({ username: { $in: assignedStaff } });
            assignedUserIds = users.map(u => u._id);
        }

        const newTask = await Task.create({
            title,
            description,
            dueDate: dueDate ? new Date(dueDate) : undefined,
            leadId: cleanLeadId,
            assignedTo: assignedUserIds,
            isCalendarSynced: addToCalendar || false,
            priority: priority || 'Medium' // Save the priority!
        });

        const populatedTask = await Task.findById(newTask._id)
            .populate('leadId', 'name phoneNumber')
            .populate('assignedTo', 'name username photo');
        
        res.status(201).json(populatedTask);
    } catch (error) {
        console.error("Task Creation Error:", error);
        res.status(500).json({ error: "Failed to create task." });
    }
});

module.exports = router;