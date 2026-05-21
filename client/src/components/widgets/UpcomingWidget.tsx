import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, GripVertical, Clock, MapPin, Plus, X, ArrowDown, ArrowUp, Loader2, Video, Paperclip } from 'lucide-react';

const UpcomingWidget = ({ data }: { data: any }) => {
  const navigate = useNavigate();
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortDesc, setSortDesc] = useState(false); 
  const [expandedEvent, setExpandedEvent] = useState<any | null>(null);
  
  // 🚨 Add Event State
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventTime, setNewEventTime] = useState('12:00');
  const [addMeet, setAddMeet] = useState(false);

  // 🚨 Attachment Unlock State
  const [unlockingId, setUnlockingId] = useState<string | null>(null);
  
  const clickStartPos = useRef<{x: number, y: number} | null>(null);

  const fetchCalendarEvents = async () => {
    try {
      const token = localStorage.getItem("jwtoken");
      const res = await fetch(`${import.meta.env.VITE_API}calendar-events`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const allEvents = await res.json();
        const now = new Date();
        const currentHour = now.getHours();

        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfToday = new Date(startOfToday);
        endOfToday.setDate(endOfToday.getDate() + 1);

        const endOfTomorrow = new Date(startOfToday);
        endOfTomorrow.setDate(endOfTomorrow.getDate() + 2);

        const endOfThreeDays = new Date(startOfToday);
        endOfThreeDays.setDate(endOfThreeDays.getDate() + 4);

        let targetEnd = currentHour >= 18 ? endOfTomorrow : endOfToday;

        let displayEvents = allEvents.filter((ev: any) => {
            if (!ev.date) return false;
            const evTime = new Date(ev.date).getTime();
            return evTime >= startOfToday.getTime() && evTime < targetEnd.getTime();
        });

        if (displayEvents.length === 0) {
            displayEvents = allEvents.filter((ev: any) => {
                if (!ev.date) return false;
                const evTime = new Date(ev.date).getTime();
                return evTime >= startOfToday.getTime() && evTime < endOfThreeDays.getTime();
            });
        }

        setEvents(displayEvents);
      }
    } catch (error) {
      console.error("Failed to load calendar events:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendarEvents();
  }, []);

  const sortedEvents = [...events].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return sortDesc ? dateB - dateA : dateA - dateB;
  }).slice(0, 15);

  const formatEventTime = (dateStr: string) => {
      if (!dateStr) return '';
      if (dateStr.length === 10) return 'All Day'; 
      const date = new Date(dateStr);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isToday = (dateStr: string) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      const today = new Date();
      return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  };

  const isTomorrow = (dateStr: string) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return d.getDate() === tomorrow.getDate() && d.getMonth() === tomorrow.getMonth() && d.getFullYear() === tomorrow.getFullYear();
  };

  // 🚨 QUICK ADD EVENT
  const handleQuickAdd = async () => {
    if (!newEventTitle.trim() || !newEventDate) return;
    setIsSaving(true);

    try {
        const token = localStorage.getItem("jwtoken");
        const [hours, minutes] = newEventTime.split(':');
        const finalDate = new Date(newEventDate);
        finalDate.setHours(Number(hours), Number(minutes), 0, 0);

        const res = await fetch(`${import.meta.env.VITE_API}calendar-events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                title: newEventTitle,
                date: finalDate.toISOString(),
                type: 'class',
                color: 'bg-brand-blue',
                reminderMinutes: 15,
                addMeet: addMeet
            })
        });

        if (res.ok) {
            await fetchCalendarEvents(); // Refresh list securely
            setIsAdding(false);
            setNewEventTitle('');
            setNewEventDate('');
            setNewEventTime('12:00');
            setAddMeet(false);
        }
    } catch (error) {
        console.error("Failed to quick add event", error);
    } finally {
        setIsSaving(false);
    }
  };

  // 🚨 ATTACHMENT UNLOCKER
  const handleUnlockAttachment = async (fileId: string, fallbackUrl: string) => {
      if (!expandedEvent) return;
      setUnlockingId(fileId);

      // Determine the correct Google Event ID (Depends on if it's purely from Google or merged with Mongo)
      const targetGoogleEventId = expandedEvent.googleEventId || expandedEvent.id;

      try {
          const token = localStorage.getItem("jwtoken");
          const res = await fetch(`${import.meta.env.VITE_API}unlock-attachment`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ 
                  googleEventId: targetGoogleEventId, 
                  fileId: fileId 
              })
          });

          if (res.ok) {
              const data = await res.json();
              window.open(data.fileUrl, '_blank'); // Open the unlocked URL!
          } else {
              console.warn("Unlock failed on server, attempting fallback URL...");
              window.open(fallbackUrl, '_blank'); 
          }
      } catch (error) {
          console.error("Network error during unlock", error);
          window.open(fallbackUrl, '_blank'); // Try fallback just in case
      } finally {
          setUnlockingId(null);
      }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-brand-orange shadow-[0_0_8px_rgba(255,100,0,0.5)]" />
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Up Next</h3>
        </div>
        
        <div className="flex items-center gap-2">
            <button 
                onClick={() => setSortDesc(!sortDesc)} 
                className="p-1.5 bg-slate-100 hover:bg-white rounded-lg border border-slate-200/50 text-slate-600 transition shadow-sm"
                title={sortDesc ? "Show latest first" : "Show soonest first"}
            >
                {sortDesc ? <ArrowDown size={12} strokeWidth={3} /> : <ArrowUp size={12} strokeWidth={3} />}
            </button>
            <button 
                onClick={() => setIsAdding(!isAdding)} 
                className="w-6 h-6 flex items-center justify-center bg-brand-orange/10 text-brand-orange rounded-full hover:bg-brand-orange hover:text-white transition-colors"
                title="Quick Add Event"
            >
                {isAdding ? <X size={14} strokeWidth={3} /> : <Plus size={14} strokeWidth={3} />}
            </button>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing text-slate-200 ml-1">
                <GripVertical size={16} />
            </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 relative z-10">
        
        {/* 🚨 INLINE QUICK ADD FORM */}
        {isAdding && (
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 mb-4 animate-in fade-in slide-in-from-top-2">
                <input 
                    type="text" placeholder="Event Title..." value={newEventTitle}
                    onChange={e => setNewEventTitle(e.target.value)}
                    className="w-full bg-white px-3 py-2 rounded-xl text-xs font-bold text-slate-700 outline-none border border-slate-200 mb-2 focus:border-brand-orange/50 transition-colors" 
                    autoFocus
                />
                <div className="flex gap-2 mb-3">
                    <input 
                        type="date" value={newEventDate} onChange={e => setNewEventDate(e.target.value)}
                        className="flex-1 bg-white px-2 py-2 rounded-xl text-[10px] font-bold text-slate-600 outline-none border border-slate-200 focus:border-brand-orange/50 transition-colors"
                    />
                    <input 
                        type="time" value={newEventTime} onChange={e => setNewEventTime(e.target.value)}
                        className="w-24 bg-white px-2 py-2 rounded-xl text-[10px] font-bold text-slate-600 outline-none border border-slate-200 focus:border-brand-orange/50 transition-colors"
                    />
                </div>
                <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 cursor-pointer text-[10px] font-bold text-slate-600">
                        <input type="checkbox" checked={addMeet} onChange={e => setAddMeet(e.target.checked)} className="rounded text-brand-orange" />
                        Add Google Meet
                    </label>
                    <div className="flex items-center gap-2">
                        <button onClick={() => navigate('/calendar')} className="text-[9px] font-bold text-brand-blue hover:underline mr-2">Full Options</button>
                        <button onClick={handleQuickAdd} disabled={isSaving || !newEventTitle.trim() || !newEventDate} className="bg-brand-orange text-white flex items-center gap-1 text-[10px] font-bold px-3 py-1.5 rounded-lg hover:bg-orange-600 transition disabled:opacity-50">
                            {isSaving ? <Loader2 size={12} className="animate-spin" /> : "Save"}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {isLoading ? (
            <div className="h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-brand-orange animate-spin" />
            </div>
        ) : sortedEvents.length > 0 ? (
            <div className="space-y-3 pb-2">
                {sortedEvents.map((ev) => (
                    <div 
                        key={ev.id || ev._id} 
                        onMouseDown={(e) => clickStartPos.current = { x: e.clientX, y: e.clientY }}
                        onMouseUp={(e) => {
                            if (!clickStartPos.current) return;
                            const dx = Math.abs(e.clientX - clickStartPos.current.x);
                            const dy = Math.abs(e.clientY - clickStartPos.current.y);
                            if (dx < 5 && dy < 5) setExpandedEvent(ev);
                            clickStartPos.current = null;
                        }}
                        className="flex gap-3 p-3 bg-brand-orange/5 hover:bg-brand-orange/10 border border-brand-orange/10 rounded-2xl transition-all cursor-pointer group/ev"
                    >
                        <div className="flex flex-col items-center justify-center min-w-13.75 py-1.5 px-1 bg-white rounded-xl border border-brand-orange/20 shadow-sm">
                            <span className="text-[10px] font-black text-brand-orange uppercase tracking-wider">
                                {isToday(ev.date) ? 'Today' : isTomorrow(ev.date) ? 'Tmrw' : new Date(ev.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </span>
                            <span className="text-[10px] font-bold text-slate-700 mt-0.5 text-center leading-tight">{formatEventTime(ev.date)}</span>
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <h4 className="text-xs font-bold text-slate-800 truncate group-hover/ev:text-brand-orange transition-colors">
                                {ev.title}
                            </h4>
                            <div className="flex items-center gap-3 mt-1.5 text-[9px] font-bold text-slate-500">
                                <span className="flex items-center gap-1 shrink-0"><Clock size={10}/> {formatEventTime(ev.date)}</span>
                                {ev.location && <span className="flex items-center gap-1 truncate"><MapPin size={10}/> {ev.location}</span>}
                                {ev.meetLink && <span className="flex items-center gap-1 text-blue-500 shrink-0"><Video size={10}/> Meet</span>}
                                {ev.attachments?.length > 0 && <span className="flex items-center gap-1 text-slate-400 shrink-0"><Paperclip size={10}/> {ev.attachments.length}</span>}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200 py-6 px-4">
                <Calendar size={32} className="opacity-20 mb-2" />
                <span className="text-xs font-bold text-center px-4">Nothing scheduled for the next 3 days! 🏖️</span>
            </div>
        )}
      </div>

      {/* 🚨 DESCRIPTION MODAL WITH MEET BUTTON & UNLOCKABLE ATTACHMENTS */}
      {expandedEvent && (
          <div className="fixed inset-0 z-10000 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onMouseDown={() => setExpandedEvent(null)}>
              <div 
                  className="bg-white rounded-3xl md:rounded-4xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden"
                  onMouseDown={e => e.stopPropagation()}
              >
                  <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-brand-orange text-white">
                      <div className="flex flex-col pr-4">
                        <h3 className="text-sm font-bold leading-tight truncate">{expandedEvent.title}</h3>
                        <span className="text-[10px] text-orange-100 font-medium flex items-center gap-1 mt-0.5">
                            <Calendar size={10}/> {new Date(expandedEvent.date).toLocaleDateString([], { dateStyle: 'long' })}
                        </span>
                      </div>
                      <button onClick={() => setExpandedEvent(null)} className="hover:bg-white/20 p-1.5 rounded-full transition shrink-0"><X size={16}/></button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-orange-50/20">
                      <div className="flex items-center gap-6 mb-6">
                          <div className="flex flex-col">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Start Time</span>
                              <span className="text-sm font-bold text-slate-700">{formatEventTime(expandedEvent.date)}</span>
                          </div>
                          {expandedEvent.endTime && (
                              <div className="flex flex-col border-l border-slate-200 pl-6">
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">End Time</span>
                                  <span className="text-sm font-bold text-slate-700">{formatEventTime(expandedEvent.endTime)}</span>
                              </div>
                          )}
                          {expandedEvent.location && (
                              <div className="flex flex-col border-l border-slate-200 pl-6">
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Location</span>
                                  <span className="text-sm font-bold text-slate-700 truncate max-w-30">{expandedEvent.location}</span>
                              </div>
                          )}
                      </div>

                      {expandedEvent.meetLink && (
                          <div className="mb-6">
                              <a 
                                href={expandedEvent.meetLink} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="inline-flex items-center justify-center gap-2 w-full md:w-auto bg-blue-50 text-brand-blue hover:bg-brand-blue hover:text-white border border-blue-200 px-6 py-3 rounded-xl text-sm font-bold transition-colors shadow-sm"
                              >
                                  <Video size={18} /> Join Google Meet
                              </a>
                          </div>
                      )}

                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Event Details</h4>
                      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm min-h-20 mb-6">
                        <p className="text-xs md:text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                            {expandedEvent.description || "No additional notes provided for this event."}
                        </p>
                      </div>

                      {/* 🚨 SECURE ATTACHMENTS */}
                      {expandedEvent.attachments && expandedEvent.attachments.length > 0 && (
                          <div>
                              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Attachments</h4>
                              <div className="space-y-2">
                                  {expandedEvent.attachments.map((att: any, idx: number) => (
                                      <button 
                                          key={idx} 
                                          onClick={() => handleUnlockAttachment(att.fileId, att.fileUrl)}
                                          disabled={unlockingId === att.fileId}
                                          className="w-full flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl hover:border-brand-blue/30 hover:shadow-sm transition-all group disabled:opacity-50"
                                      >
                                          <div className="flex items-center gap-3 min-w-0">
                                              <div className="w-8 h-8 rounded-lg bg-blue-50 text-brand-blue flex items-center justify-center shrink-0">
                                                  {unlockingId === att.fileId ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
                                              </div>
                                              <span className="text-xs font-bold text-slate-700 group-hover:text-brand-blue transition-colors truncate">
                                                  {att.title}
                                              </span>
                                          </div>
                                          <span className="text-[9px] font-bold text-brand-blue opacity-0 group-hover:opacity-100 transition-opacity pr-2">Open</span>
                                      </button>
                                  ))}
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}
    </>
  );
};

export default UpcomingWidget;