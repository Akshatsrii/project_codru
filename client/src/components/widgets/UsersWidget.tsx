import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Search, 
  ExternalLink, 
  Loader2, 
  X,
  ShieldAlert
} from 'lucide-react';
import {
  Delete as DeleteIcon,
  AddCircle as AddCircleIcon,
  RemoveCircle as RemoveCircleIcon,
  Block as BlockIcon,
  WorkspacePremium as WorkspacePremiumIcon,
  Shield as ShieldIcon
} from "@mui/icons-material";
import { Dialog, DialogContent, IconButton, Tooltip, Snackbar, Alert } from "@mui/material";

interface UsersWidgetProps {
  user?: any;
}

const UsersWidget: React.FC<UsersWidgetProps> = ({ user }) => {
  const navigate = useNavigate();
  const [usersList, setUsersList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // OTP Dialog State for Admin Toggle
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [currentActionUser, setCurrentActionUser] = useState("");
  const [waitingAlert, setWaitingAlert] = useState(false);

  // Toast State
  const [toast, setToast] = useState<{ show: boolean, message: string, severity: 'success' | 'error' | 'warning' | 'info' }>({ 
    show: false, message: '', severity: 'info' 
  });

  const showToast = (message: string, severity: 'success' | 'error' | 'warning' | 'info') => {
    setToast({ show: true, message, severity });
  };

  // 1. FETCH ALL USERS FOR INSTANT SEARCH
  useEffect(() => {
    if (!user?.isAdmin) return;

    const fetchUsers = async () => {
      try {
        const token = localStorage.getItem("jwtoken");
        const res = await fetch(`${import.meta.env.VITE_API}users`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        
        if (res.ok) {
          const data = await res.json();
          // Sort by newest first (MongoDB _id contains a timestamp!)
          const sortedUsers = data.sort((a: any, b: any) => (a._id < b._id ? 1 : -1));
          setUsersList(sortedUsers);
        }
      } catch (error) {
        console.error("Failed to fetch users:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchUsers();
  }, [user]);

  // 2. INSTANT SEARCH & FILTER LOGIC
  const displayedUsers = useMemo(() => {
    if (!searchQuery.trim()) {
      return usersList.slice(0, 5); // Default: Top 5 newest
    }
    const query = searchQuery.toLowerCase();
    return usersList.filter(u => 
      (u.name && u.name.toLowerCase().includes(query)) || 
      (u.username && u.username.toLowerCase().includes(query)) ||
      (u.email && u.email.toLowerCase().includes(query))
    ).slice(0, 50); // Cap search results to prevent extreme DOM lag
  }, [usersList, searchQuery]);

  // ==========================================
  // ACTION HANDLERS (Copied exactly from Admin.tsx)
  // ==========================================
  const handleToggleTeam = async (username: string) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API}user/toggle-team/${username}`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${localStorage.getItem("jwtoken")}` }
      });
      if (res.ok) {
        const data = await res.json();
        showToast(data.message, "success");
        setUsersList(prev => prev.map(u => u.username === username ? { ...u, isCuTeTeam: data.isCuTeTeam } : u));
      }
    } catch (err) {
      showToast("Team toggle failed.", "error");
    }
  };

  const handleToggleBan = async (username: string) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API}user/toggle-ban/${username}`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${localStorage.getItem("jwtoken")}` }
      });
      if (res.ok) {
        const data = await res.json();
        showToast(data.message, "warning");
        setUsersList(prev => prev.map(u => u.username === username ? { ...u, isBanned: data.isBanned } : u));
      }
    } catch (err) {
      showToast("Ban toggle failed.", "error");
    }
  };

  const handleDelete = async (id: string, username: string) => {
    if (!window.confirm(`Permanently delete @${username}?`)) return;
    try {
      const response = await fetch(`${import.meta.env.VITE_API}user/${username}`, { method: "DELETE" });
      if (response.ok) {
        setUsersList(prev => prev.filter((u) => u._id !== id));
        showToast("User deleted permanently.", "success");
      }
    } catch (error) {
      showToast("Failed to delete user.", "error");
    }
  };

  const handleAdminToggleRequest = async (username: string, isAdmin: boolean) => {
    try {
      setWaitingAlert(true);
      const response = await fetch(`${import.meta.env.VITE_API}generate-otp-bro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, isAdmin }),
      });
      setWaitingAlert(false);
      
      if (response.ok) {
        setCurrentActionUser(username);
        setOtpValue("");
        setOtpOpen(true);
      } else {
        const data = await response.json();
        showToast(data.message || "Failed to generate OTP.", "error");
      }
    } catch (error) {
      setWaitingAlert(false);
      showToast("Network error initiating admin toggle.", "error");
    }
  };

  const handleOtpVerification = async (finalOtp: string) => {
    const token = localStorage.getItem("jwtoken");
    try {
      const res = await fetch(`${import.meta.env.VITE_API}verify-bigbro`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ username: currentActionUser, otp: finalOtp }),
      });
      const data = await res.json();
      if (res.ok) {
        setOtpOpen(false);
        showToast(data.message, "success");
        // Opting for local state update instead of full page reload for a smoother widget experience
        setUsersList(prev => prev.map(u => u.username === currentActionUser ? { ...u, isAdmin: !u.isAdmin } : u));
      } else {
        showToast(data.error || data.message || "Invalid OTP", "error");
      }
    } catch (err) {
      showToast("Network error during verification", "error");
    }
  };

  if (!user?.isAdmin) return null;

  return (
    <div className="flex flex-col h-full relative">
      
      {/* WIDGET HEADER */}
      <div className="flex items-center justify-between mb-4 relative z-10 gap-2 shrink-0">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500 shadow-inner">
            <Users size={16} strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Quick Actions</h3>
            <p className="text-[9px] font-bold text-slate-400 tracking-wider">Manage Roster</p>
          </div>
        </div>
        
        <button 
          onClick={() => navigate('/admin')} 
          className="text-[10px] font-bold text-gray-400 hover:text-brand-blue transition-colors flex items-center gap-1 shrink-0 whitespace-nowrap"
        >
            Full Directory <ExternalLink size={10} className="mb-0.5" />
        </button>
      </div>

      {/* INSTANT SEARCH BAR */}
      <div className="mb-4 shrink-0 relative z-10">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
        <input 
          type="text" 
          placeholder="Search name, @username, or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none transition-all shadow-sm"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-rose-500 transition-colors">
            <X size={14} />
          </button>
        )}
      </div>

      {/* WIDGET CONTENT (USER LIST) */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 relative z-10 flex flex-col gap-2 pb-2">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full min-h-37.5">
            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin mb-2" />
          </div>
        ) : displayedUsers.length > 0 ? (
          <>
            {displayedUsers.map((targetUser) => {
              const roleBadge = 
                targetUser.role === 'Student' ? 'bg-blue-50 text-blue-600 border-blue-100' : 
                targetUser.role === 'Parent' ? 'bg-rose-50 text-rose-600 border-rose-100' : 
                'bg-orange-50 text-orange-600 border-orange-100';

              return (
                <div key={targetUser._id} className="flex items-center justify-between p-3 bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-brand-blue/30 transition-colors group">
                  
                  {/* Left: Avatar & Info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      {targetUser.photo ? (
                        <img src={targetUser.photo} alt={targetUser.name} className="w-10 h-10 rounded-full object-cover shadow-sm border border-gray-100" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-sm border border-gray-200">
                          {(targetUser.name || "U").charAt(0).toUpperCase()}
                        </div>
                      )}
                      {targetUser.isAdmin && (
                        <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm">
                          <ShieldIcon sx={{ fontSize: 12, color: '#10b981' }} />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-800 truncate">{targetUser.name}</h4>
                        <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border shrink-0 ${roleBadge}`}>
                          {targetUser.role || 'User'}
                        </span>
                      </div>
                      <p className="text-[10px] font-medium text-slate-400 truncate">@{targetUser.username}</p>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-0.5 opacity-100 md:opacity-50 md:group-hover:opacity-100 transition-opacity shrink-0">
                    <Tooltip title="Toggle Team Status" arrow placement="top">
                      <IconButton onClick={() => handleToggleTeam(targetUser.username)} size="small" sx={{ color: targetUser.isCuTeTeam ? '#1765a4' : '#cbd5e1' }}>
                        <WorkspacePremiumIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title={targetUser.isBanned ? "Unban User" : "Ban User"} arrow placement="top">
                      <IconButton onClick={() => handleToggleBan(targetUser.username)} size="small" sx={{ color: targetUser.isBanned ? '#10b981' : '#ef4444' }}>
                        <BlockIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title={targetUser.isAdmin ? "Revoke Admin" : "Make Admin"} arrow placement="top">
                      <IconButton onClick={() => handleAdminToggleRequest(targetUser.username, targetUser.isAdmin)} size="small" color={targetUser.isAdmin ? "warning" : "success"}>
                        {targetUser.isAdmin ? <RemoveCircleIcon fontSize="small" /> : <AddCircleIcon fontSize="small" />}
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Permanently Delete" arrow placement="top">
                      <IconButton onClick={() => handleDelete(targetUser._id, targetUser.username)} size="small" sx={{ color: '#cbd5e1', '&:hover': { color: '#ef4444', bgcolor: '#fef2f2' } }}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-400 h-full min-h-37.5 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
            <Search size={28} className="opacity-20 mb-2" />
            <h4 className="text-xs font-bold text-slate-700 mb-1">No users found</h4>
            <p className="text-[9px] text-slate-500 text-center">Try a different search term.</p>
          </div>
        )}
      </div>

      {/* OTP DIALOG FOR ADMIN PROMOTION */}
      <Dialog 
        open={otpOpen} 
        onClose={(e, reason) => { 
          if (reason !== "backdropClick" && reason !== "escapeKeyDown") {
            setOtpOpen(false); 
          }
        }} 
        slotProps={{ 
          paper: { 
            style: { padding: "30px", borderRadius: "24px", textAlign: "center", maxWidth: "400px" } 
          } 
        }}
      >
        <DialogContent>
          <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h3 className="text-xl font-display font-bold text-brand-blue mb-2">Security Verification</h3>
          <p className="text-xs text-gray-500 mb-6 px-4">Enter the code from your Admin Security Email to proceed with modifying clearance levels.</p>
          
          <div className="flex justify-center gap-3">
            {[0, 1, 2, 3].map((index) => (
              <input
                key={index}
                id={`otp-input-${index}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={otpValue[index] || ""}
                autoFocus={index === 0}
                onPaste={(e) => {
                  e.preventDefault();
                  // Handle pasting a 4-digit code
                  const pasteData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
                  if (pasteData) {
                    setOtpValue(pasteData);
                    if (pasteData.length === 4) handleOtpVerification(pasteData);
                  }
                }}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, ""); // Allow numbers only
                  if (!val && e.target.value !== "") return; // Reject letters
                  
                  // Update state securely
                  const otpArray = otpValue.split("");
                  otpArray[index] = val;
                  const newOtp = otpArray.join("");
                  setOtpValue(newOtp);

                  // Auto-advance focus
                  if (val && index < 3) {
                    const nextInput = document.getElementById(`otp-input-${index + 1}`);
                    if (nextInput) nextInput.focus();
                  }

                  // Auto-submit when exactly 4 digits are typed
                  if (newOtp.length === 4) {
                    handleOtpVerification(newOtp);
                  }
                }}
                onKeyDown={(e) => {
                  // Smooth backspacing to previous input
                  if (e.key === "Backspace" && !otpValue[index] && index > 0) {
                    const prevInput = document.getElementById(`otp-input-${index - 1}`);
                    if (prevInput) prevInput.focus();
                  }
                }}
                className="w-14 h-14 text-center text-2xl font-black text-brand-blue bg-slate-50 border-2 border-slate-200 rounded-xl outline-none focus:border-brand-blue focus:bg-blue-50 transition-all shadow-sm"
              />
            ))}
          </div>

          <button onClick={() => setOtpOpen(false)} className="mt-6 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors">Cancel Request</button>
        </DialogContent>
      </Dialog>

      {/* MUI SNACKBAR TOASTS */}
      <Snackbar open={toast.show} autoHideDuration={4000} onClose={() => setToast(prev => ({ ...prev, show: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setToast(prev => ({ ...prev, show: false }))} severity={toast.severity} variant="filled" sx={{ width: '100%', borderRadius: '12px', fontWeight: 'bold' }}>
          {toast.message}
        </Alert>
      </Snackbar>

      <Snackbar open={waitingAlert} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="info" variant="filled" sx={{ width: '100%', borderRadius: '12px', fontWeight: 'bold' }}>
          Sending Secure OTP...
        </Alert>
      </Snackbar>

    </div>
  );
};

export default UsersWidget;