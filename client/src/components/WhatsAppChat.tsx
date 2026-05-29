import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { socket } from '../socket';
import { Search, Send, Phone, User, Clock, AlertCircle, Loader2, Sparkles, ArrowLeft, Plus, X, Settings, RefreshCw, CheckCircle2, UserPlus, Paperclip, FileText } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

export interface WhatsAppMessage {
    _id: string;
    wa_id: string;
    senderName: string;
    userNumber: string;
    messageBody: string;
    messageType: 'text' | 'template' | 'image' | 'document';
    direction: 'incoming' | 'outgoing';
    status: 'received' | 'sent' | 'read' | 'failed';
    timestamp: string;
    deliveredAt?: string;
    readAt?: string;
    mediaUrl?: string;
}

// Super basic NLP date parser
// Smarter NLP date & time parser
const extractDateFromText = (text: string): Date | null => {
    const lowerText = text.toLowerCase();
    const now = new Date();
    let targetDate = new Date(now);
    let dateFound = false;

    // 1. Check for relative days
    if (lowerText.includes('tomorrow')) {
        targetDate.setDate(now.getDate() + 1);
        dateFound = true;
    } else if (lowerText.includes('today')) {
        dateFound = true; // keep it as today
    } else if (lowerText.includes('next week')) {
        targetDate.setDate(now.getDate() + 7);
        dateFound = true;
    }

    // 2. Check for days of the week
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    for (let i = 0; i < days.length; i++) {
        if (lowerText.includes(days[i])) {
            const todayDay = now.getDay();
            let daysAhead = i - todayDay;
            if (daysAhead <= 0) daysAhead += 7; // Jump to the *next* occurrence of this day
            targetDate.setDate(now.getDate() + daysAhead);
            dateFound = true;
            break;
        }
    }

    // 3. Check for Time (e.g., 5pm, 5:30 pm, 14:00)
    // This regex looks for 1-2 digits, an optional colon with 2 minutes, and an optional am/pm
    const timeMatch = lowerText.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    let timeFound = false;

    if (timeMatch) {
        let hours = parseInt(timeMatch[1]);
        const mins = parseInt(timeMatch[2]) || 0;
        const modifier = timeMatch[3]; // 'am' or 'pm'

        // Basic sanity check to ensure it's actually a time (ignores random numbers like "let's do 50 pushups")
        if (hours <= 24) {
            if (modifier === 'pm' && hours < 12) hours += 12;
            if (modifier === 'am' && hours === 12) hours = 0;
            
            targetDate.setHours(hours, mins, 0, 0);
            timeFound = true;
        }
    }

    // If no date AND no time was found, return null (so the user has to pick manually)
    if (!dateFound && !timeFound) {
        return null;
    }

    // If they ONLY gave a time, default to Today. 
    // But if that time has already passed today, assume they meant Tomorrow!
    if (timeFound && !dateFound) {
        if (targetDate.getTime() < now.getTime()) {
            targetDate.setDate(now.getDate() + 1);
        }
    }

    // If they gave a date but NO time, default to 10:00 AM
    if (dateFound && !timeFound) {
        targetDate.setHours(10, 0, 0, 0);
    }

    return targetDate;
};

const cleanNum = (num: any) => String(num || "").replace(/\D/g, "");
const API_BASE = (import.meta.env.VITE_API || "http://localhost:8080").replace(/\/$/, "");

