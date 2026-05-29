import React, { useState } from 'react';
import { X, Video, FileText, ExternalLink, Clock, PlayCircle, Edit2, Trash2 } from 'lucide-react'; 
import { CalendarEvent } from './Calendar';

interface EventModalProps {
  event: CalendarEvent;
  onClose: () => void;
  isOwner: boolean; 
  onEdit?: (event: CalendarEvent) => void;
  onDelete?: (event: CalendarEvent) => void;
}

const EventModal: React.FC<EventModalProps> = ({ event, onClose, isOwner, onEdit, onDelete }) => {
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockingId, setUnlockingId] = useState<string | null>(null);

  const getFormatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // 🚨 1. RESTORED: The full Unlock Attachment Function
  const handleUnlockAttachment = async (e: React.MouseEvent, googleEventId: string, fileId: string, fallbackUrl: string) => {
    e.preventDefault(); 
    e.stopPropagation();
    
    // Set the specific file ID to loading
    setUnlockingId(fileId);
    
    try {
      const token = localStorage.getItem("jwtoken");
      const res = await fetch(`${import.meta.env.VITE_API}unlock-attachment`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ googleEventId, fileId }) 
      });

      if (res.ok) {
        const data = await res.json();
        window.open(data.fileUrl, '_blank');
      } else {
        alert("Could not unlock the file. It may be processing or unavailable.");
      }
    } catch (error) {
      console.error("Unlock failed:", error);
      window.open(fallbackUrl, '_blank'); 
    } finally {
      // Clear the loading state
      setUnlockingId(null);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-start bg-slate-50">
          <div>
            <h3 className="text-2xl font-display font-bold text-gray-800 pr-4">{event.title}</h3>
            <p className="text-brand-blue font-bold text-sm mt-2 flex items-center gap-1">
              <Clock size={14} />
              {event.date.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' })} at {getFormatTime(event.date)}
            </p>
          </div>
          
          <div className="flex items-center gap-1 shrink-0">
            {isOwner && (
              <>
                <button 
                  onClick={() => onEdit && onEdit(event)} 
                  className="p-2 text-gray-400 hover:text-brand-blue hover:bg-blue-50 rounded-full transition"
                  title="Edit Event"
                >
                  <Edit2 size={18} />
                </button>
                <button 
                  onClick={() => onDelete && onDelete(event)} 
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition"
                  title="Delete Event"
                >
                  <Trash2 size={18} />
                </button>
              </>
            )}
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition ml-1" title="Close">
              <X size={20} />
            </button>
          </div>
        </div>
        
        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {event.meetLink && (
            <a href={event.meetLink} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 w-full p-4 bg-brand-blue text-white rounded-xl hover:bg-blue-600 transition font-bold shadow-md shadow-blue-200">
              <Video size={20} /> Join Google Meet
            </a>
          )}

          {event.description && (
            <div>
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Description</h4>
              <div 
                className="text-sm text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-xl border border-gray-100 prose prose-sm max-w-none prose-a:text-brand-blue"
                dangerouslySetInnerHTML={{ __html: event.description }} 
              />
            </div>
          )}

          {/* 🚨 2. RESTORED: Attachments with Video vs File Icons */}
          {event.attachments && event.attachments.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Class Resources</h4>
              <div className="space-y-2">
                {event.attachments.map((att: any, idx) => {
                  const isVideo = (att.mimeType && att.mimeType.includes('video')) || (att.title && (att.title.toLowerCase().endsWith('.mp4') || att.title.toLowerCase().endsWith('.mov') || att.title.toLowerCase().endsWith('.webm')));
                  
                  // 🚨 NEW: Check if THIS specific file is the one loading!
                  const isThisFileUnlocking = unlockingId === att.fileId;

                  return (
                    <div 
                      key={idx} 
                      onClick={(e) => {
                        if (event.id && att.fileId) {
                          handleUnlockAttachment(e, event.id, att.fileId, att.fileUrl);
                        } else {
                          window.open(att.fileUrl, '_blank');
                        }
                      }}
                      className={`flex items-center justify-between p-3 border border-gray-200 rounded-xl transition group cursor-pointer ${
                        isThisFileUnlocking ? 'opacity-50 cursor-not-allowed bg-gray-100' : 'hover:border-brand-orange hover:bg-orange-50'
                      }`}
                    >
                      <div className="flex items-center gap-3 text-sm font-medium text-gray-700">
                        <div className={`p-2 rounded-lg ${isVideo ? 'bg-blue-100 text-brand-blue' : 'bg-orange-100 text-brand-orange'}`}>
                          {isVideo ? <PlayCircle size={16} /> : <FileText size={16} />}
                        </div>
                        <span className="truncate max-w-62.5">
                          {/* 🚨 NEW: Show text only on the clicked file */}
                          {isThisFileUnlocking ? "Unlocking File..." : att.title}
                        </span>
                      </div>
                      {!isThisFileUnlocking && <ExternalLink size={16} className="text-gray-300 group-hover:text-brand-orange" />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {event.htmlLink && (
          <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-center">
             <a href={event.htmlLink} target="_blank" rel="noreferrer" className="text-xs text-gray-500 hover:text-brand-blue font-semibold flex items-center gap-1 transition">
               View full details in Google Calendar <ExternalLink size={12} />
             </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventModal;