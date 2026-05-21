import React, { useState, useEffect } from 'react';
import { Loader2, ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon } from 'lucide-react';
import EventModal from './EventModal'; 

// --- TYPES ---
export interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  type: 'class' | 'task';
  color: string;
  meetLink?: string;
  htmlLink?: string;
  description?: string;
  attachments?: { title: string; fileUrl: string }[];
  creatorId?: string;
  guests?: string[];
}

type ViewMode = 'month' | 'week' | 'day';

// Added props to receive the selection from Dashboard
interface CalendarProps {
  role: string;
  selectedStudentUsername?: string | null;
  currentUserId: string;
}

const Calendar: React.FC<CalendarProps> = ({ role, selectedStudentUsername, currentUserId }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewMode>('month');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // 🚨 NEW: State for Mobile Day View Popup
  const [showMobileDayView, setShowMobileDayView] = useState(false);
  const [mobileSelectedDate, setMobileSelectedDate] = useState<Date | null>(null);
  const [guestSearch, setGuestSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]); // Will hold your global search results
  const [selectedGuests, setSelectedGuests] = useState<string[]>([]); // Holds the usernames
  const [addGoogleMeet, setAddGoogleMeet] = useState(false);
  // 🚨 NEW: State for our custom Add Event Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEventDraft, setNewEventDraft] = useState({
    id: "",
    title: "",
    date: new Date(),
    time: "12:00", 
    reminderMinutes: 15
  });

  // --- 🚨 NEW: GLOBAL SEARCH DEBOUNCE EFFECT ---
  useEffect(() => {
    // 1. Set a timer to wait 500ms after the user stops typing
    const delayDebounceFn = setTimeout(async () => {
      
      // 2. Only search if they typed at least 2 characters
      if (guestSearch.trim().length > 1) {
        try {
          const token = localStorage.getItem("jwtoken");
          
          // 🚨 IMPORTANT: Change "search-users" to whatever your actual global search endpoint is!
          const res = await fetch(`${import.meta.env.VITE_API}search-users?q=${guestSearch}`, {
            headers: { "Authorization": `Bearer ${token}` }
          });
          
          if (res.ok) {
            const data = await res.json();
            // Ensure we filter out the person currently logged in so they can't invite themselves
            // Also filter out people who are already in the selectedGuests array
            const filteredData = data.filter((user: any) => 
               !selectedGuests.includes(user.username) 
            );
            setSearchResults(filteredData);
          }
        } catch (error) {
          console.error("Global search failed:", error);
        }
      } else {
        // Clear results if the search box is empty
        setSearchResults([]);
      }
    }, 500); // Wait half a second

    // Cleanup the timer if the user types another letter before 500ms is up
    return () => clearTimeout(delayDebounceFn);
  }, [guestSearch, selectedGuests]); // Runs whenever guestSearch text changes

  // --- API FETCHING ---
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true); 
      try {
        const token = localStorage.getItem("jwtoken");
        const headers = { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };

        let url = `${import.meta.env.VITE_API}calendar-events`;
        if (role?.toLowerCase() === 'teacher' && selectedStudentUsername) {
          url += `?username=${selectedStudentUsername}`;
        }

        const eventsRes = await fetch(url, { headers });
        if (eventsRes.ok) {
          const eData = await eventsRes.json();
          const rawEvents = Array.isArray(eData) ? eData : [];
          
          const formattedEvents = rawEvents.map((e: any) => ({
            id: e.id || e._id || Math.random().toString(),
            title: e.title || e.summary || 'Untitled Event',
            date: new Date(e.date),
            type: e.type || 'class',
            color: e.color || 'bg-brand-blue',
            meetLink: e.meetLink,
            htmlLink: e.htmlLink,
            description: e.description,
            attachments: e.attachments || [],
            creatorId: e.creatorId,
            guests: e.guests || []
          }));
          
          setEvents(formattedEvents);
        }
      } catch (error) {
        console.error("Error fetching calendar data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [selectedStudentUsername, role]);

  // --- NAVIGATION LOGIC ---
  const navigateDate = (direction: 1 | -1) => {
    const newDate = new Date(currentDate);
    if (view === 'month') newDate.setMonth(newDate.getMonth() + direction);
    if (view === 'week') newDate.setDate(newDate.getDate() + (7 * direction));
    if (view === 'day') newDate.setDate(newDate.getDate() + direction);
    setCurrentDate(newDate);
  };

  const getFormatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getHeaderTitle = () => {
    if (view === 'month') return currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    if (view === 'day') return currentDate.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    return `${startOfWeek.toLocaleDateString('default', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  const handleEventClick = (e: React.MouseEvent, event: CalendarEvent) => {
    e.stopPropagation(); 
    setSelectedEvent(event);
  };

  // 🚨 NEW: Open the Modal instead of browser prompt
  // Put this inside Calendar.tsx
  const handleDateClick = (day: number) => {
    if (selectedStudentUsername) return; 
    
    const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    
    setNewEventDraft({
      id: "", // Blank ID means it's a NEW event
      title: "",
      date: clickedDate,
      time: "12:00", 
      reminderMinutes: 15
    });

    // Reset all form states
    setGuestSearch("");
    setSearchResults([]);
    setSelectedGuests([]);
    setAddGoogleMeet(false);
    setShowAddModal(true);
  };

  // 🚨 NEW: Combine date/time, update UI, and send to backend
  const handleSaveEvent = async () => {
    if (!newEventDraft.title.trim()) return alert("Please enter a title");

    // Combine Date and Time
    const [hours, minutes] = newEventDraft.time.split(':');
    const finalEventDate = new Date(newEventDraft.date);
    finalEventDate.setHours(Number(hours), Number(minutes), 0, 0);

    const newEventPayload = {
      title: newEventDraft.title,
      date: finalEventDate.toISOString(),
      type: role?.toLowerCase() === 'student' ? 'task' : 'class',
      color: role?.toLowerCase() === 'student' ? 'bg-pink-500' : 'bg-brand-blue',
      reminderMinutes: newEventDraft.reminderMinutes,
      guests: selectedGuests,
      addMeet: addGoogleMeet
    };

    const isEditing = newEventDraft.id !== ""; // 🚨 NEW: Check if we are editing

    // Optimistic UI Update
    if (isEditing) {
      setEvents(prev => prev.map(e => e.id === newEventDraft.id ? { 
        ...e, 
        title: newEventPayload.title, 
        date: finalEventDate,
        color: newEventPayload.color
      } : e));
    } else {
      const tempId = Math.random().toString();
      setEvents(prev => [...prev, { 
        id: tempId, 
        title: newEventPayload.title, 
        date: finalEventDate, 
        type: newEventPayload.type as 'class' | 'task', 
        color: newEventPayload.color,
        creatorId: currentUserId // Assign ownership immediately
      }]);
    }
    
    setShowAddModal(false);

    // Send to Backend
    try {
      const token = localStorage.getItem("jwtoken");
      const endpoint = isEditing 
        ? `${import.meta.env.VITE_API}calendar-events/${newEventDraft.id}`
        : `${import.meta.env.VITE_API}calendar-events`;

      await fetch(endpoint, {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(newEventPayload)
      });
    } catch (error) {
      console.error("Failed to save event to DB", error);
    }
  };

  // --- 🚨 NEW: EDIT LOGIC ---
  // --- EDIT LOGIC ---
  const handleEditEvent = (eventToEdit: CalendarEvent) => {
    setSelectedEvent(null); // Close the view modal

    // 1. Populate the draft with the event's data
    setNewEventDraft({
      id: eventToEdit.id,
      title: eventToEdit.title,
      date: eventToEdit.date,
      time: `${eventToEdit.date.getHours().toString().padStart(2, '0')}:${eventToEdit.date.getMinutes().toString().padStart(2, '0')}`,
      reminderMinutes: 15 
    });

    // 2. 🚨 SET THE GUESTS AND GOOGLE MEET STATE
    setSelectedGuests(eventToEdit.guests || []);
    
    // If the event already has a meetLink, check the box automatically!
    setAddGoogleMeet(!!eventToEdit.meetLink); 

    setShowAddModal(true); // Open the form modal
  };

  const handleDeleteEvent = async (eventToDelete: CalendarEvent) => {
    // 🚨 CRITICAL CHECK: 
    // Google IDs look like '5o3lqg...', MongoDB IDs are usually 24-char hex strings.
    // We only allow deleting if it has a valid MongoDB ID.
    if (eventToDelete.id.length > 30) { 
      return alert("This is a direct Google Calendar event and cannot be deleted from here.");
    }

    const confirmDelete = window.confirm(`Delete "${eventToDelete.title}"?`);
    if (!confirmDelete) return;

    setSelectedEvent(null);
    setEvents(prev => prev.filter(e => e.id !== eventToDelete.id));

    try {
      const token = localStorage.getItem("jwtoken");
      const res = await fetch(`${import.meta.env.VITE_API}calendar-events/${eventToDelete.id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (!res.ok) throw new Error("Delete failed");
    } catch (error) {
      console.error(error);
      alert("Could not delete.");
    }
  };

  // --- RENDERING VIEWS ---
  const renderMonthView = () => {
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
    const days = [];
    const today = new Date();

    for (let i = 0; i < firstDayOfMonth; i++) {
      // 🚨 THE FIX: Match the exact responsive height of the real days (h-16 sm:h-20 md:h-28)
      // I also added a faint border so the grid looks complete!
      days.push(
        <div 
          key={`empty-${i}`} 
          className="h-16 sm:h-20 md:h-28 bg-gray-50/30 border border-gray-100/50"
        ></div>
      );
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const isToday = date.toDateString() === today.toDateString();
      const dayEvents = events.filter(e => e.date.toDateString() === date.toDateString());
      dayEvents.sort((a, b) => a.date.getTime() - b.date.getTime());

      days.push(
        <div 
          key={day} 
          onClick={() => {
            setMobileSelectedDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), day));
            setShowMobileDayView(true);
          }}
          className={`h-16 sm:h-20 md:h-28 border border-gray-100 p-1 md:p-2 flex flex-col relative group hover:bg-orange-50 transition cursor-pointer ${isToday ? 'bg-blue-50/30' : 'bg-white'}`}
        >
          <div className="flex justify-between items-start mb-0.5 md:mb-1">
            <div className="flex items-center gap-1.5 mx-auto md:mx-0">
              <span className={`text-[12px] md:text-sm font-bold flex items-center justify-center ${isToday ? 'bg-brand-blue text-white w-6 h-6 rounded-full shadow-sm' : 'text-gray-700'}`}>
                {day}
              </span>
            </div>
            {!selectedStudentUsername && (
              <button onClick={(e) => { e.stopPropagation(); handleDateClick(day); }} className="hidden md:flex opacity-0 group-hover:opacity-100 text-brand-orange bg-white rounded-full shadow-sm p-1 hover:scale-110 transition -mt-1 -mr-1 z-10"><Plus size={12} /></button>
            )}
          </div>
          
          {/* DESKTOP ONLY: Full Event Pills */}
          <div className="hidden md:flex flex-1 flex-col space-y-1 overflow-y-auto custom-scrollbar w-full min-h-0 pr-1">
            {dayEvents.map(event => (
              <div 
                key={event.id} 
                onClick={(e) => { e.stopPropagation(); handleEventClick(e, event); }} 
                // 🚨 THE FIX: Added 'shrink-0' so they don't get squished, and 'py-1' for better height
                className={`shrink-0 text-[10px] font-medium text-white px-1.5 py-1 rounded shadow-sm truncate cursor-pointer hover:opacity-80 transition ${event.color}`} 
                title={event.title}
              >
                {event.title}
              </div>
            ))}
          </div>

          {/* MOBILE ONLY: Minimal Event Dots */}
          <div className="md:hidden flex flex-wrap items-center justify-center gap-1 mt-1 px-0.5">
            {dayEvents.slice(0, 3).map(event => (
              <span key={event.id} className={`w-1.5 h-1.5 shrink-0 rounded-full ${event.color}`}></span>
            ))}
            {dayEvents.length > 3 && (
              <span className="text-[8px] font-bold text-gray-400 shrink-0 ml-0.5">
                +{dayEvents.length - 3}
              </span>
            )}
          </div>
        </div>
      );
    }

    // 🚨 Calculate the next 2 upcoming events to display in the empty space!
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const upcomingPreview = events
      .filter(e => e.date.getTime() >= todayStart.getTime())
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 2); // Show only the next 2 so it fits perfectly

    return (
      <div className="flex flex-col h-full">
        {/* The Days Header */}
        <div className="grid grid-cols-7 text-center py-2 md:py-3 border-b border-gray-100 bg-gray-50 text-gray-500 font-bold text-[10px] md:text-sm uppercase tracking-wider shrink-0">
          <div><span className="md:hidden">S</span><span className="hidden md:inline">Sun</span></div>
          <div><span className="md:hidden">M</span><span className="hidden md:inline">Mon</span></div>
          <div><span className="md:hidden">T</span><span className="hidden md:inline">Tue</span></div>
          <div><span className="md:hidden">W</span><span className="hidden md:inline">Wed</span></div>
          <div><span className="md:hidden">T</span><span className="hidden md:inline">Thu</span></div>
          <div><span className="md:hidden">F</span><span className="hidden md:inline">Fri</span></div>
          <div><span className="md:hidden">S</span><span className="hidden md:inline">Sat</span></div>
        </div>
        
        {/* The Grid */}
        <div className="grid grid-cols-7 bg-gray-100 gap-px shrink-0">{days}</div>

        {/* 🚨 THE FIX: "Up Next" Mobile Agenda to beautifully fill the empty space */}
        <div className="md:hidden flex-1 bg-slate-50/50 p-4 border-t border-gray-100 flex flex-col justify-center">
          <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5 pl-1">
            <CalendarIcon size={12} className="text-brand-orange" /> Coming Up Next
          </h3>
          {upcomingPreview.length > 0 ? (
            <div className="space-y-2">
              {upcomingPreview.map(event => (
                <div key={`preview-${event.id}`} className={`p-3 rounded-2xl flex items-center gap-3 shadow-sm ${event.color}`}>
                  <div className="bg-white/20 px-2.5 py-1.5 rounded-lg text-white font-bold whitespace-nowrap text-[10px]">
                    {getFormatTime(event.date)}
                  </div>
                  <div className="text-white text-xs font-bold truncate flex-1">
                    {event.title}
                    <div className="text-[9px] font-medium opacity-80 mt-0.5">
                      {event.date.toLocaleDateString('default', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-5 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <p className="text-xs text-gray-400 font-bold">No upcoming classes.</p>
              <p className="text-[10px] text-gray-400/70 mt-1">Enjoy your free time! 🚀</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const days = [];
    const today = new Date();
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(startOfWeek);
      dayDate.setDate(startOfWeek.getDate() + i);
      const isToday = dayDate.toDateString() === today.toDateString();
      const dayEvents = events.filter(e => e.date.toDateString() === dayDate.toDateString());
      dayEvents.sort((a, b) => a.date.getTime() - b.date.getTime());

      // 🚨 RESTORED: The proper tall vertical columns for the week view!
      days.push(
        <div key={i} className={`min-h-100 p-2 md:p-3 border-r border-gray-100 ${isToday ? 'bg-blue-50/30' : 'bg-white'}`}>
          <div className="text-center mb-4">
            <div className={`text-[10px] md:text-xs font-bold uppercase tracking-wider ${isToday ? 'text-brand-blue' : 'text-gray-400'}`}>
              {dayDate.toLocaleDateString('default', { weekday: 'short' })}
            </div>
            <div className={`text-xl md:text-2xl mt-1 w-8 h-8 md:w-10 md:h-10 mx-auto flex items-center justify-center rounded-full font-display font-bold ${isToday ? 'bg-brand-blue text-white shadow-md' : 'text-gray-700'}`}>
              {dayDate.getDate()}
            </div>
          </div>
          
          <div className="space-y-1.5">
            {dayEvents.map(event => (
              <div key={event.id} onClick={(e) => handleEventClick(e, event)} className={`px-1.5 md:px-2 py-1 md:py-1.5 rounded text-white shadow-sm cursor-pointer hover:opacity-80 transition ${event.color}`}>
                <div className="text-[9px] md:text-[10px] font-bold mb-0.5 opacity-90 whitespace-nowrap overflow-hidden text-ellipsis">
                  {getFormatTime(event.date)}
                </div>
                <div className="text-[10px] md:text-xs font-medium leading-tight line-clamp-2">
                  {event.title}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }
    
    // 🚨 MOBILE FIX: Keeps the horizontal swiping for phones!
    return (
      <div className="overflow-x-auto custom-scrollbar w-full pb-2">
        <div className="grid grid-cols-7 bg-gray-100 gap-px border-t border-gray-100 min-w-175">
          {days}
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const dayEvents = events.filter(e => e.date.toDateString() === currentDate.toDateString());
    dayEvents.sort((a, b) => a.date.getTime() - b.date.getTime());

    return (
      <div className="min-h-100 p-6 bg-white">
        <div className="max-w-3xl mx-auto space-y-4">
          {dayEvents.length === 0 ? (
            <div className="text-center py-20 text-gray-400 italic">No events scheduled for this day.</div>
          ) : (
            dayEvents.map(event => (
              <div key={event.id} onClick={(e) => handleEventClick(e, event)} className={`p-4 rounded-xl cursor-pointer hover:-translate-y-0.5 transition shadow-sm flex items-start gap-4 ${event.color}`}>
                <div className="bg-white/20 px-3 py-2 rounded-lg text-white font-bold whitespace-nowrap text-sm">{getFormatTime(event.date)}</div>
                <div className="flex-1 pt-1">
                  <h4 className="text-lg text-white font-bold">{event.title}</h4>
                  <p className="text-white/80 text-xs mt-1 underline">Click to view details</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full flex flex-col gap-4 md:gap-8 h-full min-h-0 flex-1">
      {/* 🚨 THE FIX: Added w-full, text-center for mobile, md:text-left for PC */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-0 md:mb-2 gap-4 px-2 shrink-0 w-full">
        <div className="w-full text-center md:text-left">
          <h2 className="text-2xl md:text-3xl font-display font-bold text-brand-blue">Class Schedule</h2>
          <p className="text-gray-500 font-medium text-xs md:text-sm mt-1 mx-auto md:mx-0 max-w-sm">View your upcoming sessions securely</p>
        </div>
      </div>

      {/* 🚨 2. Added max-h constraint for mobile, flex-1, and min-h-0 */}
      <div className="bg-white rounded-lg shadow-lg border border-gray-100 overflow-hidden flex-1 flex flex-col min-h-0 max-h-[calc(100dvh-160px)] md:max-h-none md:min-h-125">
        {/* --- HEADER COMPONENT --- */}
        <div className="p-4 sm:p-6 border-b border-gray-100 flex items-center justify-between bg-white gap-4">
          <div className="flex items-center gap-3">
              <div className="p-2 bg-brand-orange/10 rounded-xl text-brand-orange hidden sm:block">
                  <CalendarIcon size={24} />
              </div>
              <h2 className="text-lg sm:text-xl font-display text-gray-800 font-bold tracking-wide capitalize">
                {getHeaderTitle()}
              </h2>
          </div>
          
          {/* 🚨 DESKTOP ONLY: Controls (Hidden on Mobile) */}
          <div className="hidden md:flex items-center justify-end w-auto gap-3">
            <div className="flex bg-slate-100 p-1 rounded-xl justify-center">
              {(['day', 'week', 'month'] as ViewMode[]).map((mode) => (
                <button key={mode} onClick={() => setView(mode)} className={`px-4 py-1.5 text-xs font-bold capitalize rounded-lg transition-all ${view === mode ? 'bg-white text-brand-blue shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {mode}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => navigateDate(-1)} className="p-2 bg-gray-50 text-gray-600 hover:text-brand-blue hover:bg-blue-50 rounded-full transition shadow-sm border border-gray-100"><ChevronLeft size={20} /></button>
              <button onClick={() => navigateDate(1)} className="p-2 bg-gray-50 text-gray-600 hover:text-brand-blue hover:bg-blue-50 rounded-full transition shadow-sm border border-gray-100"><ChevronRight size={20} /></button>
            </div>
          </div>
        </div>
        
        {/* 🚨 3. The Fluid Core: This div handles all the scrolling! */}
        <div className="flex-1 overflow-y-auto custom-scrollbar relative bg-slate-50/20">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-32 h-full">
              <Loader2 className="w-10 h-10 text-brand-orange animate-spin mb-4" />
              <p className="text-gray-400 font-medium font-display tracking-wide">Fetching schedule...</p>
            </div>
          ) : (
            <div className="pb-4 md:pb-0"> {/* Slight padding at the bottom of the scroll */}
              {view === 'month' && renderMonthView()}
              {view === 'week' && renderWeekView()}
              {view === 'day' && renderDayView()}
            </div>
          )}
        </div>
        {/* 🚨 MOBILE ONLY: Thumb-Friendly Bottom Navigation Bar */}
        <div className="md:hidden mt-auto border-t border-gray-100 p-3 bg-white flex items-center justify-between gap-2 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)] relative z-10">
          
          {/* Day/Week/Month Toggles */}
          <div className="flex bg-slate-100 p-1 rounded-xl flex-1 max-w-55">
            {(['day', 'week', 'month'] as ViewMode[]).map((mode) => (
              <button key={mode} onClick={() => setView(mode)} className={`flex-1 py-1.5 text-[11px] font-bold capitalize rounded-lg transition-all ${view === mode ? 'bg-white text-brand-blue shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {mode}
              </button>
            ))}
          </div>

          {/* Navigation Arrows */}
          <div className="flex gap-1.5 shrink-0 ml-auto">
            <button onClick={() => navigateDate(-1)} className="p-2 bg-gray-50 text-gray-600 active:bg-gray-200 rounded-full transition shadow-sm border border-gray-100"><ChevronLeft size={18} /></button>
            <button onClick={() => navigateDate(1)} className="p-2 bg-gray-50 text-gray-600 active:bg-gray-200 rounded-full transition shadow-sm border border-gray-100"><ChevronRight size={18} /></button>
          </div>
          
        </div>
      </div>

      {selectedEvent && (
        <div className="relative z-6650">
          <EventModal 
            event={selectedEvent} 
            onClose={() => setSelectedEvent(null)} 
            isOwner={Boolean(selectedEvent.creatorId) && String(selectedEvent.creatorId) === String(currentUserId)} 
            
            onEdit={handleEditEvent}
            onDelete={handleDeleteEvent}
          />
        </div>
      )}
      {/* 🚨 NEW: MOBILE DAY VIEW POPUP (Bottom Sheet) */}
      {showMobileDayView && mobileSelectedDate && (
        <div className="fixed inset-0 z-500 flex items-end md:items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-fade-in pb-16 md:pb-0" onClick={() => setShowMobileDayView(false)}>
          <div 
            className="bg-white rounded-t-3xl md:rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[85vh] transform transition-transform animate-in slide-in-from-bottom-8 md:zoom-in-95 z-500"
            onClick={(e) => e.stopPropagation()} // Prevents clicking the backdrop from closing it
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  {mobileSelectedDate.toLocaleDateString('default', { weekday: 'long' })}
                </p>
                <h3 className="font-display font-bold text-xl text-brand-blue">
                  {mobileSelectedDate.toLocaleDateString('default', { month: 'long', day: 'numeric', year: 'numeric' })}
                </h3>
              </div>
              <button onClick={() => setShowMobileDayView(false)} className="w-8 h-8 flex items-center justify-center bg-gray-100 text-gray-500 rounded-full hover:bg-gray-200 transition">✕</button>
            </div>
            
            {/* Event List */}
            <div className="p-4 overflow-y-auto flex-1 custom-scrollbar bg-slate-50 min-h-62.5">
              {events.filter(e => e.date.toDateString() === mobileSelectedDate.toDateString()).length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
                    <CalendarIcon className="text-gray-300" size={24} />
                  </div>
                  <p className="text-gray-400 font-medium">No events for this day</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {events.filter(e => e.date.toDateString() === mobileSelectedDate.toDateString())
                    .sort((a, b) => a.date.getTime() - b.date.getTime())
                    .map(event => (
                    <div key={event.id} onClick={(e) => { setShowMobileDayView(false); handleEventClick(e, event); }} className={`p-4 rounded-2xl cursor-pointer hover:-translate-y-0.5 transition shadow-sm flex items-start gap-3 ${event.color}`}>
                      <div className="bg-white/20 px-2.5 py-1.5 rounded-lg text-white font-bold whitespace-nowrap text-xs">
                        {getFormatTime(event.date)}
                      </div>
                      <div className="flex-1">
                        <h4 className="text-base text-white font-bold leading-tight">{event.title}</h4>
                        <p className="text-white/80 text-[10px] mt-1 font-medium underline">Tap to view details</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Big "Add Event" Button inside the Mobile Modal */}
            {!selectedStudentUsername && (
              <div className="p-4 bg-white border-t border-gray-100">
                <button 
                  onClick={() => {
                    setShowMobileDayView(false);
                    // Pass the tapped day number straight into your existing "Add Event" logic!
                    handleDateClick(mobileSelectedDate.getDate());
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-brand-orange text-white rounded-xl font-bold hover:bg-orange-600 transition shadow-sm active:scale-95"
                >
                  <Plus size={18} strokeWidth={3} /> Schedule Event
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* 🚨 NEW: ADD EVENT MODAL 🚨 */}
      {showAddModal && (
        <div className="fixed inset-0 z-500 flex items-center justify-center bg-slate-900/70 backdrop-blur-md pb-16 md:pb-0 px-4">
          <div className="bg-white rounded-4xl p-8 w-full max-w-md shadow-2xl border border-white/20 transform transition-all animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-brand-orange" />
              {newEventDraft.id ? "Edit Event" : (role?.toLowerCase() === 'student' ? "Add a Task" : "Schedule a Class")}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Title</label>
                <input 
                  type="text" 
                  autoFocus
                  value={newEventDraft.title}
                  onChange={(e) => setNewEventDraft({ ...newEventDraft, title: e.target.value })}
                  placeholder="e.g., Math Tutoring Session"
                  
                  className="w-full px-4 py-2 text-base bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-orange outline-none" 
                />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Date</label>
                  <div className="px-4 py-2 bg-gray-100 border border-gray-200 rounded-xl text-gray-600 font-medium cursor-not-allowed">
                    {newEventDraft.date.toLocaleDateString()}
                  </div>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Time</label>
                  <input 
                    type="time" 
                    value={newEventDraft.time}
                    onChange={(e) => setNewEventDraft({ ...newEventDraft, time: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-orange outline-none font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Pre-Event Reminder</label>
                <select 
                  value={newEventDraft.reminderMinutes}
                  onChange={(e) => setNewEventDraft({ ...newEventDraft, reminderMinutes: Number(e.target.value) })}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-orange outline-none font-medium text-gray-700 cursor-pointer"
                >
                  <option value={0}>At time of event</option>
                  <option value={15}>15 minutes before</option>
                  <option value={30}>30 minutes before</option>
                  <option value={60}>1 hour before</option>
                </select>
              </div>

              {/* ========================================= */}
              {/* 🚨 NEW: GUEST SEARCH DROPDOWN GOES HERE 🚨 */}
              {/* ========================================= */}
              <div className="relative">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Invite Guests (@username)</label>
                <input 
                  type="text" 
                  value={guestSearch}
                  onChange={(e) => setGuestSearch(e.target.value)} // 🚨 Just update state, the useEffect handles the fetch!
                  placeholder="Search usernames..."
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-orange outline-none"
                />
                
                {/* Search Dropdown */}
                {searchResults.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                    {searchResults.map((user: any) => (
                      <div 
                        key={user.username}
                        onClick={() => {
                          if (!selectedGuests.includes(user.username)) {
                            setSelectedGuests([...selectedGuests, user.username]);
                          }
                          setGuestSearch("");
                          setSearchResults([]);
                        }}
                        className="px-4 py-2 hover:bg-gray-50 cursor-pointer text-sm font-medium text-gray-700"
                      >
                        @{user.username} <span className="text-gray-400 text-xs ml-2">{user.name}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Selected Guest Chips */}
                {selectedGuests.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedGuests.map(username => (
                      <div key={username} className="px-3 py-1 bg-brand-blue/10 text-brand-blue rounded-full text-xs font-bold flex items-center gap-2">
                        @{username}
                        <button onClick={() => setSelectedGuests(selectedGuests.filter(u => u !== username))} className="hover:text-red-500">&times;</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ========================================= */}
              {/* 🚨 NEW: GOOGLE MEET TOGGLE GOES HERE 🚨 */}
              {/* ========================================= */}
              <div className="flex items-center gap-3 pt-2">
                <input 
                  type="checkbox" 
                  id="meet-toggle"
                  checked={addGoogleMeet}
                  onChange={(e) => setAddGoogleMeet(e.target.checked)}
                  className="w-5 h-5 rounded text-brand-orange focus:ring-brand-orange cursor-pointer border-gray-300"
                />
                <label htmlFor="meet-toggle" className="text-sm font-bold text-gray-700 cursor-pointer flex items-center gap-2">
                  <span className="p-1 bg-blue-50 text-blue-600 rounded-md">📹</span> Add Google Meet Link
                </label>
              </div>

            </div> {/* <-- Closes the space-y-4 div */}

            <div className="flex gap-3 mt-8">
              <button 
                onClick={() => {
                  setShowAddModal(false);
                  setGuestSearch("");
                  setSearchResults([]);
                  setSelectedGuests([]);
                  setAddGoogleMeet(false);
                }}
                className="flex-1 px-4 py-2.5 text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveEvent}
                className="flex-1 px-4 py-2.5 text-white bg-brand-orange hover:bg-orange-600 rounded-xl font-bold transition-colors shadow-sm"
              >
                Save {role?.toLowerCase() === 'student' ? 'Task' : 'Class'}
              </button>
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
};

export default Calendar;