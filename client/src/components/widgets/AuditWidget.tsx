import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldAlert, 
  Clock, 
  User, 
  Server, 
  ExternalLink, 
  Loader2, 
  Activity 
} from 'lucide-react';

interface AuditLog {
  id: string;
  recipient: string;
  triggeredBy: string;
  action: string;
  timestamp: string;
  link?: string;
  isRead: boolean;
}

interface AuditWidgetProps {
  user?: any;
}

const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;
  
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const AuditWidget: React.FC<AuditWidgetProps> = ({ user }) => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAuditLogs = async () => {
      if (!user?.isAdmin) {
        setIsLoading(false);
        return;
      }

      try {
        const token = localStorage.getItem("jwtoken");
        const res = await fetch(`${import.meta.env.VITE_API}admin/audit-log`, {
          headers: { "Authorization": `Bearer ${token}` }
        });

        if (res.ok) {
          const data = await res.json();
          setLogs(data.slice(0, 50));
        }
      } catch (error) {
        console.error("Failed to fetch audit logs:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAuditLogs();
  }, [user]);

  if (!user?.isAdmin) return null; 

  return (
    <div className="flex flex-col h-full relative">
      
      {/* WIDGET HEADER */}
      <div className="flex items-center justify-between mb-4 relative z-10 shrink-0 gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500 shadow-inner shrink-0">
            <ShieldAlert size={16} strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Live Audit</h3>
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-emerald-500 uppercase tracking-widest mt-0.5">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Monitoring
            </div>
          </div>
        </div>
        
        {/* Adjusted to match the clean text-link style of other widgets */}
        <button 
          onClick={() => navigate('/admin/audit')} 
          className="text-[10px] font-bold text-brand-blue hover:underline transition-colors flex items-center gap-1 shrink-0 whitespace-nowrap"
        >
            Full Log <ExternalLink size={10} className="mb-0.5" />
        </button>
      </div>

      {/* WIDGET CONTENT (SCROLLABLE TIMELINE) */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 relative z-10 pb-2">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full min-h-37.5">
            <Loader2 className="w-6 h-6 text-rose-400 animate-spin mb-2" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Decrypting Logs...</span>
          </div>
        ) : logs.length > 0 ? (
          <div className="space-y-2">
            {logs.map((log) => {
              const isSystem = log.triggeredBy === 'System';
              
              return (
                <div 
                  key={log.id} 
                  className="group flex gap-3 p-3 bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-rose-200 hover:shadow-md transition-all relative overflow-hidden"
                >
                  {/* Subtle left border accent */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${isSystem ? 'bg-slate-200' : 'bg-brand-blue/60 group-hover:bg-brand-blue'}`} />

                  {/* Icon */}
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 z-10 ${isSystem ? 'bg-slate-100 text-slate-500' : 'bg-blue-50 text-brand-blue'}`}>
                    {isSystem ? <Server size={12} /> : <User size={12} />}
                  </div>

                  {/* Log Details */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-700 leading-snug">
                      <span className={`font-bold ${isSystem ? 'text-slate-600' : 'text-brand-blue'}`}>
                        {isSystem ? 'System' : `@${log.triggeredBy}`}
                      </span>
                      <span className="text-slate-500 mx-1">
                        {log.action}
                      </span>
                      <span className="font-bold text-slate-800 bg-slate-100 px-1 rounded inline-block mt-0.5">
                        @{log.recipient}
                      </span>
                    </p>
                    
                    {/* Timestamp */}
                    <div className="flex items-center gap-1 mt-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
                      <Clock size={10} className="text-slate-400" />
                      <span className="text-[9px] font-bold text-slate-400 tracking-wide">
                        {formatTimeAgo(log.timestamp)}
                      </span>
                    </div>
                  </div>

                  {/* Optional Action Link Indicator */}
                  {log.link && (
                    <div className="shrink-0 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => navigate(log.link!)} className="w-6 h-6 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-brand-blue hover:text-white transition-colors">
                        <Activity size={10} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-2xl h-full min-h-37.5">
            <ShieldAlert size={28} className="opacity-20 mb-2 text-rose-500" />
            <h4 className="text-xs font-bold text-slate-700 mb-1">No Activity Detected</h4>
            <p className="text-[9px] text-slate-500 text-center leading-relaxed">
              The platform is currently silent.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditWidget;