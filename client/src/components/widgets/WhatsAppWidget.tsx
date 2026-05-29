import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    MessageSquare, 
    Search, 
    ExternalLink, 
    Loader2, 
    Send,
    Smartphone
} from 'lucide-react';

interface WhatsAppWidgetProps {
    user?: any;
}

const WhatsAppWidget: React.FC<WhatsAppWidgetProps> = ({ user }) => {
    const navigate = useNavigate();
    const [contacts, setContacts] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    const API_BASE = (import.meta.env.VITE_API || "http://localhost:8080").replace(/\/$/, "");

    // 🚨 INTERNAL NAVIGATION HANDLER
    const handleOpenChat = (id?: string) => {
        // 1. Set the state in localStorage so Dashboard.tsx picks it up
        localStorage.setItem("currentView", "whatsapp-crm");
        localStorage.setItem("activeTab", "WhatsApp Support");
        
        // 2. If a specific contact was clicked, save their ID
        if (id) {
            localStorage.setItem("pendingChatId", id);
        }

        // 3. Navigate to dashboard. Even if you're already there, 
        // Dashboard.tsx has an effect to check localStorage on location changes.
        navigate('/dashboard');
    };

    // 1. FETCH RECENT CONTACTS
    useEffect(() => {
        const fetchContacts = async () => {
            try {
                const token = localStorage.getItem("jwtoken");
                const res = await fetch(`${API_BASE}/contacts`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                
                if (res.ok) {
                    const data = await res.json();
                    const sorted = data.sort((a: any, b: any) => 
                        new Date(b.lastSeen || b.updatedAt).getTime() - new Date(a.lastSeen || a.updatedAt).getTime()
                    );
                    setContacts(sorted);
                }
            } catch (error) {
                console.error("Failed to fetch WhatsApp contacts:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchContacts();
    }, []);

    // 2. FILTER LOGIC
    const filteredContacts = useMemo(() => {
        const base = contacts.filter(c => 
            c.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
            c.phoneNumber?.includes(searchQuery)
        );
        return base.slice(0, 6); 
    }, [contacts, searchQuery]);

    const unreadTotal = useMemo(() => 
        contacts.reduce((acc, curr) => acc + (curr.unreadCount || 0), 0)
    , [contacts]);

    const formatTime = (dateString: string) => {
        if (!dateString) return "";
        const date = new Date(dateString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="flex flex-col h-full relative">
            
            {/* WIDGET HEADER */}
            <div className="flex items-center justify-between mb-4 relative z-10 gap-2 shrink-0">
                <div className="flex items-center gap-2.5 shrink-0">
                    <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center text-green-600 shadow-inner">
                        <Smartphone size={16} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                            WhatsApp
                            {unreadTotal > 0 && (
                                <span className="bg-brand-orange text-white text-[8px] px-1.5 py-0.5 rounded-full animate-pulse">
                                    {unreadTotal} NEW
                                </span>
                            )}
                        </h3>
                    </div>
                </div>
                
                <button 
                    onClick={() => handleOpenChat()} 
                    className="text-[10px] font-bold text-brand-blue hover:underline transition-colors flex items-center gap-1 shrink-0 whitespace-nowrap"
                >
                    Open Chat <ExternalLink size={10} className="mb-0.5" />
                </button>
            </div>

            {/* QUICK SEARCH */}
            <div className="mb-3 shrink-0 relative z-10">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                <input 
                    type="text" 
                    placeholder="Search conversations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-medium text-slate-700 focus:ring-2 focus:ring-green-500/10 focus:border-green-500 outline-none transition-all shadow-sm"
                />
            </div>

            {/* CONTACT LIST */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 relative z-10 flex flex-col gap-2 pb-2">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full min-h-37.5">
                        <Loader2 className="w-6 h-6 text-green-500 animate-spin" />
                    </div>
                ) : filteredContacts.length > 0 ? (
                    filteredContacts.map((contact) => (
                        <div 
                            key={contact._id}
                            onClick={() => handleOpenChat(contact._id)}
                            className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-gray-100 shadow-sm hover:border-green-200 hover:shadow-md transition-all cursor-pointer group"
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="relative shrink-0">
                                    <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs border border-gray-100 group-hover:bg-green-50 group-hover:text-green-600 transition-colors">
                                        {contact.name?.charAt(0) || "U"}
                                    </div>
                                    {(contact.unreadCount || 0) > 0 && (
                                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-brand-orange border-2 border-white rounded-full"></div>
                                    )}
                                </div>

                                <div className="flex flex-col min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h4 className="text-[11px] font-bold text-slate-800 truncate">{contact.name}</h4>
                                        <span className="text-[9px] text-slate-400 font-medium">{formatTime(contact.lastSeen || contact.updatedAt)}</span>
                                    </div>
                                    <p className={`text-[10px] truncate ${contact.unreadCount > 0 ? 'text-slate-900 font-bold' : 'text-slate-400'}`}>
                                        {contact.lastMessage || "No messages"}
                                    </p>
                                </div>
                            </div>

                            <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="bg-slate-50 p-1.5 rounded-lg text-slate-400 group-hover:text-green-600">
                                    <MessageSquare size={12} />
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-xl h-full min-h-37.5">
                        <MessageSquare size={24} className="opacity-20 mb-2" />
                        <h4 className="text-[10px] font-bold text-slate-700">No Conversations</h4>
                    </div>
                )}
            </div>
            
            {/* FOOTER ACTION */}
            <div className="mt-2 pt-2 border-t border-slate-50 shrink-0">
                <button 
                    onClick={() => handleOpenChat()}
                    className="w-full py-2 bg-slate-900 text-white rounded-xl text-[10px] font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-sm shadow-slate-200"
                >
                    <Send size={10} /> New Broadcast
                </button>
            </div>
        </div>
    );
};

export default WhatsAppWidget;