import React, { useState, useEffect, useRef } from 'react';
import { KanbanSquare, GripVertical, Phone, User, Plus, X, Loader2, AlignLeft, ArrowDown, ArrowUp } from 'lucide-react';

const LeadsWidget = ({ data }: { data: any }) => {
  const [leads, setLeads] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 🚨 Drag bypass ref
  const clickStartPos = useRef<{x: number, y: number} | null>(null);

  // Form State
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadPhone, setNewLeadPhone] = useState('');
  const [newLeadDescription, setNewLeadDescription] = useState('');
  const [newLeadStatus, setNewLeadStatus] = useState('New');
  const [assignees, setAssignees] = useState('');

  // Sorting State
  const [sortBy, setSortBy] = useState<'date' | 'status'>('date');
  const [sortDesc, setSortDesc] = useState(true);

  // Expanded Lead State (Popup)
  const [expandedLead, setExpandedLead] = useState<{name: string, description: string, phone: string} | null>(null);

  useEffect(() => {
    if (data && Array.isArray(data)) {
        setLeads(data);
    } else if (data && data.activeLeads !== undefined) {
        setLeads([]); 
    }
  }, [data]);

  const getStatusColor = (status: string) => {
    switch(status) {
        case 'New': return 'bg-gray-100 text-gray-600 border-gray-200';
        case 'Contacted': return 'bg-amber-50 text-amber-600 border-amber-200';
        case 'Trial Scheduled': return 'bg-brand-blue/10 text-brand-blue border-brand-blue/20';
        case 'Converted': return 'bg-green-50 text-green-600 border-green-200';
        case 'Lost': return 'bg-rose-50 text-rose-600 border-rose-200';
        default: return 'bg-slate-50 text-slate-500 border-slate-200';
    }
  };

  // THE SORTING ENGINE
  const stageWeight: Record<string, number> = { 'New': 1, 'Contacted': 2, 'Trial Scheduled': 3, 'Converted': 4, 'Lost': 5 };

  const sortedLeads = [...leads].sort((a, b) => {
      if (sortBy === 'status') {
          const valA = stageWeight[a.status || 'New'] || 0;
          const valB = stageWeight[b.status || 'New'] || 0;
          if (valA !== valB) return sortDesc ? valB - valA : valA - valB;
          
          const dateA = a.date ? new Date(a.date).getTime() : 0;
          const dateB = b.date ? new Date(b.date).getTime() : 0;
          return dateB - dateA;
      } else {
          const dateA = a.date ? new Date(a.date).getTime() : 0;
          const dateB = b.date ? new Date(b.date).getTime() : 0;
          if (dateA !== dateB) return sortDesc ? dateB - dateA : dateA - dateB;
          return 0;
      }
  });

  const handleAddLead = async () => {
    if (!newLeadPhone.trim()) return;
    setIsSaving(true);
    
    try {
      const token = localStorage.getItem("jwtoken");
      const currentUsername = localStorage.getItem("Username") || "";
      
      let assignedStaff = assignees.split(',').map(s => s.trim().replace('@', '')).filter(Boolean);
      if (assignedStaff.length === 0) {
        assignedStaff.push(currentUsername);
      }

      const res = await fetch(`${import.meta.env.VITE_API}leads/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          name: newLeadName,
          phoneNumber: newLeadPhone,
          description: newLeadDescription,
          status: newLeadStatus,
          assignedStaff: assignedStaff
        })
      });

      if (res.ok) {
        const savedLead = await res.json();
        const formattedLead = {
            _id: savedLead._id,
            name: savedLead.name,
            status: savedLead.status,
            phoneNumber: savedLead.phoneNumber,
            date: savedLead.createdAt,
            description: savedLead.description
        };

        setLeads(prev => [formattedLead, ...prev]); 
        setNewLeadName('');
        setNewLeadPhone('');
        setNewLeadDescription('');
        setNewLeadStatus('New');
        setAssignees('');
        setIsAdding(false);
      }
    } catch (error) {
      console.error("Failed to save lead:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      {/* HEADER WITH SORTING CONTROLS */}
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-brand-orange shadow-[0_0_8px_rgba(255,100,0,0.5)]" />
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">My Pipeline</h3>
        </div>
        
        <div className="flex items-center gap-2">
          {/* SORTING ENGINE UI */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200/50 shadow-sm">
            <select 
                value={sortBy} 
                onChange={e => setSortBy(e.target.value as 'date' | 'status')} 
                className="bg-transparent text-[9px] font-bold text-slate-600 outline-none cursor-pointer pl-1.5 pr-1 appearance-none"
            >
                <option value="date">Sort: Date</option>
                <option value="status">Sort: Stage</option>
            </select>
            <div className="w-px h-3 bg-slate-300 mx-1"></div>
            <button 
                onClick={() => setSortDesc(!sortDesc)} 
                className="p-1 hover:bg-white rounded-md transition text-slate-600 active:scale-95"
                title={sortDesc ? "Descending" : "Ascending"}
            >
                {sortDesc ? <ArrowDown size={12} strokeWidth={3} /> : <ArrowUp size={12} strokeWidth={3} />}
            </button>
          </div>

          <button 
            onClick={() => setIsAdding(!isAdding)} 
            className="w-6 h-6 flex items-center justify-center bg-brand-blue/10 text-brand-blue rounded-full hover:bg-brand-blue hover:text-white transition-colors"
          >
            {isAdding ? <X size={14} strokeWidth={3} /> : <Plus size={14} strokeWidth={3} />}
          </button>
        </div>
      </div>

      {/* WIDGET CONTENT */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 relative z-10 flex flex-col">
        
        {/* INLINE ADD FORM */}
        {isAdding && (
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 mb-4 animate-in fade-in slide-in-from-top-2">
            <div className="flex gap-2 mb-2">
                <input 
                    type="text" placeholder="Name (e.g. John)" value={newLeadName}
                    onChange={e => setNewLeadName(e.target.value)}
                    className="flex-1 bg-white px-3 py-2 rounded-xl text-[10px] font-bold text-slate-700 outline-none border border-slate-200 focus:border-brand-blue/50 transition-colors" 
                />
                <input 
                    type="text" placeholder="Phone Number *" value={newLeadPhone}
                    onChange={e => setNewLeadPhone(e.target.value)}
                    className="flex-1 bg-white px-3 py-2 rounded-xl text-[10px] font-bold text-slate-700 outline-none border border-slate-200 focus:border-brand-blue/50 transition-colors" 
                />
            </div>
            
            <textarea 
              placeholder="Context or notes about this lead..." value={newLeadDescription}
              onChange={e => setNewLeadDescription(e.target.value)} rows={2}
              className="w-full bg-white px-3 py-2 rounded-xl text-[10px] font-medium text-slate-600 outline-none border border-slate-200 mb-2 focus:border-brand-blue/50 transition-colors resize-none custom-scrollbar"
            />
            
            <div className="flex gap-2 mb-3">
                <input 
                    type="text" placeholder="@username (Assign others)" value={assignees}
                    onChange={e => setAssignees(e.target.value)}
                    className="flex-1 bg-white px-3 py-2 rounded-xl text-[10px] font-medium text-slate-600 outline-none border border-slate-200 focus:border-brand-blue/50 transition-colors"
                />
                <select 
                    value={newLeadStatus} onChange={e => setNewLeadStatus(e.target.value)} 
                    className="bg-white px-2 py-2 rounded-xl text-[10px] font-bold text-slate-600 outline-none border border-slate-200 focus:border-brand-blue/50 transition-colors"
                >
                    <option value="New">New</option>
                    <option value="Contacted">Contacted</option>
                    <option value="Trial Scheduled">Trial</option>
                </select>
            </div>
            
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-slate-600 text-[10px] font-bold px-3 py-2 transition">Cancel</button>
              <button onClick={handleAddLead} disabled={isSaving || !newLeadPhone.trim()} className="bg-brand-blue text-white flex items-center gap-1.5 text-[10px] font-bold px-4 py-2 rounded-xl hover:bg-blue-600 transition disabled:opacity-50">
                {isSaving && <Loader2 size={12} className="animate-spin" />} Save Lead
              </button>
            </div>
          </div>
        )}

        {/* LEAD LIST */}
        {sortedLeads.length > 0 ? (
            <div className="space-y-2 pb-2">
                {sortedLeads.map((lead) => (
                    <div 
                        key={lead._id} 
                        // 🚨 THE SMART CLICK WORKAROUND
                        onMouseDown={(e) => {
                            e.stopPropagation();
                            clickStartPos.current = { x: e.clientX, y: e.clientY };
                        }}
                        onMouseUp={(e) => {
                            if (!clickStartPos.current) return;
                            const dx = Math.abs(e.clientX - clickStartPos.current.x);
                            const dy = Math.abs(e.clientY - clickStartPos.current.y);
                            
                            // If they moved the mouse less than 5px, it's a click, not a drag!
                            if (dx < 5 && dy < 5) {
                                e.stopPropagation();
                                setExpandedLead({ 
                                    name: lead.name, 
                                    description: lead.description || "No specific notes for this lead.", 
                                    phone: lead.phoneNumber 
                                });
                            }
                            clickStartPos.current = null;
                        }}
                        className={`flex items-start justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-100 transition-colors group/lead cursor-pointer hover:border-brand-blue/30`}
                    >
                        <div className="flex items-start gap-3 min-w-0 pointer-events-none">
                            <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 shrink-0 shadow-sm mt-0.5">
                                <User size={14} />
                            </div>
                            <div className="min-w-0 flex flex-col">
                                <span className="text-xs font-bold text-slate-800 truncate leading-tight">{lead.name || "Unknown"}</span>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="flex items-center gap-1 text-[9px] font-bold text-slate-500">
                                        <Phone size={8} /> {lead.phoneNumber}
                                    </span>
                                </div>
                                {/* Description Snippet */}
                                {lead.description && (
                                    <div className="flex items-start gap-1.5 mt-1.5 text-slate-500">
                                        <AlignLeft size={10} className="mt-0.5 shrink-0 opacity-50 group-hover/lead:text-brand-blue" />
                                        <p className="text-[9px] font-medium leading-relaxed line-clamp-1 group-hover/lead:text-slate-700 transition-colors">{lead.description}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0 ml-2 pointer-events-none">
                            <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${getStatusColor(lead.status)}`}>
                                {lead.status}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        ) : (!isAdding && (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200 py-6">
                <KanbanSquare size={32} className="opacity-20 mb-2" />
                <span className="text-xs font-bold">Your pipeline is empty!</span>
            </div>
        ))}
      </div>

      {/* 🚨 DESCRIPTION MODAL / POPUP */}
      {expandedLead && (
          <div className="fixed inset-0 z-10000 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onMouseDown={() => setExpandedLead(null)}>
              <div 
                  className="bg-white rounded-3xl md:rounded-3xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden"
                  onMouseDown={e => e.stopPropagation()} // Prevents clicking inside modal from closing it
              >
                  <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-brand-blue text-white">
                      <div className="flex flex-col pr-4">
                        <h3 className="text-sm font-bold leading-tight truncate">{expandedLead.name || "Lead Details"}</h3>
                        <span className="text-[10px] text-blue-200 font-medium flex items-center gap-1 mt-0.5"><Phone size={10}/> {expandedLead.phone}</span>
                      </div>
                      <button onClick={() => setExpandedLead(null)} className="hover:bg-white/20 p-1.5 rounded-full transition shrink-0"><X size={16}/></button>
                  </div>
                  <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/50">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Lead Notes</h4>
                      <p className="text-xs md:text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{expandedLead.description}</p>
                  </div>
              </div>
          </div>
      )}
    </>
  );
};

export default LeadsWidget;