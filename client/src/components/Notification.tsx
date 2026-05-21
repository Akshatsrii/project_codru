import { useEffect, useState, useRef } from "react";
import { socket } from '../socket';
import { Bell, Loader2, CheckCheck, X } from "lucide-react";
import { useNavigate } from "react-router-dom"; 

interface NotificationProps {
  closeNotification: () => void;
  showNotifications: boolean;
  setShowNotifications: React.Dispatch<React.SetStateAction<boolean>>;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>; 
}

interface AppNotification {
  _id: string; 
  message: string;
  link?: string;
  date: string;
  isRead: boolean;
}

const Notification = ({
  closeNotification,
  showNotifications,
  setShowNotifications,
  setUnreadCount,
  customClasses
}: any) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [dismissing, setDismissing] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const notificationRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const username = localStorage.getItem("Username");

  // Filter so ONLY unread notifications show in the popup!
  const unreadNotifications = notifications.filter(n => !n.isRead);

  // 1. Outside Click Detector
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        closeNotification(); 
      }
    };
    if (showNotifications) document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [showNotifications, closeNotification]);

  // 2. Update the Red Dot Badge
  useEffect(() => {
    setUnreadCount(unreadNotifications.length);
  }, [unreadNotifications.length, setUnreadCount]);

  // 3. Fetching logic
  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("jwtoken");
      const response = await fetch(`${import.meta.env.VITE_API}notifications`, { 
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Failed to load notifications");
      const data = await response.json();
      setNotifications(data || []);
    } catch (err) {
      setError("Failed to fetch notifications");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!username) return;
    
    fetchNotifications();

    // 1. Tell the shared socket who you are
    socket.emit("join", username);

    // 2. Define the function (We need to name it so we can cleanly remove it later)
    const handleNewNotification = (notification: any) => {
        setNotifications((prev) => [notification, ...prev]);

        if (notification.link?.includes("whatsapp-crm")) {
             // Note: Make sure you put a file named pop.mp3 inside your React 'public' folder!
             new Audio('/pop.mp3').play().catch((err) => console.log("Audio blocked by browser:", err));
        }
    };

    // 3. Listen for the ping
    socket.on("notification", handleNewNotification);

    // 4. 🚨 CLEANUP: ONLY remove the listener. DO NOT disconnect the socket!
    return () => { 
        socket.off("notification", handleNewNotification); 
    };
}, [username]);

  // 4. Handle Single Click
  const handleNotificationClick = async (notifId: string, rawLink?: string) => {
    // Instantly hide it from the dropdown
    setNotifications((prev) => prev.map(n => n._id === notifId ? { ...n, isRead: true } : n));
    
    try {
      await fetch(`${import.meta.env.VITE_API}notifications/mark-read`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("jwtoken")}` },
        body: JSON.stringify({ notifId }) 
      });
    } catch (error) {
      console.error("Failed to mark as read", error);
    }

    if (rawLink) {
      closeNotification(); // Close the popup first
      
      // 🚨 FIX: Clean the link just like we do in sw.js
      const pathWord = rawLink.replace(/^\//, '').toLowerCase();
      
      const dashboardViews = [
        "schedule", "syllabus", "profile", "settings", "my-posts", 
        "saved-posts", "report", "management", "my-courses", "whatsapp-crm"
      ];

      if (pathWord.startsWith("portal")) {
        const parts = pathWord.split(":");
        const chatId = parts.length > 1 ? parts[1] : null;

        // Fire the event
        window.dispatchEvent(new CustomEvent('open-communication-portal', {
          detail: { connectionId: chatId } 
        }));

        return; // EJECT!
      }
      
      if (dashboardViews.includes(pathWord)) {
        // If it's a dashboard view, use the React Router state navigation
        navigate("/dashboard", { state: { targetView: pathWord } }); 
      } else {
        // If it's a standard absolute path (e.g., /about), just navigate normally
        const absolutePath = rawLink.startsWith('/') ? rawLink : `/${rawLink}`;
        navigate(absolutePath); 
      }
    }
  };

  // 5. Handle Single Dismiss (X button on a single item)
  const dismissNotification = async (e: React.MouseEvent, notifId: string) => {
    e.stopPropagation(); 
    setDismissing((prev) => [...prev, notifId]);
    setTimeout(() => {
      setNotifications((prev) => prev.map(n => n._id === notifId ? { ...n, isRead: true } : n));
      setDismissing((prev) => prev.filter((id) => id !== notifId));
    }, 300);

    try {
      await fetch(`${import.meta.env.VITE_API}notifications/mark-read`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("jwtoken")}` },
        body: JSON.stringify({ notifId })
      });
    } catch (error) {
      console.error("Failed to mark notification as read", error);
    }
  };

  // 6. 🚨 NEW: Handle Clear All
  const handleClearAll = async () => {
    // Instantly clear the UI
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    
    try {
      await fetch(`${import.meta.env.VITE_API}notifications/mark-all-read`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${localStorage.getItem("jwtoken")}` }
      });
    } catch (error) {
      console.error("Failed to clear all", error);
    }
  };

  const timeAgo = (date: string) => {
    if (!date) return "Just now";
    const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (diff < 60) return `Just now`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  if (!showNotifications) return null;

  return (
    <div 
      ref={notificationRef}
      className={`
        fixed z-60 bg-white overflow-hidden flex flex-col p-5 border border-gray-100
        /* 📱 MOBILE: Bottom Sheet (Sits right above the bottom nav) */
        bottom-16 left-0 w-full max-h-[75vh] rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.15)] animate-slide-up
        /* 💻 DESKTOP: Top Right Dropdown */
        md:bottom-auto md:top-20 md:right-8 md:left-auto md:w-100 md:max-h-[80vh] md:rounded-3xl md:shadow-2xl md:animate-fade-in-down
        ${customClasses || ""}
      `}
    >
      <div className="flex justify-between items-center mb-4 shrink-0">
        <div className="flex items-center gap-2 text-brand-blue">
          <Bell className="w-5 h-5" />
          <h3 className="font-display font-bold text-lg text-gray-800">Notifications</h3>
        </div>
        
        {/* 🚨 Swapped Close for Clear All */}
        {unreadNotifications.length > 0 && (
          <button 
            onClick={handleClearAll} 
            className="text-xs font-bold text-gray-400 hover:text-brand-orange flex items-center gap-1 transition-colors"
          >
            <CheckCheck className="w-4 h-4" />
            Clear All
          </button>
        )}
      </div>
      
      <hr className="border-gray-100 mb-4 shrink-0" />

      {/* Added flex-1 to this container so it scrolls perfectly inside the fixed height sheet */}
      <div className="flex-1 overflow-y-auto pr-2 dashboard-content-scroll">
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-brand-blue" /></div>
        ) : unreadNotifications.length > 0 ? (
          <ul className="space-y-3 pb-4">
            {unreadNotifications.map((notification) => (
              <li
                key={notification._id} 
                onClick={() => handleNotificationClick(notification._id, notification.link?.startsWith('/') ? notification.link : `/${notification.link}`)} 
                className={`group relative border p-4 rounded-xl cursor-pointer transition-all duration-300 bg-brand-orange/5 border-brand-orange/20 hover:bg-brand-orange/10 ${
                  dismissing.includes(notification._id) ? "opacity-0 scale-95" : "opacity-100"
                }`}
              >
                <p className="text-sm pr-6 leading-snug font-bold text-gray-800">
                  {notification.message}
                </p>
                <div className="flex justify-between items-center mt-2">
                  <small className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">
                    {timeAgo(notification.date)}
                  </small>
                  {notification.link && <span className="text-[10px] text-brand-blue font-bold">View details →</span>}
                </div>
                
                {/* Individual Dismiss X */}
                <button
                  className="absolute top-3 right-3 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => dismissNotification(e, notification._id)}
                >
                  <X className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center py-10 text-gray-400">
            <Bell className="w-10 h-10 mx-auto mb-2 opacity-20" />
            <p className="text-sm">No new alerts</p>
            <p className="text-xs mt-1 opacity-60">You're all caught up!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Notification;