const WhatsAppChat: React.FC = () => {
    const [contacts, setContacts] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedContactId, setSelectedContactId] = useState<string>("");
    const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
    const [inputText, setInputText] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    
    // Dynamic Template States
    const [templates, setTemplates] = useState<any[]>([]); 
    const [allTemplates, setAllTemplates] = useState<any[]>([]); 
    const [isSendingTemplate, setIsSendingTemplate] = useState(false);
    const [showTemplateManager, setShowTemplateManager] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [updatingTemplateId, setUpdatingTemplateId] = useState<string | null>(null);

    // 🚨 NEW: States for Pre-Flight Variable Modal
    const [pendingTemplate, setPendingTemplate] = useState<any | null>(null);
    const [templateVariables, setTemplateVariables] = useState<string[]>([]);

    const [showNewContactModal, setShowNewContactModal] = useState(false);
    const [newContactName, setNewContactName] = useState("");
    const [newContactPhone, setNewContactPhone] = useState("");
    const [isAddingContact, setIsAddingContact] = useState(false);

    // New states for Media Upload
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Lead Management States
    const [activeLead, setActiveLead] = useState<any>(null);
    const [isUpdatingLead, setIsUpdatingLead] = useState(false);

    // 🚨 Updated to include username and photo
    const [teamMembers, setTeamMembers] = useState<{_id: string, name: string, username: string, photo?: string}[]>([]);
    const [teamSearch, setTeamSearch] = useState("");
    const [showTeamDropdown, setShowTeamDropdown] = useState(false);
    const [toast, setToast] = useState<{show: boolean, message: string, type: 'success' | 'error' | 'info'}>({ show: false, message: '', type: 'success' });

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
    };
    // Task & Calendar States
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [isCreatingTask, setIsCreatingTask] = useState(false);
    const [taskData, setTaskData] = useState({
        title: "",
        description: "",
        dueDate: "",
        addToCalendar: true,
        assignedStaff: [] as string[],
        attendees: [] as string[],
    });

    const [searchParams] = useSearchParams();

    useEffect(() => {
        // We only try to select a contact once the list is actually loaded
        if (contacts.length === 0) return;

        const idFromUrl = searchParams.get('id');
        const pendingIdFromStorage = localStorage.getItem("pendingChatId");
        const isMobile = window.innerWidth < 768;

        if (idFromUrl) {
            // Priority 1: URL Query (?id=...)
            setSelectedContactId(idFromUrl);
        } else if (pendingIdFromStorage) {
            // Priority 2: Dashboard Widget Redirect (pendingChatId)
            setSelectedContactId(pendingIdFromStorage);
            localStorage.removeItem("pendingChatId"); // Clear it so it doesn't haunt future loads
        } else if (!selectedContactId && !isMobile) {
            // Priority 3: Default to first contact (Desktop only)
            setSelectedContactId(contacts[0]._id);
        }
    }, [contacts, searchParams]); 

    const handleOpenTaskModal = (messageText: string) => {
        const extractedDate = extractDateFromText(messageText);
        const dateString = extractedDate 
            ? new Date(extractedDate.getTime() - (extractedDate.getTimezoneOffset() * 60000)).toISOString().slice(0, 16)
            : "";

        setTaskData({
            title: `Follow up: ${activeContact?.name || 'Student'}`,
            description: messageText,
            dueDate: dateString,
            addToCalendar: true,
            assignedStaff: ["Me"], 
            attendees: [activeContact?.name || "Student"],
        });
        setShowTaskModal(true);
    };

    const handleCreateTask = async () => {
        if (!activeLead) {
            showToast("Please ensure this contact has a Lead profile first.", "error"); 
            return;
        }
        setIsCreatingTask(true);
        try {
            const token = localStorage.getItem("jwtoken");
            const headers = { Authorization: `Bearer ${token}` };

            // 1. Create the Task in the CRM (Database & Notifications)
            await axios.post(`${API_BASE}/tasks`, {
                ...taskData,
                leadId: activeLead._id,
            }, { headers });

            // 2. 🚨 CRITICAL GOOGLE CALENDAR SYNC 🚨
            if (taskData.addToCalendar && taskData.dueDate) {
                const startDate = new Date(taskData.dueDate);
                
                // Automatically add 15 minutes for Google Calendar's required End Time!
                const endDate = new Date(startDate.getTime() + 15 * 60000); 

                await fetch(`${API_BASE}/calendar-events`, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        title: taskData.title,
                        description: taskData.description,
                        date: startDate.toISOString(),
                        endTime: endDate.toISOString(), // 👈 Sent straight to your backend
                        type: 'task',
                        color: 'bg-brand-orange',
                        guests: taskData.assignedStaff.filter(s => s !== "Me"),
                        addMeet: false 
                    })
                });
            }

            setShowTaskModal(false);
            showToast("Task & Calendar Event Created successfully!", "success"); 
        } catch (error) {
            console.error("Failed to create task:", error);
            showToast("Failed to create task.", "error"); 
        } finally {
            setIsCreatingTask(false);
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const activeContact = contacts.find(c => c._id === selectedContactId);
    const activeUserNumber = activeContact?.phoneNumber;

    // ==========================================
    // DATA FETCHING 
    // ==========================================
    const fetchContacts = useCallback(async () => {
        try {
            const res = await axios.get(`${API_BASE}/contacts`);
            setContacts(res.data);
            
        } catch (err) {
            console.error("Error loading contacts:", err);
        }
    }, [selectedContactId]);

    const fetchReadyTemplates = useCallback(async () => {
        try {
            const res = await axios.get(`${API_BASE}/templates/ready`);
            setTemplates(res.data);
        } catch (err) {
            console.error("Error loading ready templates:", err);
        }
    }, []);

    const fetchAllTemplates = useCallback(async () => {
        try {
            const res = await axios.get(`${API_BASE}/templates`);
            setAllTemplates(res.data);
        } catch (err) {
            console.error("Error loading all templates:", err);
        }
    }, []);

    useEffect(() => {
        // ... existing fetchContacts() etc ...
        const fetchTeam = async () => {
            try {
                const res = await axios.get(`${API_BASE}/team`);
                setTeamMembers(res.data);
            } catch (err) {
                console.error("Failed to load team members", err);
            }
        };
        fetchTeam();
    }, []);

    useEffect(() => {
        fetchContacts();
        fetchReadyTemplates();
    }, [fetchContacts, fetchReadyTemplates]);

    useEffect(() => {
        if (showTemplateManager) {
            fetchAllTemplates();
        }
    }, [showTemplateManager, fetchAllTemplates]);

    useEffect(() => {
        const fetchChatHistory = async () => {
            if (!activeUserNumber) return;
            setIsLoading(true);
            try {
                const response = await axios.get<WhatsAppMessage[]>(`${API_BASE}/chats/${activeUserNumber}`);
                setMessages(response.data);

                try {
                    const cleanNum = String(activeUserNumber).replace(/\D/g, "");
                    const leadRes = await axios.get(`${API_BASE}/leads/${cleanNum}`);
                    setActiveLead(leadRes.data);
                } catch (leadErr) {
                    setActiveLead(null); // No lead profile found yet
                }

            } catch (error) {
                console.error("Failed to fetch chat history:", error);
                setMessages([]);
            } finally {
                setIsLoading(false);
            }
        };
        fetchChatHistory();
    }, [activeUserNumber]);

    // ==========================================
    // SOCKET LISTENER
    // ==========================================
    useEffect(() => {
        const handleNewMessage = (newMsg: WhatsAppMessage) => {
            const incomingNum = cleanNum(newMsg.userNumber);
            const currentActiveNum = cleanNum(activeUserNumber);

            if (incomingNum === currentActiveNum) {
                setMessages((prev) => {
                    if (prev.some(m => m.wa_id === newMsg.wa_id || m._id === newMsg._id)) return prev;
                    return [...prev, newMsg];
                });
            }

            if (newMsg.direction === 'incoming' && document.hidden) {
                new Notification(`New message from ${newMsg.senderName}`, {
                    body: newMsg.messageBody,
                    icon: '/logo.png' 
                });
            }

            setContacts((prevContacts) => {
                const contactExists = prevContacts.some(c => cleanNum(c.phoneNumber) === incomingNum);
                if (!contactExists) {
                    fetchContacts(); 
                    return prevContacts;
                }

                const updated = prevContacts.map((c) => {
                    if (cleanNum(c.phoneNumber) === incomingNum) {
                        return { 
                            ...c, 
                            lastMessage: newMsg.messageBody, 
                            lastSeen: new Date().toISOString(),
                            unreadCount: incomingNum === currentActiveNum ? 0 : (c.unreadCount || 0) + 1
                        };
                    }
                    return c;
                });

                return [...updated].sort((a, b) => 
                    new Date(b.lastSeen || 0).getTime() - new Date(a.lastSeen || 0).getTime()
                );
            });
        };

        socket.on("whatsapp_message_update", handleNewMessage);
        socket.on("whatsapp_status_update", (updatedMsg: WhatsAppMessage) => {
            setMessages((prev) => prev.map(m => 
                m.wa_id === updatedMsg.wa_id ? { ...m, ...updatedMsg } : m
            ));
        });
        return () => { 
            socket.off("whatsapp_message_update", handleNewMessage); 
            socket.off("whatsapp_status_update");
        };
    }, [activeUserNumber, fetchContacts]);

    // ==========================================
    // HANDLERS
    // ==========================================
    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeUserNumber || (!inputText.trim() && !selectedFile)) return;

        const tempText = inputText;
        const tempFile = selectedFile; // Save in case of error
        
        setInputText("");
        setSelectedFile(null);
        setFilePreviewUrl(null);

        try {
            if (tempFile) {
                // SEND MEDIA
                const formData = new FormData();
                formData.append('to', activeUserNumber);
                formData.append('file', tempFile);
                if (tempText) formData.append('messageBody', tempText);
                
                // Determine if it's an image or document
                const isImage = tempFile.type.startsWith('image/');
                formData.append('mediaType', isImage ? 'image' : 'document');

                await axios.post(`${API_BASE}/send-media`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            } else {
                // SEND STANDARD TEXT
                await axios.post(`${API_BASE}/send`, {
                    to: activeUserNumber,
                    messageBody: tempText
                });
            }
        } catch (error) {
            console.error("Failed to send message:", error);
            // Revert UI if it fails
            setInputText(tempText);
            if (tempFile) {
                setSelectedFile(tempFile);
                if (tempFile.type.startsWith('image/')) setFilePreviewUrl(URL.createObjectURL(tempFile));
            }
            showToast("Failed to send message.", "error");
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const isImage = file.type.startsWith('image/');
            
            // 🚨 META API LIMITS: 5MB for images, 100MB for documents
            const maxSizeMB = isImage ? 5 : 100; 
            const maxSizeBytes = maxSizeMB * 1024 * 1024;

            if (file.size > maxSizeBytes) {
                showToast(`File too large! WhatsApp limits ${isImage ? 'images to 5MB' : 'documents to 100MB'}.`, "error"); // 🚨 TOAST
                e.target.value = ''; // Reset the input
                return;
            }

            setSelectedFile(file);
            
            // If it's an image, create a tiny preview url
            if (isImage) {
                setFilePreviewUrl(URL.createObjectURL(file));
            } else {
                setFilePreviewUrl(null);
            }
        }
    };

    const handleAddContact = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanedNum = cleanNum(newContactPhone);
        if (!cleanedNum) return;
        setIsAddingContact(true);

        try {
            const res = await axios.post(`${API_BASE}/contacts`, {
                name: newContactName || cleanedNum,
                phoneNumber: cleanedNum
            });
            await fetchContacts();
            if (res.data && res.data._id) {
                setSelectedContactId(res.data._id);
                showToast("Contact added successfully!", "success");
            }
        } catch (error) {
            console.error("Failed to save new contact:", error);
            showToast("Failed to save contact. Please check your connection.", "error");
        } finally {
            setShowNewContactModal(false);
            setNewContactName("");
            setNewContactPhone("");
            setIsAddingContact(false);
        }
    };

    const handleUpdateLeadStatus = async (newStatus: string) => {
        if (!activeLead || !activeContact) return;
        setIsUpdatingLead(true);
        try {
            const res = await axios.put(`${API_BASE}/leads/${activeLead._id}/status`, {
                status: newStatus
            });
            setActiveLead(res.data);
        } catch (error) {
            console.error("Failed to update lead status:", error);
            showToast("Failed to update lead status.", "error");
        } finally {
            setIsUpdatingLead(false);
        }
    };

    // 🚨 NEW: The Pre-Flight Interceptor
    const initiateTemplateSend = (template: any) => {
        if (!activeContact) return;
        
        // If template has variables, open the modal!
        if (template.variableCount && template.variableCount > 0) {
            setPendingTemplate(template);
            setTemplateVariables(new Array(template.variableCount).fill(""));
        } else {
            // No variables? Send instantly!
            executeTemplateSend(template, []);
        }
    };

    // 🚨 UPDATED: The actual execution function
    const executeTemplateSend = async (template: any, vars: string[]) => {
        setIsSendingTemplate(true);
        try {
            await axios.post(`${API_BASE}/send-template`, {
                to: activeContact?.phoneNumber,
                templateName: template.metaName,
                headerUrl: template.headerImageUrl,
                languageCode: template.language || "en",
                variables: vars // Send the filled-in array!
            });
            setPendingTemplate(null); // Close modal on success
        } catch (err) {
            console.error("Failed to send template:", err);
            showToast("Failed to send template. Please check your connection and template configuration.", "error");
        } finally {
            setIsSendingTemplate(false);
        }
    };

    const handleSyncTemplates = async () => {
        setIsSyncing(true);
        try {
            const res = await axios.post(`${API_BASE}/templates/sync`);
            await fetchAllTemplates(); 
            showToast(res.data.message || "Templates synced from Meta successfully!", "success");
        } catch (error) {
            console.error("Sync Error:", error);
            showToast("Failed to sync templates. Make sure your WABA_ID is set in the backend.", "error");
        } finally {
            setIsSyncing(false);
        }
    };

    const handleSaveTemplateConfig = async (template: any) => {
        setUpdatingTemplateId(template._id);
        try {
            await axios.post(`${API_BASE}/templates`, {
                displayName: template.displayName,
                metaName: template.metaName,
                language: template.language,
                headerImageUrl: template.headerImageUrl,
                buttonColor: template.buttonColor,
                variableCount: Number(template.variableCount) || 0,
                isVisible: template.isVisible !== false, 
                sortOrder: Number(template.sortOrder) || 0
            });
            await fetchAllTemplates();
            await fetchReadyTemplates(); 
        } catch (error) {
            console.error("Save Template Error:", error);
            showToast("Failed to save template configuration. Please check your input and try again.", "error");
        } finally {
            setUpdatingTemplateId(null);
        }
    };

    const formatLastSeen = (dateString: string) => {
        if (!dateString) return "";
        const date = new Date(dateString);
        const now = new Date();
        if (date.toDateString() === now.toDateString()) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        const yesterday = new Date();
        yesterday.setDate(now.getDate() - 1);
        if (date.toDateString() === yesterday.toDateString()) {
            return "Yesterday";
        }
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    const formatMessageDate = (dateString: string | Date) => {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) return "Today";
        if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: today.getFullYear() !== date.getFullYear() ? 'numeric' : undefined });
    };

    return (
        <>
            <div className="flex h-full w-full bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 relative">
                
                {/* LEFT SIDEBAR */}
                <div className={`
                    ${selectedContactId ? 'hidden' : 'flex'} 
                    w-full md:w-80 md:flex bg-slate-50 border-r border-gray-100 flex-col shrink-0
                `}>
                    <div className="p-4 border-b border-gray-100 bg-white">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-lg font-display font-bold text-brand-blue">Live Support</h2>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setShowTemplateManager(true)}
                                    className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-brand-blue hover:text-white active:scale-95 transition-all"
                                    title="Template Manager"
                                >
                                    <Settings size={16} />
                                </button>
                                <button 
                                    onClick={() => setShowNewContactModal(true)}
                                    className="w-8 h-8 rounded-full bg-brand-blue text-white flex items-center justify-center shadow-md hover:bg-blue-700 active:scale-95 transition-all"
                                >
                                    <Plus size={18} strokeWidth={2.5} />
                                </button>
                            </div>
                        </div>
                        
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input 
                                type="text" 
                                placeholder="Search contacts..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-slate-100 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-blue/20 transition-all" 
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 gap-2 flex flex-col">
                        {contacts
                            .filter(c => 
                                c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                c.phoneNumber?.includes(searchTerm)
                            )
                            .map((contact) => (
                                <button 
                                    key={contact._id}
                                    onClick={() => {
                                        setSelectedContactId(contact._id);
                                        setContacts(prev => prev.map(c => 
                                            c._id === contact._id ? { ...c, unreadCount: 0 } : c
                                        ));
                                        axios.post(`${API_BASE}/contacts/reset-unread/${contact._id}`).catch(() => {});
                                    }}
                                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all border ${
                                        selectedContactId === contact._id 
                                        ? 'bg-white border-brand-blue/20 shadow-sm' 
                                        : 'bg-transparent border-transparent hover:bg-slate-100'
                                    }`}
                                >
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0 ${
                                        selectedContactId === contact._id ? 'bg-brand-blue' : 'bg-slate-300'
                                    }`}>
                                        {contact.name?.charAt(0) || "U"}
                                    </div>
                                    
                                    <div className="flex-1 overflow-hidden text-left">
                                        <h4 className={`text-sm font-bold truncate ${selectedContactId === contact._id ? 'text-slate-800' : 'text-slate-600'}`}>
                                            {contact.name || "Unknown"}
                                        </h4>
                                        <p className="text-xs text-slate-400 truncate">
                                            {contact.lastMessage || "No messages yet"}
                                        </p>
                                    </div>

                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                        <div className="text-[10px] text-slate-400 whitespace-nowrap">
                                            {formatLastSeen(contact.lastSeen || contact.updatedAt)}
                                        </div>
                                        {(contact.unreadCount || 0) > 0 && selectedContactId !== contact._id && (
                                            <div className="bg-brand-orange text-white text-[10px] font-bold min-w-4.5 h-4.5 px-1 rounded-full flex items-center justify-center shadow-sm">
                                                {contact.unreadCount}
                                            </div>
                                        )}
                                    </div>
                                </button>
                            ))}
                    </div>
                </div>

                {/* RIGHT CHAT AREA */}
                <div className={`
                    ${!selectedContactId ? 'hidden' : 'flex'} 
                    flex-1 flex-col bg-white relative w-full md:flex
                `}>
                    <div className="h-16 px-4 md:px-6 border-b border-gray-100 flex items-center bg-white z-10 shrink-0 gap-3">
                        {/* Back Button (Mobile) */}
                        <button 
                            onClick={() => setSelectedContactId("")}
                            className="md:hidden p-2 -ml-2 text-slate-400 hover:bg-slate-100 rounded-full shrink-0"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        
                        {/* 🚨 ADDED shrink-0 HERE */}
                        <div className="w-10 h-10 rounded-full bg-brand-blue text-white flex items-center justify-center shadow-md font-bold shrink-0">
                            {activeContact?.name?.charAt(0) || "?"}
                        </div>
                        
                        {/* 🚨 CHANGED TO flex-1 min-w-0 */}
                        <div className="flex items-center justify-between flex-1 min-w-0">
                            <div className="min-w-0 truncate">
                                <h3 className="font-bold text-slate-800 leading-tight truncate">
                                    {activeContact?.name || "Select a Chat"}
                                </h3>
                                <div className="flex items-center gap-1 text-xs text-brand-orange font-medium mt-0.5">
                                    <Phone size={10} /> {activeUserNumber ? `+${activeUserNumber}` : "Invalid Contact Info"}
                                </div>
                            </div>
                            
                            {/* LEAD STATUS DROPDOWN */}
                            {activeLead && (
                                <div className="ml-2 md:ml-8 relative shrink-0">
                                    {isUpdatingLead ? (
                                        <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 bg-slate-100 rounded-lg flex items-center gap-1">
                                            <Loader2 size={12} className="animate-spin" /> SAVING...
                                        </div>
                                    ) : (
                                        <select 
                                            value={activeLead.status || "New"}
                                            onChange={(e) => handleUpdateLeadStatus(e.target.value)}
                                            className={`appearance-none cursor-pointer pl-3 pr-8 py-1.5 text-[10px] md:text-xs font-bold uppercase tracking-wider rounded-lg border outline-none shadow-sm transition-all ${
                                                activeLead.status === 'Converted' ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' :
                                                activeLead.status === 'Lost' ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100' :
                                                activeLead.status === 'Trial Scheduled' ? 'bg-brand-blue/10 text-brand-blue border-brand-blue/20 hover:bg-brand-blue/20' :
                                                'bg-orange-50 text-brand-orange border-orange-200 hover:bg-orange-100'
                                            }`}
                                        >
                                            <option value="New">New Lead</option>
                                            <option value="Contacted">Contacted</option>
                                            <option value="Trial Scheduled">Trial Scheduled</option>
                                            <option value="Converted">Converted 🎉</option>
                                            <option value="Lost">Lost</option>
                                        </select>
                                    )}
                                    {!isUpdatingLead && (
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-current opacity-50">
                                            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* CHAT MESSAGES AREA */}
                    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 relative">
                        {messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                                <Sparkles size={40} className="text-slate-200" />
                                <p className="text-sm font-medium">No messages yet. Send a template to start the conversation!</p>
                            </div>
                        ) : (
                            /* 1. GROUP MESSAGES BY DATE FIRST */
                            Object.entries(
                                messages.reduce((acc: Record<string, typeof messages>, msg) => {
                                    const dateLabel = formatMessageDate(msg.timestamp);
                                    if (!acc[dateLabel]) acc[dateLabel] = [];
                                    acc[dateLabel].push(msg);
                                    return acc;
                                }, {})
                            ).map(([dateLabel, dayMessages]) => (
                                /* 2. CREATE A WRAPPER FOR EACH DAY */
                                <div key={dateLabel} className="flex flex-col gap-3 relative">
                                    
                                    {/* 3. THE TRUE STICKY DATE BADGE */}
                                    {/* Using top-0 with padding ensures smooth pushing without jumping */}
                                    <div className="sticky top-0 z-20 flex justify-center w-full pt-2 pb-1">
                                        <div className="bg-slate-900/40 backdrop-blur-md shadow-sm border border-white/10 text-white text-[11px] font-bold px-3 py-1 rounded-full tracking-wide">
                                            {dateLabel}
                                        </div>
                                    </div>

                                    {/* 4. RENDER MESSAGES FOR THIS SPECIFIC DAY */}
                                    {dayMessages.map((msg, index) => {
                                        const isOutgoing = msg.direction === 'outgoing';
                                        const msgTime = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                        const dlvTime = msg.deliveredAt ? new Date(msg.deliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
                                        const readTime = msg.readAt ? new Date(msg.readAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

                                        return (
                                            <React.Fragment key={msg.wa_id || index}>
                                                {/* 🚨 REMOVED THE OLD showDateSeparator BLOCK FROM HERE 🚨 */}
                                                
                                                <div className={`flex w-full ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
                                                    
                                                    {!isOutgoing && (
                                                        <div className="flex items-center gap-2 group max-w-[85%] md:max-w-[70%]">
                                                            <div className="p-3.5 shadow-sm text-sm rounded-2xl bg-white text-slate-800 border border-gray-100 rounded-tl-sm overflow-hidden w-full">
                                                                
                                                                {/* 🚨 MEDIA RENDERER */}
                                                                {msg.messageType === 'image' && msg.mediaUrl && (
                                                                    <div className="mb-2 -mx-1 -mt-1 rounded-xl overflow-hidden bg-slate-100">
                                                                        <img src={msg.mediaUrl} alt="Received Media" className="w-full h-auto object-cover max-h-64" />
                                                                    </div>
                                                                )}
                                                                
                                                                {msg.messageType === 'document' && msg.mediaUrl && (
                                                                    <a href={msg.mediaUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 mb-2 p-3 bg-blue-50 text-brand-blue rounded-xl font-bold hover:bg-blue-100 transition">
                                                                        📄 View Document
                                                                    </a>
                                                                )}

                                                                <p className="leading-relaxed whitespace-pre-wrap">{msg.messageBody}</p>
                                                                <p className="text-[10px] mt-1 text-slate-400 text-left">{msgTime}</p>
                                                            </div>

                                                            {/* 🚨 THE TASK TRIGGER BUTTON */}
                                                            {msg.messageBody && msg.messageBody.trim() !== "" && (
                                                                <button 
                                                                    onClick={() => handleOpenTaskModal(msg.messageBody)}
                                                                    className="opacity-0 group-hover:opacity-100 bg-white border border-slate-200 shadow-sm p-2 rounded-full text-brand-blue hover:bg-brand-blue hover:text-white transition-all shrink-0"
                                                                    title="Convert to Task"
                                                                >
                                                                    <Clock size={16} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}

                                                    {isOutgoing && (
                                                        <div className="flex items-center gap-2 group max-w-[85%] md:max-w-[75%] justify-end">
                                                            
                                                            {/* 🚨 THE TASK TRIGGER BUTTON (Left side for outgoing messages) */}
                                                            {msg.messageBody && msg.messageBody.trim() !== "" && msg.messageBody !== "[Sent image]" && (
                                                                <button 
                                                                    onClick={() => handleOpenTaskModal(msg.messageBody)}
                                                                    className="opacity-0 group-hover:opacity-100 bg-white border border-slate-200 shadow-sm p-2 rounded-full text-brand-blue hover:bg-brand-blue hover:text-white transition-all shrink-0"
                                                                    title="Convert to Task"
                                                                >
                                                                    <Clock size={16} />
                                                                </button>
                                                            )}

                                                            {/* The Blue Message Bubble */}
                                                            <div className="flex flex-col items-end w-full">
                                                                <div className="p-3.5 shadow-sm text-sm rounded-2xl bg-brand-blue text-white rounded-tr-sm w-full overflow-hidden">
                                                                    
                                                                    {/* 🚨 OUTGOING MEDIA RENDERER */}
                                                                    {msg.messageType === 'image' && msg.mediaUrl && (
                                                                        <div className="mb-2 -mx-1 -mt-1 rounded-xl overflow-hidden bg-blue-900/30">
                                                                            <img src={msg.mediaUrl} alt="Sent Media" className="w-full h-auto object-cover max-h-64" />
                                                                        </div>
                                                                    )}
                                                                    
                                                                    {msg.messageType === 'document' && msg.mediaUrl && (
                                                                        <a href={msg.mediaUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 mb-2 p-3 bg-white/20 text-white rounded-xl font-bold hover:bg-white/30 transition">
                                                                            📄 View Document
                                                                        </a>
                                                                    )}

                                                                    {/* Only show the paragraph tag if there's actually a text caption */}
                                                                    {msg.messageBody && msg.messageBody.trim() !== "" && msg.messageBody !== "[Sent image]" && (
                                                                        <p className="leading-relaxed whitespace-pre-wrap">{msg.messageBody}</p>
                                                                    )}
                                                                </div>
                                                                
                                                                <div className="flex items-center gap-1.5 mt-1.5 text-[10px] font-medium tracking-wide">
                                                                    <span className="text-slate-400">Sent {msgTime}</span>
                                                                    
                                                                    {dlvTime && (
                                                                        <>
                                                                            <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                                                            <span className="text-slate-500">Dlv {dlvTime}</span>
                                                                        </>
                                                                    )}
                                                                    
                                                                    {readTime && (
                                                                        <>
                                                                            <span className="w-1 h-1 bg-brand-orange rounded-full"></span>
                                                                            <span className="text-brand-orange">Read {readTime}</span>
                                                                        </>
                                                                    )}

                                                                    {msg.status === 'failed' && (
                                                                        <>
                                                                            <span className="w-1 h-1 bg-rose-500 rounded-full"></span>
                                                                            <span className="text-rose-500">Failed</span>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </React.Fragment>
                                        );
                                    })}
                                </div>
                            ))
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* TEMPLATE BUTTONS */}
                    <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex gap-2 overflow-x-auto no-scrollbar whitespace-nowrap shrink-0">
                        {templates.filter(t => t.isVisible !== false).length === 0 ? (
                            <p className="text-xs text-slate-400 italic py-2">No active templates. Configure them in Template Manager!</p>
                        ) : (
                            templates
                                // 🚨 1. Filter out hidden templates
                                .filter((tpl) => tpl.isVisible !== false)
                                
                                // 🚨 2. Sort by the custom order number (0, 1, 2, 3...)
                                .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
                                
                                // 3. Render the buttons
                                .map((tpl) => (
                                    <button
                                        key={tpl._id}
                                        onClick={() => initiateTemplateSend(tpl)} 
                                        disabled={isSendingTemplate || !activeUserNumber}
                                        className={`px-4 py-2 text-xs font-bold border rounded-xl transition disabled:opacity-50 shadow-sm ${
                                            tpl.buttonColor === 'green' ? 'bg-green-50 text-green-600 border-green-100 hover:bg-green-100' :
                                            tpl.buttonColor === 'orange' ? 'bg-orange-50 text-brand-orange border-orange-100 hover:bg-orange-100' :
                                            'bg-blue-50 text-brand-blue border-blue-100 hover:bg-blue-100'
                                        }`}
                                    >
                                        {isSendingTemplate && pendingTemplate?._id === tpl._id ? "Sending..." : tpl.displayName}
                                    </button>
                                ))
                        )}
                    </div>

                    {/* 🚨 THE UPGRADED CHAT INPUT FORM */}
                    <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-100 shrink-0 flex flex-col gap-2 relative">
                        
                        {/* Selected File Preview Box */}
                        {selectedFile && (
                            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 p-2 rounded-xl mb-1 w-full max-w-sm animate-in fade-in slide-in-from-bottom-2">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    {filePreviewUrl ? (
                                        <img src={filePreviewUrl} alt="Preview" className="w-10 h-10 object-cover rounded-lg border border-slate-200" />
                                    ) : (
                                        <div className="w-10 h-10 bg-brand-blue/10 text-brand-blue rounded-lg flex items-center justify-center">
                                            <FileText size={20} />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-slate-700 truncate">{selectedFile.name}</p>
                                        <p className="text-[10px] text-slate-400">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                    </div>
                                </div>
                                <button type="button" onClick={() => { setSelectedFile(null); setFilePreviewUrl(null); }} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition">
                                    <X size={16} />
                                </button>
                            </div>
                        )}

                        <div className="relative flex items-center w-full">
                            {/* Hidden File Input */}
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                onChange={handleFileSelect} 
                                className="hidden" 
                                accept="image/*,application/pdf,.doc,.docx"
                            />
                            
                            {/* Attachment Button */}
                            <button 
                                type="button" 
                                onClick={() => fileInputRef.current?.click()}
                                disabled={!activeUserNumber}
                                className="absolute left-1.5 w-10 h-10 flex items-center justify-center text-slate-400 hover:text-brand-blue hover:bg-blue-50 rounded-full transition-all disabled:opacity-50 z-10"
                            >
                                <Paperclip size={20} />
                            </button>

                            <input 
                                type="text" 
                                value={inputText} 
                                onChange={(e) => setInputText(e.target.value)} 
                                placeholder={activeUserNumber ? "Type a message or attach file..." : "Select a valid contact to chat"}
                                disabled={!activeUserNumber}
                                className="w-full bg-slate-50 border border-gray-200 py-3.5 pl-12 pr-28 rounded-full text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10 transition-all disabled:opacity-50"
                            />
                            
                            <button 
                                type="submit" 
                                disabled={(!inputText.trim() && !selectedFile) || !activeUserNumber} 
                                className="absolute right-1.5 flex items-center gap-2 bg-brand-blue text-white px-5 py-2.5 rounded-full font-bold text-sm hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 shadow-sm"
                            >
                                <span>Send</span>
                                <Send size={16} />
                            </button>
                        </div>
                    </form>
                    
                </div>
            </div>

            {/* 🚨 NEW: PRE-FLIGHT VARIABLES MODAL */}
            {pendingTemplate && (
                <div className="fixed inset-0 z-2000 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2000 p-6 w-full max-w-sm shadow-2xl animate-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-800">Complete Template</h3>
                            <button onClick={() => setPendingTemplate(null)} className="text-slate-400 hover:bg-slate-100 p-2 rounded-full transition">
                                <X size={20}/>
                            </button>
                        </div>
                        
                        <p className="text-sm text-slate-500 mb-6">This template requires {pendingTemplate.variableCount} custom variables.</p>

                        <div className="space-y-5">
                            {Array.from({ length: pendingTemplate.variableCount }).map((_, i) => (
                                <div key={i}>
                                    <div className="flex justify-between items-center mb-1.5">
                                        <label className="text-xs font-bold text-slate-500 uppercase ml-1">Variable {`{{${i + 1}}}`}</label>
                                        
                                        {/* Auto-Fill Button */}
                                        <button 
                                            type="button"
                                            onClick={() => {
                                                const newVars = [...templateVariables];
                                                newVars[i] = activeContact?.name || "";
                                                setTemplateVariables(newVars);
                                            }}
                                            className="text-[10px] font-bold text-brand-blue bg-blue-50 px-2 py-1 rounded-lg flex items-center gap-1 hover:bg-blue-100 transition"
                                        >
                                            <UserPlus size={12} /> Auto-fill Contact Name
                                        </button>
                                    </div>
                                    
                                    <input 
                                        type="text" 
                                        value={templateVariables[i] || ""}
                                        onChange={(e) => {
                                            const newVars = [...templateVariables];
                                            newVars[i] = e.target.value;
                                            setTemplateVariables(newVars);
                                        }}
                                        placeholder={`Enter text for {{${i + 1}}}`}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10 transition-all" 
                                    />
                                </div>
                            ))}
                            
                            <div className="pt-4">
                                <button 
                                    onClick={() => executeTemplateSend(pendingTemplate, templateVariables)}
                                    disabled={isSendingTemplate || templateVariables.some(v => !v.trim())}
                                    className="w-full py-3.5 bg-brand-blue text-white font-black rounded-xl shadow-lg shadow-blue-500/30 hover:bg-blue-700 disabled:opacity-50 active:scale-95 transition-all flex justify-center items-center gap-2"
                                >
                                    {isSendingTemplate ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send size={18}/> SEND NOW</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ADD CONTACT MODAL */}
            {showNewContactModal && (
                <div className="absolute inset-0 z-2000 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-4xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-800">Start New Chat</h3>
                            <button onClick={() => setShowNewContactModal(false)} className="text-slate-400 hover:bg-slate-100 p-2 rounded-full transition">
                                <X size={20}/>
                            </button>
                        </div>
                        
                        <form onSubmit={handleAddContact} className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Contact Name <span className="text-slate-300 capitalize">(Optional)</span></label>
                                <input 
                                    type="text" 
                                    value={newContactName} 
                                    onChange={e => setNewContactName(e.target.value)} 
                                    placeholder="e.g. John Doe" 
                                    className="w-full mt-1.5 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10 transition-all" 
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase ml-1">WhatsApp Number</label>
                                <input 
                                    type="text" 
                                    value={newContactPhone} 
                                    onChange={e => setNewContactPhone(e.target.value)} 
                                    placeholder="Include country code (e.g. 919876543210)" 
                                    required 
                                    className="w-full mt-1.5 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10 transition-all" 
                                />
                            </div>
                            
                            <div className="pt-4">
                                <button 
                                    type="submit" 
                                    disabled={isAddingContact || !newContactPhone} 
                                    className="w-full py-3.5 bg-brand-blue text-white font-black rounded-xl shadow-lg shadow-blue-500/30 hover:bg-blue-700 disabled:opacity-50 active:scale-95 transition-all flex justify-center items-center"
                                >
                                    {isAddingContact ? <Loader2 className="w-5 h-5 animate-spin" /> : "START CHAT"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* TEMPLATE MANAGER MODAL */}
            {showTemplateManager && (
                /* 🚨 1. fixed on mobile (to beat nav), absolute on desktop (to center in CRM window) */
                <div className="fixed md:absolute inset-0 z-9999 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 md:pb-10 md:p-10">
                    
                    <div className="bg-white rounded-2xl md:rounded-4xl w-full max-w-4xl max-h-[78dvh] h-full md:h-[85vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in duration-200">
                        
                        {/* 🚨 2. FLEX-WRAP HEADER: Perfect on desktop, automatically stacks Sync on mobile */}
                        <div className="p-4 md:px-8 md:py-6 border-b border-gray-100 flex flex-wrap items-center gap-y-4 gap-x-4 bg-white shrink-0">
                            
                            {/* Title Block */}
                            <div className="flex-1 min-w-50 order-1">
                                <h2 className="text-xl md:text-2xl font-display font-bold text-slate-800">Template Manager</h2>
                                <p className="text-xs md:text-sm text-slate-500 mt-1">Sync from Meta and configure Cloudinary URLs.</p>
                            </div>

                            {/* Sync Button (Moves to bottom row on mobile, middle-right on desktop) */}
                            <div className="w-full md:w-auto order-3 md:order-2 flex">
                                <button 
                                    onClick={handleSyncTemplates}
                                    disabled={isSyncing}
                                    className="w-full md:w-auto flex items-center justify-center gap-2 bg-brand-orange text-white px-5 py-2.5 rounded-xl font-bold hover:bg-orange-600 transition disabled:opacity-50 shadow-md"
                                >
                                    <RefreshCw size={16} className={isSyncing ? "animate-spin" : ""} />
                                    {isSyncing ? "Syncing..." : "Sync Meta"}
                                </button>
                            </div>
                            
                            {/* Close Button (Stays top-right on both mobile and desktop) */}
                            <button 
                                onClick={() => setShowTemplateManager(false)} 
                                className="order-2 md:order-3 ml-auto md:ml-0 text-slate-400 hover:bg-slate-100 p-2 rounded-full transition shrink-0"
                            >
                                <X size={24}/>
                            </button>
                        </div>

                        {/* Body List */}
                        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/50 space-y-4 md:space-y-6">
                            {allTemplates.length === 0 ? (
                                <div className="text-center py-20">
                                    <Sparkles size={48} className="mx-auto mb-4 text-brand-blue/20" />
                                    <h3 className="text-lg font-bold text-slate-700">No Templates Found</h3>
                                    <p className="text-slate-500 mt-2">Click "Sync Meta" to pull your approved templates from WhatsApp.</p>
                                </div>
                            ) : (
                                allTemplates.map((tpl) => (
                                    <div key={tpl._id} className="bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 md:gap-6 items-start">
                                        
                                        {/* Left Side: Basic Info */}
                                        <div className="w-full md:w-1/3">
                                            <div className="flex items-center gap-2 mb-2">
                                                <h3 className="font-bold text-slate-800 text-lg">{tpl.metaName}</h3>
                                                {tpl.isConfigured ? (
                                                    <span className="bg-green-100 text-green-700 text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle2 size={12}/> Ready</span>
                                                ) : (
                                                    <span className="bg-yellow-100 text-yellow-700 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">Setup Needed</span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-400 uppercase font-bold tracking-widest mb-4">Meta Status: {tpl.metaStatus}</p>
                                            
                                            {tpl.requiresImage && (
                                                <div className="w-full h-32 bg-slate-100 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden">
                                                    {tpl.headerImageUrl ? (
                                                        <img src={tpl.headerImageUrl} alt="Header Preview" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="text-xs text-slate-400 font-bold">No Image Provided</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Right Side: Edit Form */}
                                        <div className="flex-1 w-full space-y-4">
                                            <div className="flex gap-3">
                                                {/* Display Name */}
                                                <div className="flex-1">
                                                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Button Name</label>
                                                    <input 
                                                        type="text" 
                                                        value={tpl.displayName} 
                                                        onChange={(e) => setAllTemplates(prev => prev.map(t => t._id === tpl._id ? { ...t, displayName: e.target.value } : t))}
                                                        className="w-full mt-1.5 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10" 
                                                    />
                                                </div>
                                                
                                                {/* Variables */}
                                                <div className="w-20 shrink-0">
                                                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Vars</label>
                                                    <input 
                                                        type="number" min="0" max="5"
                                                        value={tpl.variableCount || 0} 
                                                        onChange={(e) => setAllTemplates(prev => prev.map(t => t._id === tpl._id ? { ...t, variableCount: parseInt(e.target.value) || 0 } : t))}
                                                        className="w-full mt-1.5 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-blue text-center" 
                                                    />
                                                </div>

                                                {/* 🚨 NEW: Sort Order */}
                                                <div className="w-20 shrink-0">
                                                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Order</label>
                                                    <input 
                                                        type="number" min="0"
                                                        value={tpl.sortOrder || 0} 
                                                        onChange={(e) => setAllTemplates(prev => prev.map(t => t._id === tpl._id ? { ...t, sortOrder: parseInt(e.target.value) || 0 } : t))}
                                                        className="w-full mt-1.5 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-blue text-center font-bold text-brand-blue" 
                                                    />
                                                </div>
                                            </div>

                                            {tpl.requiresImage && (
                                                <div>
                                                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Cloudinary Image URL</label>
                                                    <input 
                                                        type="text" 
                                                        value={tpl.headerImageUrl} 
                                                        onChange={(e) => setAllTemplates(prev => prev.map(t => t._id === tpl._id ? { ...t, headerImageUrl: e.target.value } : t))}
                                                        placeholder="https://res.cloudinary.com/..." 
                                                        className="w-full mt-1.5 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10" 
                                                    />
                                                </div>
                                            )}
                                            
                                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pt-2 gap-4 border-t border-slate-100 mt-2">
                                                <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
                                                    
                                                    {/* Button Color */}
                                                    <div className="flex items-center gap-2">
                                                        <label className="text-xs font-bold text-slate-500 uppercase">Color:</label>
                                                        <select 
                                                            value={tpl.buttonColor}
                                                            onChange={(e) => setAllTemplates(prev => prev.map(t => t._id === tpl._id ? { ...t, buttonColor: e.target.value } : t))}
                                                            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-sm outline-none cursor-pointer"
                                                        >
                                                            <option value="blue">Blue</option>
                                                            <option value="green">Green</option>
                                                            <option value="orange">Orange</option>
                                                        </select>
                                                    </div>

                                                    {/* 🚨 NEW: Visibility Toggle Checkbox */}
                                                    <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 transition">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={tpl.isVisible !== false} // Default to true
                                                            onChange={(e) => setAllTemplates(prev => prev.map(t => t._id === tpl._id ? { ...t, isVisible: e.target.checked } : t))}
                                                            className="w-4 h-4 text-brand-blue rounded border-slate-300 focus:ring-brand-blue cursor-pointer"
                                                        />
                                                        <span className="text-xs font-bold text-slate-700 uppercase">Show in Chat</span>
                                                    </label>

                                                </div>

                                                <button 
                                                    onClick={() => handleSaveTemplateConfig(tpl)}
                                                    disabled={updatingTemplateId === tpl._id}
                                                    className="w-full sm:w-auto justify-center bg-brand-blue text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-700 transition shadow-md disabled:opacity-50 flex items-center gap-2"
                                                >
                                                    {updatingTemplateId === tpl._id ? <Loader2 size={16} className="animate-spin" /> : "Save Config"}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* 🗓️ ADVANCED TASK & CALENDAR MODAL */}
            {showTaskModal && (
                <div className="fixed inset-0 z-10000 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    
                    {/* 🚨 CHANGED: max-w-md becomes md:max-w-3xl for landscape desktop view */}
                    <div className="bg-white rounded-2xl md:rounded-4xl w-full max-w-md md:max-w-3xl overflow-hidden shadow-2xl animate-in zoom-in duration-200">
                        
                        {/* Header */}
                        <div className="p-4 md:p-6 border-b border-gray-100 flex justify-between items-center bg-brand-blue text-white">
                            <div className="flex items-center gap-2">
                                <Clock size={20} />
                                <h3 className="text-lg font-bold">Schedule Task</h3>
                            </div>
                            <button onClick={() => setShowTaskModal(false)} className="hover:bg-white/20 p-1.5 rounded-full transition">
                                <X size={20}/>
                            </button>
                        </div>

                        <div className="p-4 md:p-6">
                            
                            {/* 🚨 NEW: 2-Column Grid on Desktop, 1-Column on Mobile */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6">
                                
                                {/* LEFT COLUMN */}
                                <div className="space-y-4 flex flex-col">
                                    {/* Title */}
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Task Title</label>
                                        <input 
                                            type="text" 
                                            value={taskData.title}
                                            onChange={(e) => setTaskData({...taskData, title: e.target.value})}
                                            className="w-full mt-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-blue" 
                                        />
                                    </div>

                                    {/* Task Details (The Message) */}
                                    <div className="flex-1 flex flex-col">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Task Details</label>
                                        <textarea 
                                            value={taskData.description}
                                            onChange={(e) => setTaskData({...taskData, description: e.target.value})}
                                            className="w-full mt-1 flex-1 min-h-30 md:min-h-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-blue resize-none text-sm text-slate-700" 
                                        />
                                    </div>
                                </div>

                                {/* RIGHT COLUMN */}
                                <div className="space-y-4">
                                    {/* Date & Time (Parsed from message) */}
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Due Date & Time</label>
                                        <input 
                                            type="datetime-local" 
                                            value={taskData.dueDate}
                                            onChange={(e) => setTaskData({...taskData, dueDate: e.target.value})}
                                            className="w-full mt-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-blue font-bold text-brand-blue" 
                                        />
                                    </div>

                                    {/* Assign Team Member */}
                                    {/* 🚨 UPGRADED: Instagram-Style Team Assignment Search */}
                                    <div className="relative">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Assign Team Members</label>
                                        
                                        <div className="relative mt-1">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                            <input 
                                                type="text" 
                                                value={teamSearch}
                                                onChange={(e) => {
                                                    setTeamSearch(e.target.value);
                                                    setShowTeamDropdown(true);
                                                }}
                                                onFocus={() => setShowTeamDropdown(true)}
                                                onBlur={() => setTimeout(() => setShowTeamDropdown(false), 200)}
                                                placeholder="Search name or @username..."
                                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-blue transition-all" 
                                            />
                                        </div>

                                        {/* Floating Instagram-Style Dropdown */}
                                        {showTeamDropdown && teamSearch.trim() !== "" && (
                                            <div className="absolute z-100 w-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl max-h-48 overflow-y-auto custom-scrollbar p-1 animate-in fade-in slide-in-from-top-2">
                                                {teamMembers.filter(m => 
                                                    !taskData.assignedStaff.includes(m.username) && 
                                                    (m.name.toLowerCase().includes(teamSearch.toLowerCase()) || 
                                                     m.username.toLowerCase().includes(teamSearch.toLowerCase()))
                                                ).length === 0 ? (
                                                    <div className="p-4 text-center text-xs text-gray-400 font-medium">No team members found.</div>
                                                ) : (
                                                    teamMembers.filter(m => 
                                                        !taskData.assignedStaff.includes(m.username) && 
                                                        (m.name.toLowerCase().includes(teamSearch.toLowerCase()) || 
                                                         m.username.toLowerCase().includes(teamSearch.toLowerCase()))
                                                    ).map(staff => (
                                                        <div 
                                                            key={staff._id}
                                                            // 🚨 CRITICAL FIX: onMouseDown stops the input's onBlur from killing the click!
                                                            onMouseDown={(e) => {
                                                                e.preventDefault(); 
                                                                // We save their unique USERNAME, not their display name
                                                                setTaskData(prev => ({...prev, assignedStaff: [...prev.assignedStaff, staff.username]}));
                                                                setTeamSearch("");
                                                                setShowTeamDropdown(false);
                                                            }}
                                                            className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors group"
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                {/* 🚨 Profile Picture or Fallback Initial */}
                                                                {staff.photo ? (
                                                                    <img src={staff.photo} alt={staff.name} className="w-8 h-8 rounded-full object-cover shadow-sm border border-slate-200 shrink-0" />
                                                                ) : (
                                                                    <div className="w-8 h-8 rounded-full bg-brand-blue/10 text-brand-blue flex items-center justify-center font-bold text-xs shrink-0 shadow-inner">
                                                                        {staff.name.charAt(0).toUpperCase()}
                                                                    </div>
                                                                )}
                                                                <div className="flex flex-col">
                                                                    <span className="text-sm font-bold text-gray-800 leading-tight">{staff.name}</span>
                                                                    <span className="text-[10px] font-medium text-gray-400">@{staff.username}</span>
                                                                </div>
                                                            </div>
                                                            <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-brand-blue group-hover:text-white transition-all shrink-0">
                                                                <Plus size={12} strokeWidth={3} />
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}

                                        {/* Selected Staff Tags (Premium Pill Design with Avatars) */}
                                        <div className="flex flex-wrap gap-2 mt-3 min-h-7">
                                            {taskData.assignedStaff.length === 0 && (
                                                <span className="text-xs text-slate-400 italic mt-1 ml-1">No one assigned yet</span>
                                            )}
                                            {taskData.assignedStaff.map(username => {
                                                // If it's the default "Me" string
                                                if (username === "Me") {
                                                    return (
                                                        <span key={username} className="bg-brand-blue/10 text-brand-blue pl-3 pr-1.5 py-1 rounded-full text-xs font-bold flex items-center gap-2 border border-brand-blue/20 shadow-sm animate-in zoom-in duration-200">
                                                            Me (Current User)
                                                            <button onClick={() => setTaskData({...taskData, assignedStaff: taskData.assignedStaff.filter(x => x !== username)})} className="w-4 h-4 flex items-center justify-center bg-white rounded-full hover:bg-rose-500 hover:text-white text-brand-blue transition-colors shadow-sm"><X size={10} strokeWidth={3} /></button>
                                                        </span>
                                                    )
                                                }

                                                // Find the actual user object to get their name and photo for the pill
                                                const staff = teamMembers.find(m => m.username === username);
                                                const displayName = staff ? staff.name : username;
                                                const photo = staff?.photo;

                                                return (
                                                    <span key={username} className="bg-white text-slate-700 pl-1 pr-1.5 py-1 rounded-full text-xs font-bold flex items-center gap-2 border border-slate-200 shadow-sm animate-in zoom-in duration-200">
                                                        {photo ? (
                                                            <img src={photo} alt={displayName} className="w-5 h-5 rounded-full object-cover" />
                                                        ) : (
                                                            <div className="w-5 h-5 rounded-full bg-brand-blue/10 text-brand-blue flex items-center justify-center text-[8px] shrink-0">
                                                                {displayName.charAt(0).toUpperCase()}
                                                            </div>
                                                        )}
                                                        {displayName}
                                                        <button 
                                                            onClick={() => setTaskData({...taskData, assignedStaff: taskData.assignedStaff.filter(x => x !== username)})}
                                                            className="w-4 h-4 flex items-center justify-center bg-slate-100 rounded-full hover:bg-rose-500 hover:text-white text-slate-400 transition-colors"
                                                        >
                                                            <X size={10} strokeWidth={3} />
                                                        </button>
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Guests Toggle */}
                                    <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl cursor-pointer hover:bg-slate-100 transition border border-slate-200 mt-2 h-18">
                                        <input 
                                            type="checkbox" 
                                            checked={taskData.addToCalendar}
                                            onChange={(e) => setTaskData({...taskData, addToCalendar: e.target.checked})}
                                            className="w-5 h-5 text-brand-blue rounded-lg"
                                        />
                                        <div>
                                            <p className="text-sm font-bold text-slate-800">Sync to Calendar</p>
                                            <p className="text-[10px] text-slate-500 leading-tight mt-0.5">Adds {activeContact?.name} and assigned staff as guests.</p>
                                        </div>
                                    </label>
                                </div>

                            </div>

                            {/* Full Width Submit Button */}
                            <button 
                                onClick={handleCreateTask}
                                disabled={isCreatingTask}
                                className="w-full py-4 bg-brand-blue text-white font-black rounded-2xl shadow-xl shadow-blue-500/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                            >
                                {isCreatingTask ? <Loader2 size={18} className="animate-spin" /> : "CREATE & SYNC TASK"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* 🍞 FLOATING TOAST NOTIFICATION */}
            {toast.show && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-11000 animate-in fade-in slide-in-from-bottom-8 duration-300 pointer-events-none">
                    <div className={`flex items-center gap-2.5 px-5 py-3.5 rounded-full shadow-2xl border font-bold text-sm tracking-wide ${
                        toast.type === 'success' ? 'bg-green-50 text-green-700 border-green-200 shadow-green-900/10' : 
                        toast.type === 'error' ? 'bg-rose-50 text-rose-700 border-rose-200 shadow-rose-900/10' :
                        'bg-blue-50 text-brand-blue border-blue-200 shadow-blue-900/10'
                    }`}>
                        {toast.type === 'success' && <CheckCircle2 size={20} className="text-green-500" />}
                        {toast.type === 'error' && <AlertCircle size={20} className="text-rose-500" />}
                        {toast.type === 'info' && <Sparkles size={20} className="text-brand-blue" />}
                        {toast.message}
                    </div>
                </div>
            )}
        </>
    );
};

export default WhatsAppChat;