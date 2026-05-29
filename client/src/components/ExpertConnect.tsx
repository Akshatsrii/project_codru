import React, { useState, useEffect, useRef } from "react";
import { Search, Loader2, ShieldCheck, Calendar, MessageSquare, X, Send, Heart } from "lucide-react";
import Muialert from "./Muialert"; 
import { UserData } from "../App";
import { socket } from '../socket';

interface ExpertConnectProps {
  userData: UserData;
}

const ExpertConnect = ({ userData }: ExpertConnectProps) => {
  // 🚨 1. THE CRASH FIX: Wait for data before rendering anything!
  if (!userData) {
    return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-brand-blue w-10 h-10" /></div>;
  }

  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search States
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Modal States
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [isSending, setIsSending] = useState(false);
  
  // Circle State
  const [circle, setCircle] = useState<any[]>([]);

  // Alert States
  const [alertInfo, setAlertInfo] = useState({ show: false, message: "", severity: "success" as any });

  // Fetch Default Admins
  useEffect(() => {
    const fetchAdmins = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API}expert-connect/admins`, {
          headers: { "Authorization": `Bearer ${localStorage.getItem("jwtoken")}` }
        });
        if (res.ok) setAdmins(await res.json());
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    fetchAdmins();
  }, []);

  // Fetch Parent's Circle (Safely using optional chaining)
  useEffect(() => {
    if (userData?.Role !== "Parent") return;

    const fetchCircle = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API}expert-connect/my-circle`, {
          headers: { "Authorization": `Bearer ${localStorage.getItem("jwtoken")}` }
        });
        if (res.ok) setCircle(await res.json());
      } catch (err) { console.error(err); }
    };

    // 1. Initial fetch on load
    fetchCircle();

    // 2. Define the refresh trigger
    const handleRefreshCircle = () => {
      console.log("🔄 Syncing Support Circle...");
      fetchCircle();
    };

    // 3. Listen for LOCAL events 
    window.addEventListener('refresh-communication-circle', handleRefreshCircle);

    // 4. 🚨 SHARED SOCKET SETUP
    const username = localStorage.getItem("Username");
    if (username) {
      socket.emit("join", username); // Ensure they are in their room
      socket.on("force-refresh-circle", handleRefreshCircle);
    }

    // 5. Cleanup
    return () => {
      window.removeEventListener('refresh-communication-circle', handleRefreshCircle);
      // 🚨 ONLY turn off the listener, DO NOT disconnect the socket!
      socket.off("force-refresh-circle", handleRefreshCircle); 
    };
  }, [userData?.Role]);

  // Global Search Logic (Debounced)
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`${import.meta.env.VITE_API}search-users?q=${searchTerm}`, {
          headers: { "Authorization": `Bearer ${localStorage.getItem("jwtoken")}` }
        });
        if (res.ok) setSearchResults(await res.json());
      } catch (err) { console.error(err); } finally { setIsSearching(false); }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  // Click outside search to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchResults([]);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Send Handshake Logic
  const handleSendRequest = async () => {
    // 🚨 2. THE 3-EXPERT LIMIT FIX: Stop parents from adding too many!
    if (userData?.Role === "Parent" && circle.length >= 3) {
      setAlertInfo({ show: true, message: "You can only have 3 active experts in your circle. Please remove one first.", severity: "error" });
      return;
    }

    if (!message.trim()) return;
    setIsSending(true);
    
    try {
      const res = await fetch(`${import.meta.env.VITE_API}expert-connect/request`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("jwtoken")}`
        },
        body: JSON.stringify({ 
          receiverId: selectedUser._id, 
          message, 
          meetingDate: meetingDate || undefined 
        })
      });

      const data = await res.json();
      if (res.ok) {
        setAlertInfo({ show: true, message: data.message, severity: "success" });
        setSelectedUser(null);
        setMessage("");
        setMeetingDate("");
      } else {
        setAlertInfo({ show: true, message: data.error, severity: "error" });
      }
    } catch (err) {
      setAlertInfo({ show: true, message: "Network error.", severity: "error" });
    } finally {
      setIsSending(false);
    }
  };

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-brand-blue w-10 h-10" /></div>;

  return (
    <>
    <div className="space-y-8 animate-in fade-in duration-500 relative">
        
        {/* --- 1. THE SUPPORT CIRCLE (The Sacred 3) --- */}
        {userData?.Role === "Parent" && circle.length > 0 && (
            <div className="bg-linear-to-br from-rose-50/50 to-blue-50/30 p-6 rounded-3xl border border-white shadow-inner">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <Heart className="text-rose-500 w-5 h-5 fill-rose-500" /> My Support Circle
                </h3>
                <span className="text-[10px] font-bold text-slate-400 bg-white/50 px-3 py-1 rounded-full uppercase border border-slate-100">
                {circle.length} / 3 Experts
                </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {circle.map((expert) => (
                <div key={expert._id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-50 flex items-center gap-4 group transition-all hover:shadow-md">
                    <div className="relative">
                    <img src={expert.photo || "https://via.placeholder.com/150"} className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-sm" />
                    <div className="absolute -bottom-1 -right-1 bg-green-500 w-3.5 h-3.5 rounded-full border-2 border-white"></div>
                    </div>
                    <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-slate-800 truncate">{expert.name}</h4>
                    <p className="text-[10px] font-black text-rose-500 uppercase tracking-tighter truncate">
                        {expert.specialty || expert.role}
                    </p>
                    </div>
                    <button 
                  // 🚨 THE TELEPORT COMMAND
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('open-communication-portal', {
                      detail: { connectionId: expert.connectionId }
                    }));
                  }}
                  className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-brand-blue hover:text-white transition-all shadow-sm hover:shadow-md"
                  title={`Chat with ${expert.name}`}
                >
                  <MessageSquare size={18} />
                </button>
                </div>
                ))}
            </div>
            </div>
        )}

      {/* Header & Global Search */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div>
          <h2 className="text-3xl font-display font-bold text-slate-800">Community Directory</h2>
          <p className="text-slate-500 mt-1">Connect with Admins, Verified Staff, or knowledgeable Students.</p>
        </div>
        
        {/* Search Bar Container */}
        <div className="relative w-full md:w-96 z-50" ref={searchRef}>
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-blue transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Search for anyone by name or @username..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl w-full focus:ring-4 focus:ring-blue-500/10 focus:border-brand-blue outline-none transition-all shadow-sm"
            />
            {isSearching && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-slate-400" size={16} />}
          </div>

          {/* Search Dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute top-full mt-2 w-full bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden max-h-80 overflow-y-auto">
              {searchResults.map(user => (
                <div 
                  key={user._id} 
                  onClick={() => { setSelectedUser(user); setSearchResults([]); setSearchTerm(""); }}
                  className="p-3 hover:bg-slate-50 cursor-pointer flex items-center gap-3 transition-colors border-b border-slate-50 last:border-0"
                >
                  <img src={user.photo || "https://via.placeholder.com/40"} className="w-10 h-10 rounded-full object-cover" />
                  <div>
                    <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      {user.name}
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                        user.role === 'Teacher' ? 'bg-orange-50 text-brand-orange' :
                        user.role === 'Student' ? 'bg-blue-50 text-brand-blue' :
                        user.role === 'Parent' ? 'bg-rose-50 text-rose-500' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {user.role || "User"}
                      </span>
                    </p>
                    {user.specialty && (
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">{user.specialty}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Default View: Admin Cards */}
      <div>
        <h3 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
          <ShieldCheck className="text-brand-blue w-5 h-5" /> Verified Administrators
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {admins.map((admin) => (
            <div key={admin._id} className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col items-center text-center">
              <img src={admin.photo || "https://via.placeholder.com/150"} className="w-24 h-24 rounded-full object-cover shadow-md mb-4 border-4 border-blue-50" />
              <h3 className="text-xl font-bold text-slate-800">{admin.name}</h3>
              <p className="text-xs text-brand-blue font-black uppercase tracking-widest mt-1 bg-blue-50 px-3 py-1 rounded-full">Platform Admin</p>
              <button 
                onClick={() => setSelectedUser(admin)}
                className="mt-6 w-full bg-slate-50 text-slate-700 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-brand-blue hover:text-white transition-all active:scale-95 shadow-inner"
              >
                <MessageSquare size={16} /> Request Connection
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* The Handshake Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-999 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-4xl p-5 max-w-md w-full shadow-2xl relative animate-in zoom-in duration-200">
            <button onClick={() => setSelectedUser(null)} className="absolute top-4 right-4 text-slate-400 hover:bg-slate-100 p-2 rounded-full transition"><X size={20} /></button>
            
            <div className="flex items-center gap-4 mb-6">
              <img src={selectedUser.photo || "https://via.placeholder.com/150"} className="w-16 h-16 rounded-full object-cover shadow-sm" />
              <div>
                <h3 className="text-xl font-bold text-slate-800">Connect with {selectedUser.name?.split(' ')[0] || "User"}</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{selectedUser.role}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Your Question / Reason</label>
                <textarea 
                  rows={4}
                  placeholder="Introduce yourself and explain what you'd like to discuss..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-blue outline-none resize-none"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>

              <div>
                <label className=" text-xs font-bold text-slate-700 uppercase mb-2 flex items-center gap-1"><Calendar size={14} /> Propose Meeting (Optional)</label>
                <input 
                  type="datetime-local" 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-blue outline-none"
                  value={meetingDate}
                  onChange={(e) => setMeetingDate(e.target.value)}
                />
              </div>

              <button 
                onClick={handleSendRequest}
                disabled={isSending || !message.trim()}
                className={`w-full py-3.5 rounded-xl font-black flex items-center justify-center gap-2 transition-all ${
                  message.trim() ? "bg-brand-blue text-white shadow-lg shadow-blue-500/30 hover:bg-blue-700 active:scale-95" : "bg-slate-100 text-slate-400 cursor-not-allowed"
                }`}
              >
                {isSending ? <Loader2 className="animate-spin w-5 h-5" /> : <><Send size={18} /> Send Request</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {alertInfo.show && <Muialert message={alertInfo.message} severity={alertInfo.severity} onClose={() => setAlertInfo({ ...alertInfo, show: false })} />}
      
    </div>
    <div className="h-4 md:h-6 w-full shrink-0 pointer-events-none"></div>
    </>
  );
};

export default ExpertConnect;