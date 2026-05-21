import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, CheckCircle2, Plus, X, Loader2, AlignLeft, 
  ArrowDown, ArrowUp, AlertCircle, ArrowUpRight, ArrowDownRight, Clock, Search 
} from 'lucide-react';

// 🚨 Reusable Priority Badge
const PriorityBadge = ({ priority }: { priority?: string }) => {
    const safePriority = priority || 'Medium';
    const styles = {
        High: "bg-rose-50 text-rose-600 border-rose-200",
        Medium: "bg-amber-50 text-amber-600 border-amber-200",
        Low: "bg-slate-50 text-slate-500 border-slate-200",
    };
    const icons = {
        High: <ArrowUpRight size={10} strokeWidth={3} />,
        Medium: <AlertCircle size={10} strokeWidth={2.5} />,
        Low: <ArrowDownRight size={10} strokeWidth={2.5} />,
    };

    return (
        <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-black uppercase tracking-wider shadow-sm shrink-0 ${styles[safePriority as keyof typeof styles]}`}>
            {icons[safePriority as keyof typeof icons]} {safePriority}
        </div>
    );
};

const TasksWidget = ({ data }: { data: any }) => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('Medium'); 
  const [newTaskDueDate, setNewTaskDueDate] = useState(''); 

  // 🚨 NEW: Insta-like Search States
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [taskTeamSearch, setTaskTeamSearch] = useState("");
  const [showTaskTeamDropdown, setShowTaskTeamDropdown] = useState(false);
  const [selectedAssignees, setSelectedAssignees] = useState<any[]>([]);

  // Sorting State
  const [sortBy, setSortBy] = useState<'priority' | 'date'>('priority');
  const [sortDesc, setSortDesc] = useState(true);
  
  const [expandedTask, setExpandedTask] = useState<{title: string, description: string} | null>(null);

  useEffect(() => {
    if (data && Array.isArray(data)) setTasks(data);
  }, [data]);

  // 🚨 Fetch Team Members only when they open the "Add Task" panel
  useEffect(() => {
      if (isAdding && teamMembers.length === 0) {
          const fetchTeam = async () => {
              try {
                  const res = await fetch(`${import.meta.env.VITE_API}team`);
                  if (res.ok) setTeamMembers(await res.json());
              } catch (e) {
                  console.error("Failed to load team", e);
              }
          };
          fetchTeam();
      }
  }, [isAdding]);

  // THE SORTING ENGINE
  const priorityWeight: Record<string, number> = { High: 3, Medium: 2, Low: 1 };
  
  const pendingTasks = tasks.filter(t => t.status !== 'Completed').sort((a, b) => {
      if (sortBy === 'priority') {
          const valA = priorityWeight[a.priority || 'Medium'];
          const valB = priorityWeight[b.priority || 'Medium'];
          if (valA !== valB) return sortDesc ? valB - valA : valA - valB;
          const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
          const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
          return dateA - dateB;
      } else {
          const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
          const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
          if (dateA !== dateB) return sortDesc ? dateB - dateA : dateA - dateB; 
          const valA = priorityWeight[a.priority || 'Medium'];
          const valB = priorityWeight[b.priority || 'Medium'];
          return valB - valA;
      }
  });

  const completedTasks = tasks.filter(t => t.status === 'Completed');

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;
    setIsSaving(true);
    
    try {
      const token = localStorage.getItem("jwtoken");
      const currentUsername = localStorage.getItem("Username") || "";
      
      let assignedStaff = selectedAssignees.map(user => user.username);
      
      // 🚨 FIX: ALWAYS include the creator in the assigned list so they show up in Management!
      if (!assignedStaff.includes(currentUsername)) {
        assignedStaff.push(currentUsername);
      }

      const finalDueDate = newTaskDueDate ? new Date(newTaskDueDate).toISOString() : undefined;

      const res = await fetch(`${import.meta.env.VITE_API}tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          title: newTaskTitle,
          description: newTaskDescription,
          priority: newTaskPriority,
          dueDate: finalDueDate,
          assignedStaff: assignedStaff
        })
      });

      if (res.ok) {
        const savedTask = await res.json();
        setTasks(prev => [savedTask, ...prev]); 
        setNewTaskTitle('');
        setNewTaskDescription('');
        setNewTaskPriority('Medium');
        setNewTaskDueDate(''); 
        setSelectedAssignees([]); // Reset selection
        setIsAdding(false);
      }
    } catch (error) {
      console.error("Failed to save task:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleTask = async (taskId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation(); 
    const taskToToggle = tasks.find(t => t._id === taskId);
    const newStatus = taskToToggle?.status === 'Completed' ? 'Pending' : 'Completed';

    setTasks(prev => prev.map(t => t._id === taskId ? { ...t, status: newStatus } : t));

    try {
      const token = localStorage.getItem("jwtoken");
      await fetch(`${import.meta.env.VITE_API}tasks/${taskId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus })
      });
    } catch (error) {
      console.error("Failed to sync task status", error);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-brand-orange shadow-[0_0_8px_rgba(255,100,0,0.5)]" />
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Priority Tasks</h3>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200/50 shadow-sm">
            <select value={sortBy} onChange={e => setSortBy(e.target.value as 'priority' | 'date')} className="bg-transparent text-[9px] font-bold text-slate-600 outline-none cursor-pointer pl-1.5 pr-1 appearance-none">
                <option value="priority">Sort: Priority</option>
                <option value="date">Sort: Date</option>
            </select>
            <div className="w-px h-3 bg-slate-300 mx-1"></div>
            <button onClick={() => setSortDesc(!sortDesc)} className="p-1 hover:bg-white rounded-md transition text-slate-600 active:scale-95" title={sortDesc ? "Descending" : "Ascending"}>
                {sortDesc ? <ArrowDown size={12} strokeWidth={3} /> : <ArrowUp size={12} strokeWidth={3} />}
            </button>
          </div>

          <button onClick={() => setIsAdding(!isAdding)} className="w-6 h-6 flex items-center justify-center bg-brand-blue/10 text-brand-blue rounded-full hover:bg-brand-blue hover:text-white transition-colors">
            {isAdding ? <X size={14} strokeWidth={3} /> : <Plus size={14} strokeWidth={3} />}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 relative z-10 flex flex-col">
        
        {/* INLINE ADD FORM */}
        {isAdding && (
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 mb-4 animate-in fade-in slide-in-from-top-2">
            <input type="text" placeholder="Task Title..." value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} className="w-full bg-transparent text-xs font-bold text-slate-700 outline-none placeholder:text-slate-400 mb-2" autoFocus />
            <textarea placeholder="Add details, links, or context..." value={newTaskDescription} onChange={e => setNewTaskDescription(e.target.value)} rows={2} className="w-full bg-white px-3 py-2 rounded-xl text-[10px] font-medium text-slate-600 outline-none border border-slate-200 mb-2 focus:border-brand-blue/50 transition-colors resize-none custom-scrollbar" />
            
            <div className="flex flex-wrap gap-2 mb-3">
                {/* 🚨 THE INSTA-LIKE SEARCH DROPDOWN */}
                <div className="relative flex-1 min-w-30">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
                        <input 
                            type="text" 
                            value={taskTeamSearch}
                            onChange={(e) => { setTaskTeamSearch(e.target.value); setShowTaskTeamDropdown(true); }}
                            onFocus={() => setShowTaskTeamDropdown(true)}
                            onBlur={() => setTimeout(() => setShowTaskTeamDropdown(false), 200)}
                            placeholder="Assign team..."
                            className="w-full pl-7 pr-3 py-2 bg-white rounded-xl text-[10px] font-medium text-slate-600 outline-none border border-slate-200 focus:border-brand-blue/50 transition-colors"
                        />
                    </div>
                    {showTaskTeamDropdown && taskTeamSearch.trim() !== "" && (
                        <div className="absolute z-100 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-40 overflow-y-auto custom-scrollbar p-1">
                            {teamMembers.filter(m => 
                                !selectedAssignees.some(u => u.username === m.username) && 
                                (m.name.toLowerCase().includes(taskTeamSearch.toLowerCase()) || 
                                 m.username.toLowerCase().includes(taskTeamSearch.toLowerCase()))
                            ).length === 0 ? (
                                <div className="p-2 text-center text-[9px] text-gray-400 font-medium">No match</div>
                            ) : (
                                teamMembers.filter(m => 
                                    !selectedAssignees.some(u => u.username === m.username) && 
                                    (m.name.toLowerCase().includes(taskTeamSearch.toLowerCase()) || 
                                     m.username.toLowerCase().includes(taskTeamSearch.toLowerCase()))
                                ).map(staff => (
                                    <div 
                                        key={staff._id} 
                                        onMouseDown={(e) => { 
                                            e.preventDefault(); 
                                            setSelectedAssignees([...selectedAssignees, staff]); 
                                            setTaskTeamSearch(""); 
                                            setShowTaskTeamDropdown(false); 
                                        }} 
                                        className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                                    >
                                        {staff.photo ? <img src={staff.photo} className="w-5 h-5 rounded-full object-cover shrink-0" /> : <div className="w-5 h-5 rounded-full bg-brand-blue/10 text-brand-blue flex items-center justify-center font-bold text-[8px] shrink-0">{staff.name.charAt(0).toUpperCase()}</div>}
                                        <span className="text-[10px] font-bold text-gray-800 truncate">{staff.name}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                <input type="datetime-local" value={newTaskDueDate} onChange={e => setNewTaskDueDate(e.target.value)} className="bg-white px-2 py-2 rounded-xl text-[10px] font-bold text-slate-600 outline-none border border-slate-200 focus:border-brand-blue/50 transition-colors shrink-0" />
                <select value={newTaskPriority} onChange={e => setNewTaskPriority(e.target.value)} className="bg-white px-2 py-2 rounded-xl text-[10px] font-bold text-slate-600 outline-none border border-slate-200 focus:border-brand-blue/50 transition-colors shrink-0">
                    <option value="High">High</option>
                    <option value="Medium">Med</option>
                    <option value="Low">Low</option>
                </select>
            </div>

            {/* 🚨 SELECTED ASSIGNEE BADGES */}
            {selectedAssignees.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                    {selectedAssignees.map(user => (
                        <span key={user.username} className="bg-white text-slate-700 pl-1 pr-1.5 py-0.5 rounded-full text-[9px] font-bold flex items-center gap-1 border border-slate-200 shadow-sm animate-in zoom-in duration-200">
                            {user.photo ? <img src={user.photo} className="w-3.5 h-3.5 rounded-full object-cover" /> : <div className="w-3.5 h-3.5 rounded-full bg-brand-blue/10 text-brand-blue flex items-center justify-center text-[7px] shrink-0">{user.name.charAt(0).toUpperCase()}</div>}
                            {user.name.split(' ')[0]}
                            <button type="button" onClick={() => setSelectedAssignees(selectedAssignees.filter(x => x.username !== user.username))} className="w-3 h-3 flex items-center justify-center bg-slate-100 rounded-full hover:bg-rose-500 hover:text-white text-slate-400 transition-colors"><X size={8} strokeWidth={3} /></button>
                        </span>
                    ))}
                </div>
            )}
            
            <div className="flex items-center justify-end gap-2 mt-2">
              <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-slate-600 text-[10px] font-bold px-3 py-2 transition">Cancel</button>
              <button onClick={handleAddTask} disabled={isSaving || !newTaskTitle.trim()} className="bg-brand-blue text-white flex items-center gap-1.5 text-[10px] font-bold px-4 py-2 rounded-xl hover:bg-blue-600 transition disabled:opacity-50">
                {isSaving && <Loader2 size={12} className="animate-spin" />} Save Task
              </button>
            </div>
          </div>
        )}

        {/* PENDING TASKS */}
        <div className="space-y-2 mb-4">
            {pendingTasks.length > 0 ? pendingTasks.map((t) => (
            <div 
                key={t._id} 
                onClick={() => t.description ? setExpandedTask({ title: t.title, description: t.description }) : null}
                className={`flex items-start gap-3 p-3 bg-blue-50/50 rounded-2xl border border-blue-100/50 shrink-0 group/task ${t.description ? 'cursor-pointer hover:bg-blue-100/50 hover:border-brand-blue/30 transition-colors' : ''}`}
            >
                <button onClick={(e) => toggleTask(t._id, e)} className="w-5 h-5 mt-0.5 rounded-md bg-white border border-blue-200 flex items-center justify-center text-transparent hover:text-brand-blue hover:border-brand-blue shrink-0 transition-colors shadow-sm">
                    <ShieldCheck size={12} />
                </button>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-slate-700 block leading-snug truncate">{t.title}</span>
                        <PriorityBadge priority={t.priority} />
                    </div>
                    {t.description && (
                        <div className="flex items-start gap-1.5 mt-1.5 text-slate-500">
                            <AlignLeft size={10} className="mt-0.5 shrink-0 opacity-50 group-hover/task:text-brand-blue" />
                            <p className="text-[9px] font-medium leading-relaxed line-clamp-1 group-hover/task:text-slate-700 transition-colors">{t.description}</p>
                        </div>
                    )}
                    {t.dueDate && (
                        <div className="flex items-center gap-1 mt-1.5 text-[9px] font-bold text-slate-400">
                            <Clock size={10} /> {new Date(t.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                    )}
                </div>
            </div>
            )) : (!isAdding && (
            <div className="text-slate-400 text-xs font-bold text-center py-6 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                All tasks completed! 🎉
            </div>
            ))}
        </div>

        {/* COMPLETED TASKS */}
        {completedTasks.length > 0 && (
            <div className="mt-auto pt-4 border-t border-slate-100">
                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-2 px-1">Completed</p>
                <div className="space-y-2">
                    {completedTasks.map((t) => (
                    <div key={t._id} className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-xl border border-slate-100 opacity-60 hover:opacity-100 transition-opacity">
                        <button onClick={(e) => toggleTask(t._id, e)} className="text-green-500 shrink-0">
                            <CheckCircle2 size={16} />
                        </button>
                        <span className="text-[11px] font-bold text-slate-500 line-through truncate">{t.title}</span>
                    </div>
                    ))}
                </div>
            </div>
        )}
      </div>

      {/* DESCRIPTION MODAL / POPUP */}
      {expandedTask && (
          <div className="fixed inset-0 z-10000 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setExpandedTask(null)}>
              <div className="bg-white rounded-3xl md:rounded-4xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden border border-white/20" onClick={e => e.stopPropagation()}>
                  <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-brand-blue text-white shrink-0">
                      <h3 className="text-sm font-bold pr-4 leading-tight">{expandedTask.title}</h3>
                      <button onClick={() => setExpandedTask(null)} className="hover:bg-white/20 p-1.5 rounded-full transition shrink-0"><X size={16}/></button>
                  </div>
                  <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/50">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Task Details</h4>
                      <p className="text-xs md:text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{expandedTask.description}</p>
                  </div>
              </div>
          </div>
      )}
    </>
  );
};

export default TasksWidget;