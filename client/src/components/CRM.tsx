import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
    KanbanSquare, CheckSquare, Search, Loader2, 
    MoreVertical, Phone, Clock, User as UserIcon, Calendar,
    Plus, Trash2, Edit2, Users, X, CheckCircle2, AlertCircle, GripVertical,
    LayoutGrid, AlignJustify, LayoutDashboard, ArrowUpRight, ArrowDownRight
} from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API || "http://localhost:8080").replace(/\/$/, "");

interface Lead {
    _id: string;
    name: string;
    phoneNumber: string;
    status: string;
    description?: string;
    assignedTo?: { _id: string, name: string, username: string, photo?: string }[];
    createdAt: string;
}

interface Task {
    _id: string;
    title: string;
    description: string;
    dueDate: string;
    status: string;
    assignedTo: { _id: string, name: string, username: string, photo?: string }[];
    leadId?: { _id: string, name: string };
    isCalendarSynced: boolean;
    sortOrder?: number;
    priority?: string;
}

const PIPELINE_STAGES = ['New', 'Contacted', 'Trial Scheduled', 'Converted', 'Lost'];

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
        <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-black uppercase tracking-wider shadow-sm ${styles[safePriority as keyof typeof styles]}`}>
            {icons[safePriority as keyof typeof icons]} {safePriority}
        </div>
    );
};

const CRM = () => {
    // Primary Tabs & Views
    const [activeTab, setActiveTab] = useState<'tasks' | 'pipeline' | 'split'>('tasks');
    const [taskView, setTaskView] = useState<'list' | 'team' | 'status' | 'leads' | 'calendar'>('list');
    
    const [leads, setLeads] = useState<Lead[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [teamMembers, setTeamMembers] = useState<any[]>([]);
    
    // Filters & States
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [staffFilter, setStaffFilter] = useState<{username: string, name: string, photo?: string} | null>(null);
    const [filterInput, setFilterInput] = useState("");
    const [showFilterDropdown, setShowFilterDropdown] = useState(false);
    
    // Task Modal Search States
    const [taskTeamSearch, setTaskTeamSearch] = useState("");
    const [showTaskTeamDropdown, setShowTaskTeamDropdown] = useState(false);

    // Refs
    const filterRef = useRef<HTMLDivElement>(null);
    const kanbanRef = useRef<HTMLDivElement>(null);  
    const teamGridRef = useRef<HTMLDivElement>(null);
    const clickStartPos = useRef<{x: number, y: number} | null>(null);

    // Drag & Drop State
    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

    // Modals
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [showLeadModal, setShowLeadModal] = useState(false);
    const [editTaskData, setEditTaskData] = useState<Task | null>(null);
    const [editLeadData, setEditLeadData] = useState<Lead | null>(null);
    const [expandedItem, setExpandedItem] = useState<{title: string, description: string} | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Form States
    const [newLeadData, setNewLeadData] = useState({ 
        name: '', phoneNumber: '', status: 'New', description: '', assignedStaff: [] as string[] 
    });
    const [leadTeamSearch, setLeadTeamSearch] = useState("");
    const [showLeadTeamDropdown, setShowLeadTeamDropdown] = useState(false);
    const [newTaskData, setNewTaskData] = useState({ 
        title: '', description: '', dueDate: '', 
        leadId: '', assignedStaff: [] as string[], addToCalendar: false,
        priority: 'Medium' as string
    });

    // Toast State
    const [toast, setToast] = useState<{show: boolean, message: string, type: 'success' | 'error'}>({ show: false, message: '', type: 'success' });

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
    };

    useEffect(() => {
        fetchDashboardData();
        const handleClickOutside = (event: MouseEvent) => {
            if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
                setShowFilterDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const fetchDashboardData = async () => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem("jwtoken");
            const headers = { Authorization: `Bearer ${token}` };

            const [leadsRes, tasksRes, teamRes] = await Promise.all([
                axios.get(`${API_BASE}/leads`, { headers }),
                axios.get(`${API_BASE}/tasks?scope=all`, { headers }),
                axios.get(`${API_BASE}/team`) 
            ]);

            setLeads(leadsRes.data);
            setTasks(tasksRes.data);
            setTeamMembers(teamRes.data);
        } catch (error) {
            console.error("Failed to fetch CRM data:", error);
            showToast("Failed to load dashboard data.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const openNewTaskModal = (prefillUsername?: string, prefillLeadId?: string, prefillDate?: string) => {
        setNewTaskData({ 
            title: '', description: '', 
            dueDate: prefillDate ? `${prefillDate}T10:00` : '', 
            leadId: prefillLeadId || '', 
            assignedStaff: prefillUsername ? [prefillUsername] : [], 
            addToCalendar: true,
            priority: 'Medium'
        });
        setTaskTeamSearch("");
        setShowTaskModal(true);
    };

    // ==========================================
    // DRAG & DROP HANDLERS
    // ==========================================
    const handleDragOver = (e: React.DragEvent) => e.preventDefault(); 

    const handleLeadDragStart = (e: React.DragEvent, leadId: string) => e.dataTransfer.setData("leadId", leadId);

    const handleLeadDrop = async (e: React.DragEvent, newStatus: string) => {
        e.preventDefault();
        const leadId = e.dataTransfer.getData("leadId");
        if (!leadId) return;

        setLeads(prev => prev.map(l => l._id === leadId ? { ...l, status: newStatus } : l));
        try { await axios.put(`${API_BASE}/leads/${leadId}/status`, { status: newStatus }); } 
        catch (error) { fetchDashboardData(); showToast("Failed to move lead.", "error"); }
    };

    const handleTaskDragStart = (e: React.DragEvent, taskId: string) => {
        e.dataTransfer.setData("taskId", taskId);
        setDraggedTaskId(taskId);
    };

    const handleTaskDrop = async (e: React.DragEvent, targetTaskId: string) => {
        e.preventDefault();
        const draggedId = e.dataTransfer.getData("taskId");
        setDraggedTaskId(null);
        if (!draggedId || draggedId === targetTaskId) return;

        const newTasks = [...tasks];
        const draggedIndex = newTasks.findIndex(t => t._id === draggedId);
        const targetIndex = newTasks.findIndex(t => t._id === targetTaskId);
        
        const [removedItem] = newTasks.splice(draggedIndex, 1);
        newTasks.splice(targetIndex, 0, removedItem);
        setTasks(newTasks);

        try {
            const token = localStorage.getItem("jwtoken");
            const taskIdsInOrder = newTasks.map(t => t._id);
            await axios.put(`${API_BASE}/tasks/reorder`, { taskIds: taskIdsInOrder }, { headers: { Authorization: `Bearer ${token}` } });
        } catch (error) {
            showToast("Failed to save new task order.", "error");
        }
    };

    // ==========================================
    // CRUD HANDLERS
    // ==========================================
    const toggleTaskStatus = async (taskId: string, currentStatus: string) => {
        const newStatus = currentStatus === 'Completed' ? 'Pending' : 'Completed';
        setTasks(prev => prev.map(t => t._id === taskId ? { ...t, status: newStatus } : t));
        try { await axios.put(`${API_BASE}/tasks/${taskId}/status`, { status: newStatus }); } 
        catch (error) { fetchDashboardData(); showToast("Failed to update status.", "error"); }
    };

    const handleDeleteTask = async (taskId: string) => {
        if (!window.confirm("Delete this task permanently?")) return;
        setTasks(prev => prev.filter(t => t._id !== taskId));
        try {
            const token = localStorage.getItem("jwtoken");
            await axios.delete(`${API_BASE}/tasks/${taskId}`, { headers: { Authorization: `Bearer ${token}` } });
            showToast("Task deleted.", "success");
        } catch (error) { fetchDashboardData(); showToast("Failed to delete task.", "error"); }
    };

    const handleSaveEdit = async () => {
        if (!editTaskData) return;
        setIsSaving(true);
        try {
            const token = localStorage.getItem("jwtoken");
            const payload = { 
                ...editTaskData, 
                assignedTo: editTaskData.assignedTo?.map((u: any) => u._id) || [],
                leadId: editTaskData.leadId?._id || editTaskData.leadId || null
            };

            await axios.put(`${API_BASE}/tasks/${editTaskData._id}`, payload, { 
                headers: { Authorization: `Bearer ${token}` } 
            });
            
            // Update local state so the UI reflects the change immediately
            setTasks(prev => prev.map(t => t._id === editTaskData._id ? editTaskData : t));
            setEditTaskData(null);
            showToast("Task updated successfully!", "success");
        } catch (error) { 
            console.error("Task Edit Error:", error); 
            showToast("Failed to save edits.", "error"); 
        } finally { 
            setIsSaving(false); 
        }
    };

    const handleCreateLead = async () => {
        if (!newLeadData.phoneNumber) return showToast("Phone number is required", "error");
        setIsSaving(true);
        try {
            const token = localStorage.getItem("jwtoken");
            const currentUsername = localStorage.getItem("Username") || "";

            // Force assignment to self if empty
            const payload = { ...newLeadData };
            if (payload.assignedStaff.length === 0 && currentUsername) {
                payload.assignedStaff = [currentUsername];
            }

            await axios.post(`${API_BASE}/leads/manual`, payload, { headers: { Authorization: `Bearer ${token}` } });
            fetchDashboardData();
            setShowLeadModal(false);
            setNewLeadData({ name: '', phoneNumber: '', status: 'New', description: '', assignedStaff: [] });
            showToast("Lead added successfully!", "success");
        } catch (error) { showToast("Failed to create lead.", "error"); }
        finally { setIsSaving(false); }
    };

    const handleDeleteLead = async (leadId: string) => {
        if (!window.confirm("Delete this lead permanently?")) return;
        setLeads(prev => prev.filter(l => l._id !== leadId));
        try {
            const token = localStorage.getItem("jwtoken");
            await axios.delete(`${API_BASE}/leads/${leadId}`, { headers: { Authorization: `Bearer ${token}` } });
            showToast("Lead deleted.", "success");
        } catch (error) { fetchDashboardData(); showToast("Failed to delete lead.", "error"); }
    };

    const handleSaveLeadEdit = async () => {
        if (!editLeadData) return;
        setIsSaving(true);
        try {
            const token = localStorage.getItem("jwtoken");
            const payload = { ...editLeadData, assignedTo: editLeadData.assignedTo?.map((u: any) => u._id) || [] };
            await axios.put(`${API_BASE}/leads/${editLeadData._id}`, payload, { headers: { Authorization: `Bearer ${token}` } });
            
            setLeads(prev => prev.map(l => l._id === editLeadData._id ? editLeadData : l));
            setEditLeadData(null);
            showToast("Lead updated successfully!", "success");
        } catch (error) { showToast("Failed to save lead edits.", "error"); }
        finally { setIsSaving(false); }
    };

    const handleCreateTask = async () => {
        if (!newTaskData.title) return showToast("Title is required", "error");
        setIsSaving(true);
        try {
            const token = localStorage.getItem("jwtoken");
            await axios.post(`${API_BASE}/tasks`, newTaskData, { headers: { Authorization: `Bearer ${token}` } });
            
            if (newTaskData.addToCalendar && newTaskData.dueDate) {
                const startDate = new Date(newTaskData.dueDate);
                const endDate = new Date(startDate.getTime() + 15 * 60000); 
                await fetch(`${API_BASE}/calendar-events`, {
                    method: "POST",
                    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
                    body: JSON.stringify({
                        title: newTaskData.title, description: newTaskData.description,
                        date: startDate.toISOString(), endTime: endDate.toISOString(),
                        type: 'task', color: 'bg-brand-orange', guests: newTaskData.assignedStaff, addMeet: false 
                    })
                });
            }
            fetchDashboardData();
            setShowTaskModal(false);
            setNewTaskData({ title: '', description: '', dueDate: '', leadId: '', assignedStaff: [], addToCalendar: false, priority: 'Medium' });
            showToast("Task created successfully!", "success");
        } catch (error) { showToast("Failed to create task.", "error"); }
        finally { setIsSaving(false); }
    };

    // Filter Logic
    const filteredTasks = tasks.filter(task => {
        const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              (task.description && task.description.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesStaff = !staffFilter || task.assignedTo.some(u => u.username === staffFilter.username);
        return matchesSearch && matchesStaff;
    });

    const pendingTasks = filteredTasks.filter(t => t.status !== 'Completed');
    const completedTasks = filteredTasks.filter(t => t.status === 'Completed');
    const visibleTeamMembers = teamMembers.filter(m => m.name.toLowerCase().includes(filterInput.toLowerCase()) || m.username.toLowerCase().includes(filterInput.toLowerCase()));

    const sortedTeamMembers = [...teamMembers].sort((a, b) => {
        const aTaskCount = pendingTasks.filter(t => t.assignedTo.some(u => u.username === a.username)).length;
        const bTaskCount = pendingTasks.filter(t => t.assignedTo.some(u => u.username === b.username)).length;
        return bTaskCount - aTaskCount;
    });

    const calendarGroups = pendingTasks.reduce((acc, task) => {
        const dateKey = task.dueDate ? new Date(task.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric'}) : 'Unscheduled';
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(task);
        return acc;
    }, {} as Record<string, Task[]>);

    const sortedCalendarDates = Object.keys(calendarGroups).sort((a, b) => {
        if (a === 'Unscheduled') return -1;
        if (b === 'Unscheduled') return 1;
        return new Date(a).getTime() - new Date(b).getTime();
    });

    // ==========================================
    // TASK CARD RENDERER
    // ==========================================
    const renderTaskCard = (task: Task, isGrid: boolean = false) => {
        const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'Completed';
        const isCompleted = task.status === 'Completed';
        
        return (
            <div 
                key={task._id} 
                draggable
                onDragStart={(e) => handleTaskDragStart(e, task._id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleTaskDrop(e, task._id)}
                className={`flex items-start gap-3 p-3 md:px-4 md:py-3 rounded-xl border transition-all group ${
                    draggedTaskId === task._id ? 'opacity-50 border-dashed border-brand-blue' :
                    isCompleted ? 'bg-gray-50 border-gray-100 opacity-60 hover:opacity-100' :
                    isOverdue ? 'bg-rose-50/30 border-rose-200 shadow-sm hover:shadow-md' : 'bg-white border-gray-200 shadow-sm hover:shadow-md hover:border-brand-blue/30'
                }`}
            >
                <button onClick={() => toggleTaskStatus(task._id, task.status)} className={`mt-0.5 shrink-0 w-5 h-5 rounded flex items-center justify-center transition-colors border-2 ${isCompleted ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 text-transparent hover:border-brand-blue hover:bg-blue-50'}`}>
                    <CheckSquare size={14} strokeWidth={3} />
                </button>

                <div className={`flex-1 min-w-0 flex ${isGrid ? 'flex-col' : 'flex-col md:flex-row md:items-center justify-between'} gap-2`}>
                    <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <h4 className={`text-sm font-bold truncate ${isCompleted ? 'text-gray-500 line-through' : 'text-slate-800'}`}>{task.title}</h4>
                            {task.isCalendarSynced && <span title="Synced to Google Calendar" className="shrink-0"><Calendar size={12} className="text-brand-blue opacity-70" /></span>}
                        </div>
                        {task.description && (
                            <div 
                                onClick={(e) => { e.stopPropagation(); setExpandedItem({ title: task.title, description: task.description }); }}
                                className="cursor-pointer group/desc mt-0.5 w-full"
                            >
                                <p className={`text-xs text-gray-500 group-hover/desc:text-brand-blue transition-colors ${isGrid ? 'line-clamp-2' : 'truncate w-full'}`}>
                                    {task.description}
                                </p>
                            </div>
                        )}
                    </div>

                    <div className={`flex items-center shrink-0 flex-wrap ${isGrid ? 'gap-2 w-full justify-between mt-2 pt-2 border-t border-gray-50' : 'gap-3'}`}>
                        {/* Tags */}
                        <div className="flex items-center gap-2">
                            <PriorityBadge priority={task.priority} />
                            {task.leadId && (
                                <div className="flex items-center gap-1 text-[10px] font-bold text-brand-orange bg-orange-50 px-2 py-1 rounded-md border border-orange-100">
                                    <UserIcon size={10} strokeWidth={3} /> {(task.leadId.name || "Unknown").split(' ')[0]}
                                </div>
                            )}
                            {task.dueDate && (
                                <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md border ${isOverdue && !isCompleted ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                                    <Clock size={10} strokeWidth={3} /> {new Date(task.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric'})}
                                </div>
                            )}
                        </div>

                        {/* Avatars & Actions */}
                        <div className="flex items-center gap-2">
                            {task.assignedTo && task.assignedTo.length > 0 && (
                                <div className="flex items-center -space-x-1.5">
                                    {task.assignedTo.map((user, idx) => (
                                        <div key={user._id} title={`@${user.username}`} className="w-6 h-6 rounded-full border-2 border-white bg-brand-blue text-white flex items-center justify-center text-[8px] font-bold z-10 shadow-sm overflow-hidden relative" style={{ zIndex: 10 - idx }}>
                                            {user.photo ? <img src={user.photo} className="w-full h-full object-cover" /> : (user.name || "U").charAt(0).toUpperCase()}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Actions & Drag Handle */}
                            <div className={`flex items-center gap-1 shrink-0 ml-1 transition-opacity ${isGrid ? 'opacity-100 md:opacity-0 group-hover:opacity-100' : 'border-l border-gray-100 pl-2 opacity-100 md:opacity-0 group-hover:opacity-100'}`}>
                                <button onClick={() => setEditTaskData(task)} className="p-1.5 text-gray-400 hover:text-brand-blue hover:bg-blue-50 rounded-lg transition focus:opacity-100"><Edit2 size={12} /></button>
                                <button onClick={() => handleDeleteTask(task._id)} className="p-1.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition focus:opacity-100"><Trash2 size={12} /></button>
                                <div className="p-1.5 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 transition"><GripVertical size={14} /></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="w-full h-full flex flex-col min-h-0 relative">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-center md:items-start mb-6 gap-4 shrink-0 w-full">
                <div className="text-center md:text-left w-full md:w-auto">
                    <h2 className="text-3xl font-display font-bold text-brand-blue">Management</h2>
                    <p className="text-gray-500 font-medium text-sm mt-1">Track leads and manage team tasks.</p>
                </div>

                <div className="hidden md:flex items-center gap-3 w-auto">
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button onClick={() => setActiveTab('tasks')} className={`flex items-center gap-2 px-6 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'tasks' ? 'bg-white text-brand-blue shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                            <CheckSquare size={16} /> Tasks
                        </button>
                        <button onClick={() => setActiveTab('pipeline')} className={`flex items-center gap-2 px-6 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'pipeline' ? 'bg-white text-brand-blue shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                            <KanbanSquare size={16} /> Pipeline
                        </button>
                        <button onClick={() => setActiveTab('split')} className={`flex items-center gap-2 px-6 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'split' ? 'bg-white text-brand-blue shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                            <LayoutGrid size={16} /> Split View
                        </button>
                    </div>

                    <button 
                        onClick={() => activeTab === 'pipeline' ? setShowLeadModal(true) : openNewTaskModal()}
                        className="bg-brand-orange text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-orange-600 transition shadow-md whitespace-nowrap active:scale-95"
                    >
                        <Plus size={18} strokeWidth={3} />
                        <span>New {activeTab === 'pipeline' ? 'Lead' : 'Task'}</span>
                    </button>
                </div>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 min-h-0 bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden flex flex-col mb-26 md:mb-0">
                
                {/* TOOLBAR */}
                <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-wrap gap-4 items-center shrink-0 z-20 overflow-visible">
                    <div className="relative flex-1 min-w-50 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input 
                            type="text" placeholder={`Search ${activeTab}...`} value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10 text-sm transition-all"
                        />
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        
                        {/* SEARCHABLE FILTER DROPDOWN */}
                        <div className="relative shrink-0" ref={filterRef}>
                            {staffFilter ? (
                                <button onClick={() => setShowFilterDropdown(!showFilterDropdown)} className="flex items-center gap-2 px-4 py-2 border border-brand-blue bg-blue-50 text-brand-blue shadow-sm rounded-xl text-sm font-bold transition-all">
                                    {staffFilter.photo ? <img src={staffFilter.photo} className="w-5 h-5 rounded-full object-cover shadow-sm" /> : <div className="w-5 h-5 rounded-full bg-brand-blue text-white flex items-center justify-center text-[10px]">{(staffFilter.name || "U").charAt(0).toUpperCase()}</div>}
                                    {staffFilter.name.split(' ')[0]}
                                    <div onClick={(e) => { e.stopPropagation(); setStaffFilter(null); setFilterInput(""); }} className="ml-1 text-brand-blue hover:text-rose-500 bg-white rounded-full p-0.5 shadow-sm"><X size={12} strokeWidth={3} /></div>
                                </button>
                            ) : (
                                <div className="relative">
                                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                    <input 
                                        type="text" value={filterInput}
                                        onChange={(e) => { setFilterInput(e.target.value); setShowFilterDropdown(true); }}
                                        onFocus={() => setShowFilterDropdown(true)}
                                        placeholder="Filter by team..."
                                        className="w-48 pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10 text-sm transition-all"
                                    />
                                </div>
                            )}

                            {/* Dropdown Menu */}
                            {showFilterDropdown && (
                                <div className="absolute right-0 md:left-0 mt-2 w-56 bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 p-1 z-50">
                                    <div onClick={() => { setStaffFilter(null); setFilterInput(""); setShowFilterDropdown(false); }} className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition ${!staffFilter ? 'bg-blue-50 text-brand-blue font-bold' : 'hover:bg-slate-50 text-gray-700 font-medium'}`}>
                                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500"><Users size={14} /></div> Everyone
                                    </div>
                                    <div className="h-px bg-gray-100 my-1 mx-2"></div>
                                    {visibleTeamMembers.length === 0 ? <div className="p-3 text-center text-xs text-gray-400 font-medium">No members found.</div> : (
                                        visibleTeamMembers.map(member => (
                                            <div key={member._id} onMouseDown={(e) => { e.preventDefault(); setStaffFilter(member); setFilterInput(""); setShowFilterDropdown(false); }} className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition ${staffFilter?.username === member.username ? 'bg-blue-50 text-brand-blue font-bold' : 'hover:bg-slate-50 text-gray-700 font-medium'}`}>
                                                {member.photo ? <img src={member.photo} className="w-8 h-8 rounded-full object-cover border border-gray-200 shadow-sm" /> : <div className="w-8 h-8 rounded-full bg-brand-blue/10 text-brand-blue flex items-center justify-center font-bold text-xs shadow-inner">{(member.name || "U").charAt(0).toUpperCase()}</div>}
                                                <div className="flex flex-col"><span className="text-sm leading-tight">{member.name}</span><span className="text-[10px] text-gray-400 font-normal tracking-wide">@{member.username}</span></div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>

                        {activeTab === 'tasks' && (
                            <>
                                <div className="w-px h-8 bg-gray-200 hidden md:block"></div>
                                <div className="flex bg-slate-100 p-1 rounded-xl shrink-0 overflow-x-auto no-scrollbar">
                                    <button onClick={() => setTaskView('list')} className={`p-1.5 rounded-lg transition-all ${taskView === 'list' ? 'bg-white shadow-sm text-brand-blue' : 'text-slate-400 hover:text-slate-600'}`} title="List View"><AlignJustify size={16} /></button>
                                    <button onClick={() => setTaskView('team')} className={`p-1.5 rounded-lg transition-all ${taskView === 'team' ? 'bg-white shadow-sm text-brand-blue' : 'text-slate-400 hover:text-slate-600'}`} title="Team Board View"><Users size={16} /></button>
                                    <button onClick={() => setTaskView('status')} className={`p-1.5 rounded-lg transition-all ${taskView === 'status' ? 'bg-white shadow-sm text-brand-blue' : 'text-slate-400 hover:text-slate-600'}`} title="Status Board View"><LayoutDashboard size={16} /></button>
                                    <button onClick={() => setTaskView('leads')} className={`p-1.5 rounded-lg transition-all ${taskView === 'leads' ? 'bg-white shadow-sm text-brand-blue' : 'text-slate-400 hover:text-slate-600'}`} title="Lead Board View"><UserIcon size={16} /></button>
                                    <button onClick={() => setTaskView('calendar')} className={`p-1.5 rounded-lg transition-all ${taskView === 'calendar' ? 'bg-white shadow-sm text-brand-blue' : 'text-slate-400 hover:text-slate-600'}`} title="Calendar Timeline"><Calendar size={16} /></button>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <Loader2 className="w-10 h-10 text-brand-blue animate-spin" />
                    </div>
                ) : (
                    <div className={`flex-1 overflow-hidden bg-slate-50/30 ${activeTab === 'split' ? 'flex flex-row' : 'relative'}`}>
                        
                        {/* =========================================
                            ✅ 1. TASK VIEW: HIGH-DENSITY LIST
                        ========================================= */}
                        {((activeTab === 'tasks' && taskView === 'list') || activeTab === 'split') && (
                            <div className={`${activeTab === 'split' ? 'relative w-1/2 border-r border-gray-200' : 'absolute inset-0'} overflow-y-auto custom-scrollbar p-4 md:p-6 z-10`}>
                                {filteredTasks.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                                        <CheckSquare size={48} className="opacity-20 mb-4" />
                                        <p className="font-bold text-lg">No tasks found.</p>
                                    </div>
                                ) : (
                                    <div className="max-w-5xl mx-auto pb-10">
                                        <div className="space-y-2.5">
                                            {pendingTasks.map(task => renderTaskCard(task, false))}
                                        </div>

                                        {completedTasks.length > 0 && (
                                            <>
                                                <div className="flex items-center gap-4 my-8">
                                                    <div className="flex-1 h-px bg-gray-200"></div>
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-slate-50 px-2">Completed ({completedTasks.length})</span>
                                                    <div className="flex-1 h-px bg-gray-200"></div>
                                                </div>
                                                <div className="space-y-2.5">
                                                    {completedTasks.map(task => renderTaskCard(task, false))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* =========================================
                            ✅ 2. TASK VIEW: TEAM BOARD 
                        ========================================= */}
                        {activeTab === 'tasks' && taskView === 'team' && (
                            <div ref={teamGridRef} className="absolute inset-0 overflow-x-auto overflow-y-hidden custom-scrollbar flex p-6 gap-6 z-10 scroll-smooth">
                                {/* Unassigned Column */}
                                <div className="flex flex-col w-[320px] shrink-0 h-full max-h-full">
                                    <div className="flex items-center justify-between p-3 rounded-t-2xl border-b-2 bg-slate-100 border-slate-300 text-slate-700">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-slate-400"><Users size={12}/></div>
                                            <h3 className="font-bold text-sm uppercase tracking-wider">Unassigned</h3>
                                        </div>
                                        <button onClick={() => openNewTaskModal()} className="p-1 bg-white/50 rounded-lg hover:bg-white transition" title="Add unassigned task"><Plus size={14}/></button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 bg-gray-50/50 rounded-b-2xl border-x border-b border-gray-100 space-y-2">
                                        {pendingTasks.filter(t => t.assignedTo.length === 0).map(task => renderTaskCard(task, true))}
                                    </div>
                                </div>

                                {/* Dynamic Member Columns */}
                                {sortedTeamMembers.map(member => {
                                    const memberTasks = pendingTasks.filter(t => t.assignedTo.some(u => u.username === member.username));
                                    return (
                                        <div key={member.username} className="flex flex-col w-[320px] shrink-0 h-full max-h-full">
                                            <div className="flex items-center justify-between p-3 rounded-t-2xl border-b-2 bg-blue-50 border-brand-blue text-brand-blue">
                                                <div className="flex items-center gap-2">
                                                    {member.photo ? <img src={member.photo} className="w-6 h-6 rounded-full object-cover shadow-sm border border-blue-200" /> : <div className="w-6 h-6 rounded-full bg-brand-blue text-white flex items-center justify-center text-[10px] font-bold">{(member.name || "U").charAt(0).toUpperCase()}</div>}
                                                    <h3 className="font-bold text-sm truncate max-w-37.5">{member.name.split(' ')[0]}</h3>
                                                    <span className="bg-white/50 px-1.5 py-0.5 rounded text-[10px] font-black">{memberTasks.length}</span>
                                                </div>
                                                <button onClick={() => openNewTaskModal(member.username)} className="p-1 bg-white/50 rounded-lg hover:bg-white transition" title={`Add task for ${member.name}`}><Plus size={14}/></button>
                                            </div>
                                            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 bg-gray-50/50 rounded-b-2xl border-x border-b border-gray-100 space-y-2">
                                                {memberTasks.map(task => renderTaskCard(task, true))}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        {/* =========================================
                            ✅ 3. TASK VIEW: STATUS KANBAN
                        ========================================= */}
                        {activeTab === 'tasks' && taskView === 'status' && (
                            <div ref={teamGridRef} className="absolute inset-0 overflow-x-auto overflow-y-hidden custom-scrollbar flex p-6 gap-6 z-10 scroll-smooth">
                                {/* Overdue Column */}
                                <div className="flex flex-col w-[320px] shrink-0 h-full max-h-full">
                                    <div className="flex items-center justify-between p-3 rounded-t-2xl border-b-2 bg-rose-50 border-rose-500 text-rose-700">
                                        <h3 className="font-bold text-sm uppercase tracking-wider">Overdue</h3>
                                        <span className="bg-white/50 px-2 py-0.5 rounded-full text-xs font-black">{pendingTasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date()).length}</span>
                                    </div>
                                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 bg-gray-50/50 rounded-b-2xl border-x border-b border-gray-100 space-y-2">
                                        {pendingTasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date()).map(task => renderTaskCard(task, true))}
                                    </div>
                                </div>
                                {/* Upcoming Column */}
                                <div className="flex flex-col w-[320px] shrink-0 h-full max-h-full">
                                    <div className="flex items-center justify-between p-3 rounded-t-2xl border-b-2 bg-brand-blue/10 border-brand-blue text-brand-blue">
                                        <h3 className="font-bold text-sm uppercase tracking-wider">Upcoming</h3>
                                        <span className="bg-white/50 px-2 py-0.5 rounded-full text-xs font-black">{pendingTasks.filter(t => !t.dueDate || new Date(t.dueDate) >= new Date()).length}</span>
                                    </div>
                                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 bg-gray-50/50 rounded-b-2xl border-x border-b border-gray-100 space-y-2">
                                        {pendingTasks.filter(t => !t.dueDate || new Date(t.dueDate) >= new Date()).map(task => renderTaskCard(task, true))}
                                    </div>
                                </div>
                                {/* Completed Column */}
                                <div className="flex flex-col w-[320px] shrink-0 h-full max-h-full">
                                    <div className="flex items-center justify-between p-3 rounded-t-2xl border-b-2 bg-green-50 border-green-500 text-green-700">
                                        <h3 className="font-bold text-sm uppercase tracking-wider">Completed</h3>
                                        <span className="bg-white/50 px-2 py-0.5 rounded-full text-xs font-black">{completedTasks.length}</span>
                                    </div>
                                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 bg-gray-50/50 rounded-b-2xl border-x border-b border-gray-100 space-y-2">
                                        {completedTasks.map(task => renderTaskCard(task, true))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* =========================================
                            ✅ 4. TASK VIEW: LEAD BOARD
                        ========================================= */}
                        {activeTab === 'tasks' && taskView === 'leads' && (
                            <div ref={teamGridRef} className="absolute inset-0 overflow-x-auto overflow-y-hidden custom-scrollbar flex p-6 gap-6 z-10 scroll-smooth">
                                <div className="flex flex-col w-[320px] shrink-0 h-full max-h-full">
                                    <div className="flex items-center justify-between p-3 rounded-t-2xl border-b-2 bg-slate-100 border-slate-300 text-slate-700">
                                        <h3 className="font-bold text-sm uppercase tracking-wider">General (No Lead)</h3>
                                        <button onClick={() => openNewTaskModal()} className="p-1 bg-white/50 rounded-lg hover:bg-white transition"><Plus size={14}/></button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 bg-gray-50/50 rounded-b-2xl border-x border-b border-gray-100 space-y-2">
                                        {pendingTasks.filter(t => !t.leadId).map(task => renderTaskCard(task, true))}
                                    </div>
                                </div>
                                {leads.filter(l => pendingTasks.some(t => t.leadId?._id === l._id)).map(lead => {
                                    const leadTasks = pendingTasks.filter(t => t.leadId?._id === lead._id);
                                    return (
                                        <div key={lead._id} className="flex flex-col w-[320px] shrink-0 h-full max-h-full">
                                            <div className="flex items-center justify-between p-3 rounded-t-2xl border-b-2 bg-orange-50 border-brand-orange text-brand-orange">
                                                <h3 className="font-bold text-sm truncate max-w-50">{lead.name}</h3>
                                                <button onClick={() => openNewTaskModal(undefined, lead._id)} className="p-1 bg-white/50 rounded-lg hover:bg-white transition"><Plus size={14}/></button>
                                            </div>
                                            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 bg-gray-50/50 rounded-b-2xl border-x border-b border-gray-100 space-y-2">
                                                {leadTasks.map(task => renderTaskCard(task, true))}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        {/* =========================================
                            ✅ 5. TASK VIEW: CALENDAR TIMELINE
                        ========================================= */}
                        {activeTab === 'tasks' && taskView === 'calendar' && (
                            <div ref={teamGridRef} className="absolute inset-0 overflow-x-auto overflow-y-hidden custom-scrollbar flex p-6 gap-6 z-10 scroll-smooth">
                                {sortedCalendarDates.map(dateLabel => (
                                    <div key={dateLabel} className="flex flex-col w-[320px] shrink-0 h-full max-h-full">
                                        <div className={`flex items-center justify-between p-3 rounded-t-2xl border-b-2 ${dateLabel === 'Unscheduled' ? 'bg-slate-100 border-slate-300 text-slate-700' : 'bg-brand-blue/10 border-brand-blue text-brand-blue'}`}>
                                            <h3 className="font-bold text-sm tracking-wider">{dateLabel}</h3>
                                            <span className="bg-white/50 px-2 py-0.5 rounded-full text-xs font-black">{calendarGroups[dateLabel].length}</span>
                                        </div>
                                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 bg-gray-50/50 rounded-b-2xl border-x border-b border-gray-100 space-y-2">
                                            {calendarGroups[dateLabel].map(task => renderTaskCard(task, true))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* =========================================
                            📊 PIPELINE VIEW
                        ========================================= */}
                        {(activeTab === 'pipeline' || activeTab === 'split') && (
                            <div ref={kanbanRef} className={`${activeTab === 'split' ? 'relative w-1/2' : 'absolute inset-0'} overflow-x-auto overflow-y-hidden custom-scrollbar flex p-6 gap-6 z-10 scroll-smooth`}>
                                {PIPELINE_STAGES.map(stage => {
                                    const columnLeads = leads.filter(l => {
                                        const matchesStage = (l.status === stage || (!l.status && stage === 'New'));
                                        const matchesSearch = l.name.toLowerCase().includes(searchQuery.toLowerCase()) || l.phoneNumber.includes(searchQuery);
                                        const matchesStaff = !staffFilter || (l.assignedTo && l.assignedTo.some(u => u.username === staffFilter.username));
                                        
                                        return matchesStage && matchesSearch && matchesStaff;
                                    });
                                    return (
                                        <div key={stage} onDragOver={handleDragOver} onDrop={(e) => handleLeadDrop(e, stage)} className="flex flex-col w-75 shrink-0 h-full max-h-full">
                                            <div className={`flex items-center justify-between p-3 rounded-t-2xl border-b-2 ${stage === 'Converted' ? 'bg-green-50 border-green-500 text-green-700' : stage === 'Lost' ? 'bg-rose-50 border-rose-500 text-rose-700' : stage === 'Trial Scheduled' ? 'bg-brand-blue/10 border-brand-blue text-brand-blue' : 'bg-gray-100 border-gray-300 text-gray-700'}`}>
                                                <h3 className="font-bold text-sm uppercase tracking-wider">{stage}</h3>
                                                <span className="bg-white/50 px-2 py-0.5 rounded-full text-xs font-black">{columnLeads.length}</span>
                                            </div>
                                            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 bg-gray-50/50 rounded-b-2xl border-x border-b border-gray-100 space-y-2">
                                                {columnLeads.map(lead => (
                                                    <div key={lead._id} draggable onDragStart={(e) => handleLeadDragStart(e, lead._id)} className="bg-white p-3 rounded-xl shadow-sm border border-gray-200 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-brand-blue/30 transition-all group flex flex-col">
                                                        
                                                        {/* Header: Name & Action Icons */}
                                                        <div className="flex justify-between items-start mb-1.5">
                                                            <h4 className="font-bold text-sm text-gray-800 truncate pr-2">{lead.name}</h4>
                                                            <div className="flex items-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                                <button onClick={(e) => { e.stopPropagation(); setEditLeadData(lead); }} className="p-1 text-gray-400 hover:text-brand-blue"><Edit2 size={14} /></button>
                                                                <button onClick={(e) => { e.stopPropagation(); handleDeleteLead(lead._id); }} className="p-1 text-gray-400 hover:text-rose-500"><Trash2 size={14} /></button>
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Smart Click Workaround */}
                                                        {lead.description && (
                                                            <div 
                                                                onMouseDown={(e) => { 
                                                                    e.stopPropagation(); 
                                                                    clickStartPos.current = { x: e.clientX, y: e.clientY }; 
                                                                }}
                                                                onMouseUp={(e) => {
                                                                    if (!clickStartPos.current) return;
                                                                    const dx = Math.abs(e.clientX - clickStartPos.current.x);
                                                                    const dy = Math.abs(e.clientY - clickStartPos.current.y);
                                                                    
                                                                    if (dx < 5 && dy < 5) {
                                                                        e.stopPropagation();
                                                                        setExpandedItem({ title: lead.name, description: lead.description || "" });
                                                                    }
                                                                    clickStartPos.current = null;
                                                                }}
                                                                className="w-full mb-2 bg-slate-50 p-2 rounded-lg border border-slate-100 cursor-pointer hover:border-brand-blue/30 transition-all group/read"
                                                            >
                                                                <p className="text-[11px] text-gray-500 leading-snug line-clamp-2">{lead.description}</p>
                                                                <p className="text-[9px] text-brand-blue font-bold mt-1 opacity-0 group-hover/read:opacity-100 transition-opacity">Read Full Notes →</p>
                                                            </div>
                                                        )}

                                                        <div className="flex items-center gap-1.5 text-xs text-brand-orange font-medium mb-3">
                                                            <Phone size={12} /> {lead.phoneNumber}
                                                        </div>
                                                        
                                                        {/* Footer: Date & Assigned Staff Avatars */}
                                                        <div className="flex justify-between items-center text-[10px] text-gray-400 font-bold pt-2 border-t border-gray-50 mt-auto">
                                                            <span className="flex items-center gap-1"><Clock size={10} /> {new Date(lead.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric'})}</span>
                                                            
                                                            {lead.assignedTo && lead.assignedTo.length > 0 && (
                                                                <div className="flex items-center -space-x-1.5 ml-1">
                                                                    {lead.assignedTo.map((user, idx) => (
                                                                        <div key={user._id} title={`@${user.username}`} className="w-5 h-5 rounded-full border border-white bg-brand-blue text-white flex items-center justify-center text-[8px] font-bold z-10 shadow-sm overflow-hidden relative" style={{ zIndex: 10 - idx }}>
                                                                            {user.photo ? <img src={user.photo} className="w-full h-full object-cover" /> : (user.name || "U").charAt(0).toUpperCase()}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>

                                                    </div>
                                                ))}
                                                {columnLeads.length === 0 && <div className="text-center p-4 text-xs text-gray-400 font-medium border-2 border-dashed border-gray-200 rounded-xl">Drop leads here</div>}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* 📱 MOBILE BOTTOM NAVIGATION (Floating Pill) */}
            <div className="md:hidden fixed bottom-22 left-4 right-4 h-16 bg-white/95 backdrop-blur-md border border-gray-200/60 flex items-center justify-around z-90 px-4 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
                <button onClick={() => setActiveTab('tasks')} className={`flex flex-col items-center gap-1 flex-1 ${activeTab === 'tasks' ? 'text-brand-blue' : 'text-gray-400 hover:text-gray-600'}`}>
                    <CheckSquare size={20} className={activeTab === 'tasks' ? 'fill-blue-50' : ''} />
                    <span className="text-[10px] font-bold">Tasks</span>
                </button>
                
                <div className="flex-1 flex justify-center">
                    <button 
                        onClick={() => activeTab === 'pipeline' ? setShowLeadModal(true) : openNewTaskModal()} 
                        className="bg-brand-orange text-white w-14 h-14 rounded-full flex items-center justify-center shadow-lg -mt-8 border-4 border-white active:scale-95 transition-transform relative z-10"
                    >
                        <Plus size={24} strokeWidth={3} />
                    </button>
                </div>

                <button onClick={() => setActiveTab('pipeline')} className={`flex flex-col items-center gap-1 flex-1 ${activeTab === 'pipeline' ? 'text-brand-blue' : 'text-gray-400 hover:text-gray-600'}`}>
                    <KanbanSquare size={20} className={activeTab === 'pipeline' ? 'fill-blue-50' : ''} />
                    <span className="text-[10px] font-bold">Leads</span>
                </button>
            </div>

            {/* =========================================
                🚨 1. EDIT TASK MODAL
            ========================================= */}
            {editTaskData && (
                <div className="fixed inset-0 z-1000 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl md:rounded-4xl w-full max-w-md md:max-w-3xl overflow-hidden shadow-2xl animate-in zoom-in duration-200">
                        <div className="p-4 md:p-6 border-b border-gray-100 flex justify-between items-center bg-brand-blue text-white">
                            <div className="flex items-center gap-2">
                                <Edit2 size={20} />
                                <h3 className="text-lg font-bold">Edit Task</h3>
                            </div>
                            <button onClick={() => setEditTaskData(null)} className="hover:bg-white/20 p-1.5 rounded-full transition">
                                <X size={20}/>
                            </button>
                        </div>

                        <div className="p-4 md:p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6">
                                {/* LEFT COLUMN */}
                                <div className="space-y-4 flex flex-col">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Task Title *</label>
                                        <input 
                                            type="text" value={editTaskData.title} 
                                            onChange={e => setEditTaskData({...editTaskData, title: e.target.value})} 
                                            className="w-full mt-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-blue" 
                                        />
                                    </div>
                                    <div className="flex-1 flex flex-col">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Task Details</label>
                                        <textarea 
                                            value={editTaskData.description} 
                                            onChange={e => setEditTaskData({...editTaskData, description: e.target.value})} 
                                            className="w-full mt-1 flex-1 min-h-30 md:min-h-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-blue resize-none text-sm text-slate-700" 
                                        />
                                    </div>
                                </div>

                                {/* RIGHT COLUMN */}
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Priority</label>
                                        <select 
                                            value={editTaskData.priority || 'Medium'} 
                                            onChange={e => setEditTaskData({...editTaskData, priority: e.target.value})} 
                                            className="w-full mt-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-blue font-bold text-slate-700 appearance-none"
                                        >
                                            <option value="High">🔴 High Priority</option>
                                            <option value="Medium">🟠 Medium Priority</option>
                                            <option value="Low">⚪ Low Priority</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Due Date & Time</label>
                                        <input 
                                            type="datetime-local" 
                                            value={editTaskData.dueDate ? new Date(new Date(editTaskData.dueDate).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""} 
                                            onChange={e => setEditTaskData({...editTaskData, dueDate: e.target.value})} 
                                            className="w-full mt-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-blue font-bold text-brand-blue" 
                                        />
                                    </div>
                                    
                                    {/* Edit Staff Search Bar */}
                                    <div className="relative">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Assign Team Members</label>
                                        <div className="relative mt-1">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                            <input 
                                                type="text" 
                                                value={taskTeamSearch}
                                                onChange={(e) => { setTaskTeamSearch(e.target.value); setShowTaskTeamDropdown(true); }}
                                                onFocus={() => setShowTaskTeamDropdown(true)}
                                                onBlur={() => setTimeout(() => setShowTaskTeamDropdown(false), 200)}
                                                placeholder="Search name or @username..."
                                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-blue transition-all text-sm" 
                                            />
                                            {/* Dropdown */}
                                            {showTaskTeamDropdown && taskTeamSearch.trim() !== "" && (
                                                <div className="absolute z-100 w-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl max-h-48 overflow-y-auto custom-scrollbar p-1 animate-in fade-in slide-in-from-top-2">
                                                    {teamMembers.filter(m => 
                                                        !editTaskData.assignedTo.some(u => u.username === m.username) && 
                                                        (m.name.toLowerCase().includes(taskTeamSearch.toLowerCase()) || 
                                                         m.username.toLowerCase().includes(taskTeamSearch.toLowerCase()))
                                                    ).length === 0 ? (
                                                        <div className="p-4 text-center text-xs text-gray-400 font-medium">No members found.</div>
                                                    ) : (
                                                        teamMembers.filter(m => 
                                                            !editTaskData.assignedTo.some(u => u.username === m.username) && 
                                                            (m.name.toLowerCase().includes(taskTeamSearch.toLowerCase()) || 
                                                             m.username.toLowerCase().includes(taskTeamSearch.toLowerCase()))
                                                        ).map(staff => (
                                                            <div 
                                                                key={staff._id}
                                                                onMouseDown={(e) => {
                                                                    e.preventDefault(); 
                                                                    setEditTaskData(prev => prev ? {...prev, assignedTo: [...prev.assignedTo, staff]} : null);
                                                                    setTaskTeamSearch("");
                                                                    setShowTaskTeamDropdown(false);
                                                                }}
                                                                className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors group"
                                                            >
                                                                {staff.photo ? (
                                                                    <img src={staff.photo} alt={staff.name} className="w-6 h-6 rounded-full object-cover shadow-sm border border-slate-200 shrink-0" />
                                                                ) : (
                                                                    <div className="w-6 h-6 rounded-full bg-brand-blue/10 text-brand-blue flex items-center justify-center font-bold text-[10px] shrink-0 shadow-inner">
                                                                        {staff.name.charAt(0).toUpperCase()}
                                                                    </div>
                                                                )}
                                                                <div className="flex flex-col">
                                                                    <span className="text-xs font-bold text-gray-800 leading-tight">{staff.name}</span>
                                                                    <span className="text-[10px] font-medium text-gray-400">@{staff.username}</span>
                                                                </div>
                                                                <div className="ml-auto w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-brand-blue group-hover:text-white transition-all shrink-0">
                                                                    <Plus size={10} strokeWidth={3} />
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        
                                        {/* Selected Staff Tags */}
                                        <div className="flex flex-wrap gap-2 mt-3 min-h-7">
                                            {editTaskData.assignedTo.length === 0 && (
                                                <span className="text-xs text-slate-400 italic mt-1 ml-1">No one assigned yet</span>
                                            )}
                                            {editTaskData.assignedTo.map(user => (
                                                <span key={user.username} className="bg-white text-slate-700 pl-1 pr-1.5 py-1 rounded-full text-xs font-bold flex items-center gap-2 border border-slate-200 shadow-sm animate-in zoom-in duration-200">
                                                    {user.photo ? (
                                                        <img src={user.photo} alt={user.name} className="w-5 h-5 rounded-full object-cover" />
                                                    ) : (
                                                        <div className="w-5 h-5 rounded-full bg-brand-blue/10 text-brand-blue flex items-center justify-center text-[8px] shrink-0">
                                                            {user.name.charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                    {user.name.split(' ')[0]}
                                                    <button 
                                                        type="button"
                                                        onClick={() => setEditTaskData({...editTaskData, assignedTo: editTaskData.assignedTo.filter(x => x.username !== user.username)})}
                                                        className="w-4 h-4 flex items-center justify-center bg-slate-100 rounded-full hover:bg-rose-500 hover:text-white text-slate-400 transition-colors"
                                                    >
                                                        <X size={10} strokeWidth={3} />
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setEditTaskData(null)} className="flex-1 py-4 bg-gray-100 text-gray-600 font-black rounded-2xl hover:bg-gray-200 transition">CANCEL</button>
                                <button onClick={handleSaveEdit} disabled={isSaving} className="flex-2 py-4 bg-brand-blue text-white font-black rounded-2xl shadow-xl shadow-blue-500/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:scale-100">
                                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : "SAVE CHANGES"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* =========================================
                🚨 ADD NEW LEAD MODAL
            ========================================= */}
            {showLeadModal && (
                <div className="fixed inset-0 z-10000 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl md:rounded-4xl w-full max-w-md md:max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in duration-200">
                        
                        <div className="p-4 md:p-6 border-b border-gray-100 flex justify-between items-center bg-brand-blue text-white shrink-0">
                            <div className="flex items-center gap-2">
                                <UserIcon size={20} />
                                <h3 className="text-lg font-bold">Add Manual Lead</h3>
                            </div>
                            <button onClick={() => setShowLeadModal(false)} className="hover:bg-white/20 p-1.5 rounded-full transition">
                                <X size={20}/>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6">
                                <div className="space-y-4 flex flex-col">
                                    <div className="flex gap-4 flex-col sm:flex-row">
                                        <div className="flex-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Name</label>
                                            <input type="text" placeholder="e.g. John Doe" value={newLeadData.name} onChange={e => setNewLeadData({...newLeadData, name: e.target.value})} className="w-full mt-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-blue" />
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number *</label>
                                            <input type="text" placeholder="e.g. 9198..." value={newLeadData.phoneNumber} onChange={e => setNewLeadData({...newLeadData, phoneNumber: e.target.value})} className="w-full mt-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-blue" />
                                        </div>
                                    </div>
                                    <div className="flex-1 flex flex-col">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Notes</label>
                                        <textarea placeholder="Context..." value={newLeadData.description} onChange={e => setNewLeadData({...newLeadData, description: e.target.value})} className="w-full mt-1 flex-1 min-h-30 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-blue resize-none text-sm text-slate-700" />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Stage</label>
                                        <select value={newLeadData.status} onChange={e => setNewLeadData({...newLeadData, status: e.target.value})} className="w-full mt-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-blue font-bold text-brand-blue">
                                            <option value="New">New</option><option value="Contacted">Contacted</option><option value="Trial Scheduled">Trial Scheduled</option><option value="Converted">Converted</option><option value="Lost">Lost</option>
                                        </select>
                                    </div>
                                    <div className="relative">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Assign Sales Team</label>
                                        <div className="relative mt-1">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                            <input type="text" value={leadTeamSearch} onChange={(e) => { setLeadTeamSearch(e.target.value); setShowLeadTeamDropdown(true); }} placeholder="Search team..." className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm" />
                                            {showLeadTeamDropdown && leadTeamSearch.trim() !== "" && (
                                                <div className="absolute z-100 w-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl max-h-40 overflow-y-auto p-1">
                                                    {teamMembers.filter(m => !newLeadData.assignedStaff.includes(m.username) && (m.name.toLowerCase().includes(leadTeamSearch.toLowerCase()) || m.username.toLowerCase().includes(leadTeamSearch.toLowerCase()))).map(staff => (
                                                        <div key={staff._id} onMouseDown={() => { setNewLeadData(prev => ({...prev, assignedStaff: [...prev.assignedStaff, staff.username]})); setLeadTeamSearch(""); }} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors">
                                                            <div className="w-6 h-6 rounded-full bg-brand-blue/10 text-brand-blue flex items-center justify-center font-bold text-[10px]">{staff.name.charAt(0)}</div>
                                                            <span className="text-xs font-bold text-gray-800">{staff.name}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 md:p-6 border-t bg-gray-50 shrink-0">
                            <button onClick={handleCreateLead} disabled={isSaving || !newLeadData.phoneNumber} className="w-full py-4 bg-brand-blue text-white font-black rounded-xl shadow-xl flex items-center justify-center gap-2">
                                {isSaving ? <Loader2 size={18} className="animate-spin" /> : "CREATE LEAD"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* =========================================
                🚨 ADD NEW TASK MODAL
            ========================================= */}
            {showTaskModal && (
                <div className="fixed inset-0 z-10000 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl md:rounded-4xl w-full max-w-md md:max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in duration-200">
                        
                        <div className="p-4 md:p-6 border-b border-gray-100 flex justify-between items-center bg-brand-blue text-white shrink-0">
                            <div className="flex items-center gap-2">
                                <Clock size={20} />
                                <h3 className="text-lg font-bold">Schedule Task</h3>
                            </div>
                            <button onClick={() => setShowTaskModal(false)} className="hover:bg-white/20 p-1.5 rounded-full transition">
                                <X size={20}/>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6">
                                <div className="space-y-4 flex flex-col">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Task Title *</label>
                                        <input type="text" value={newTaskData.title} onChange={e => setNewTaskData({...newTaskData, title: e.target.value})} className="w-full mt-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-blue" />
                                    </div>
                                    <div className="flex-1 flex flex-col">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Details</label>
                                        <textarea value={newTaskData.description} onChange={e => setNewTaskData({...newTaskData, description: e.target.value})} className="w-full mt-1 flex-1 min-h-30 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-blue resize-none text-sm text-slate-700" />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Priority</label>
                                        <select value={newTaskData.priority} onChange={e => setNewTaskData({...newTaskData, priority: e.target.value})} className="w-full mt-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold">
                                            <option value="High">🔴 High</option><option value="Medium">🟠 Medium</option><option value="Low">⚪ Low</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Due Date</label>
                                        <input type="datetime-local" value={newTaskData.dueDate} onChange={e => setNewTaskData({...newTaskData, dueDate: e.target.value})} className="w-full mt-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-brand-blue" />
                                    </div>

                                    <div className="relative">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Assign Team Members</label>
                                        <div className="relative mt-1">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                            <input 
                                                type="text" 
                                                value={taskTeamSearch}
                                                onChange={(e) => { setTaskTeamSearch(e.target.value); setShowTaskTeamDropdown(true); }}
                                                onFocus={() => setShowTaskTeamDropdown(true)}
                                                onBlur={() => setTimeout(() => setShowTaskTeamDropdown(false), 200)}
                                                placeholder="Search name or @username..."
                                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-blue transition-all text-sm" 
                                            />
                                            
                                            {showTaskTeamDropdown && taskTeamSearch.trim() !== "" && (
                                                <div className="absolute z-100 w-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl max-h-48 overflow-y-auto custom-scrollbar p-1 animate-in fade-in slide-in-from-top-2">
                                                    {teamMembers.filter(m => 
                                                        !newTaskData.assignedStaff.includes(m.username) && 
                                                        (m.name.toLowerCase().includes(taskTeamSearch.toLowerCase()) || 
                                                         m.username.toLowerCase().includes(taskTeamSearch.toLowerCase()))
                                                    ).length === 0 ? (
                                                        <div className="p-4 text-center text-xs text-gray-400 font-medium">No members found.</div>
                                                    ) : (
                                                        teamMembers.filter(m => 
                                                            !newTaskData.assignedStaff.includes(m.username) && 
                                                            (m.name.toLowerCase().includes(taskTeamSearch.toLowerCase()) || 
                                                             m.username.toLowerCase().includes(taskTeamSearch.toLowerCase()))
                                                        ).map(staff => (
                                                            <div 
                                                                key={staff._id}
                                                                onMouseDown={(e) => {
                                                                    e.preventDefault(); 
                                                                    setNewTaskData(prev => ({...prev, assignedStaff: [...prev.assignedStaff, staff.username]}));
                                                                    setTaskTeamSearch("");
                                                                    setShowTaskTeamDropdown(false);
                                                                }}
                                                                className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors group"
                                                            >
                                                                {staff.photo ? (
                                                                    <img src={staff.photo} alt={staff.name} className="w-6 h-6 rounded-full object-cover shadow-sm border border-slate-200 shrink-0" />
                                                                ) : (
                                                                    <div className="w-6 h-6 rounded-full bg-brand-blue/10 text-brand-blue flex items-center justify-center font-bold text-[10px] shrink-0 shadow-inner">
                                                                        {staff.name.charAt(0).toUpperCase()}
                                                                    </div>
                                                                )}
                                                                <div className="flex flex-col">
                                                                    <span className="text-xs font-bold text-gray-800 leading-tight">{staff.name}</span>
                                                                    <span className="text-[10px] font-medium text-gray-400">@{staff.username}</span>
                                                                </div>
                                                                <div className="ml-auto w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-brand-blue group-hover:text-white transition-all shrink-0">
                                                                    <Plus size={10} strokeWidth={3} />
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        
                                        {/* Selected Staff Tags */}
                                        <div className="flex flex-wrap gap-2 mt-3 min-h-7">
                                            {newTaskData.assignedStaff.length === 0 && (
                                                <span className="text-xs text-slate-400 italic mt-1 ml-1">No one assigned yet</span>
                                            )}
                                            {newTaskData.assignedStaff.map(username => {
                                                const staff = teamMembers.find(m => m.username === username);
                                                const displayName = staff ? staff.name : username;
                                                const photo = staff?.photo;

                                                return (
                                                    <span key={username} className="bg-white text-slate-700 pl-1 pr-1.5 py-1 rounded-full text-xs font-bold flex items-center gap-2 border border-slate-200 shadow-sm animate-in zoom-in duration-200">
                                                        {photo ? (
                                                            <img src={photo} alt={displayName} className="w-5 h-5 rounded-full object-cover" />
                                                        ) : (
                                                            <div className="w-5 h-5 rounded-full bg-brand-blue/10 text-brand-blue flex items-center justify-center text-[8px] shrink-0">
                                                                {displayName.charAt(0).toUpperCase()}
                                                            </div>
                                                        )}
                                                        {displayName.split(' ')[0]}
                                                        <button 
                                                            type="button"
                                                            onClick={() => setNewTaskData({...newTaskData, assignedStaff: newTaskData.assignedStaff.filter(x => x !== username)})}
                                                            className="w-4 h-4 flex items-center justify-center bg-slate-100 rounded-full hover:bg-rose-500 hover:text-white text-slate-400 transition-colors"
                                                        >
                                                            <X size={10} strokeWidth={3} />
                                                        </button>
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl cursor-pointer hover:bg-slate-100 transition border border-slate-200 mt-2">
                                        <input type="checkbox" checked={newTaskData.addToCalendar} onChange={e => setNewTaskData({...newTaskData, addToCalendar: e.target.checked})} className="w-5 h-5 text-brand-blue rounded-lg shrink-0" />
                                        <div className="flex-1"><p className="text-sm font-bold">Sync to Calendar</p></div>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 md:p-6 border-t bg-gray-50 shrink-0">
                            <button onClick={handleCreateTask} disabled={isSaving || !newTaskData.title} className="w-full py-4 bg-brand-blue text-white font-black rounded-xl shadow-xl flex items-center justify-center gap-2">
                                {isSaving ? <Loader2 size={18} className="animate-spin" /> : "CREATE & SYNC TASK"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 📖 FULL SCREEN READING MODAL */}
            {expandedItem && (
                <div className="fixed inset-0 z-20000 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl md:rounded-4xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden border border-white/20">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-brand-blue text-white">
                            <h3 className="text-xl font-bold pr-4 truncate">{expandedItem.title}</h3>
                            <button onClick={() => setExpandedItem(null)} className="hover:bg-white/20 p-2 rounded-full transition shrink-0"><X size={20}/></button>
                        </div>
                        <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/50">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Complete Notes / Description</h4>
                            <p className="text-sm md:text-base text-slate-700 leading-relaxed whitespace-pre-wrap">{expandedItem.description}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* ✏️ EDIT LEAD MODAL */}
            {editLeadData && (
                <div className="fixed inset-0 z-10000 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl md:rounded-4xl w-full max-w-md md:max-w-3xl overflow-hidden shadow-2xl animate-in zoom-in duration-200">
                        <div className="p-4 md:p-6 border-b border-gray-100 flex justify-between items-center bg-brand-blue text-white">
                            <div className="flex items-center gap-2"><Edit2 size={20} /><h3 className="text-lg font-bold">Edit Lead</h3></div>
                            <button onClick={() => setEditLeadData(null)} className="hover:bg-white/20 p-1.5 rounded-full transition"><X size={20}/></button>
                        </div>

                        <div className="p-4 md:p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6">
                                <div className="space-y-4 flex flex-col">
                                    <div className="flex gap-4 flex-col sm:flex-row">
                                        <div className="flex-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Name</label><input type="text" value={editLeadData.name} onChange={e => setEditLeadData({...editLeadData, name: e.target.value})} className="w-full mt-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-blue" /></div>
                                        <div className="flex-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number *</label><input type="text" value={editLeadData.phoneNumber} onChange={e => setEditLeadData({...editLeadData, phoneNumber: e.target.value})} className="w-full mt-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-blue" /></div>
                                    </div>
                                    <div className="flex-1 flex flex-col"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Notes / Description</label><textarea value={editLeadData.description} onChange={e => setEditLeadData({...editLeadData, description: e.target.value})} className="w-full mt-1 flex-1 min-h-30 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-blue resize-none text-sm text-slate-700" /></div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Stage</label>
                                        <select value={editLeadData.status} onChange={e => setEditLeadData({...editLeadData, status: e.target.value})} className="w-full mt-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-blue font-bold text-brand-blue">
                                            <option value="New">New</option><option value="Contacted">Contacted</option><option value="Trial Scheduled">Trial Scheduled</option><option value="Converted">Converted</option><option value="Lost">Lost</option>
                                        </select>
                                    </div>
                                    <div className="relative">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Assign Sales Team</label>
                                        <div className="relative mt-1">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                            <input type="text" value={filterInput} onChange={(e) => { setFilterInput(e.target.value); setShowFilterDropdown(true); }} onFocus={() => setShowFilterDropdown(true)} onBlur={() => setTimeout(() => setShowFilterDropdown(false), 200)} placeholder="Search team..." className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-blue text-sm" />
                                            {showFilterDropdown && filterInput.trim() !== "" && (
                                                <div className="absolute z-100 w-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl max-h-48 overflow-y-auto p-1">
                                                    {teamMembers.filter(m => !(Array.isArray(editLeadData.assignedTo) ? editLeadData.assignedTo : []).some((u: any) => u.username === m.username) && (m.name.toLowerCase().includes(filterInput.toLowerCase()) || m.username.toLowerCase().includes(filterInput.toLowerCase()))).map(staff => (
                                                        <div key={staff._id} onMouseDown={(e) => { e.preventDefault(); setEditLeadData(prev => prev ? {...prev, assignedTo: [...(Array.isArray(prev.assignedTo) ? prev.assignedTo : []), staff]} : null); setFilterInput(""); setShowFilterDropdown(false); }} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors">
                                                            {staff.photo ? <img src={staff.photo} className="w-6 h-6 rounded-full object-cover shadow-sm border border-slate-200 shrink-0" /> : <div className="w-6 h-6 rounded-full bg-brand-blue/10 text-brand-blue flex items-center justify-center font-bold text-[10px] shrink-0">{staff.name.charAt(0).toUpperCase()}</div>}
                                                            <div className="flex flex-col"><span className="text-xs font-bold text-gray-800">{staff.name}</span></div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-2 mt-3 min-h-7">
                                            {(!editLeadData.assignedTo || (Array.isArray(editLeadData.assignedTo) && editLeadData.assignedTo.length === 0)) && (
                                                <span className="text-xs text-slate-400 italic mt-1 ml-1">Unassigned</span>
                                            )}
                                            {(Array.isArray(editLeadData.assignedTo) ? editLeadData.assignedTo : []).map(user => (
                                                <span key={user.username || user._id || Math.random()} className="bg-white text-slate-700 pl-1 pr-1.5 py-1 rounded-full text-xs font-bold flex items-center gap-2 border border-slate-200 shadow-sm">
                                                    {user.photo ? <img src={user.photo} className="w-5 h-5 rounded-full object-cover" /> : <div className="w-5 h-5 rounded-full bg-brand-blue/10 text-brand-blue flex items-center justify-center text-[8px] shrink-0">{(user.name || "U").charAt(0).toUpperCase()}</div>}
                                                    {(user.name || user.username || "Unknown").split(' ')[0]}
                                                    <button type="button" onClick={() => setEditLeadData({...editLeadData, assignedTo: (Array.isArray(editLeadData.assignedTo) ? editLeadData.assignedTo : []).filter((x: any) => x.username !== user.username)})} className="w-4 h-4 flex items-center justify-center bg-slate-100 rounded-full hover:bg-rose-500 hover:text-white text-slate-400 transition-colors"><X size={10} strokeWidth={3} /></button>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setEditLeadData(null)} className="flex-1 py-4 bg-gray-100 text-gray-600 font-black rounded-2xl hover:bg-gray-200 transition">CANCEL</button>
                                <button onClick={handleSaveLeadEdit} disabled={isSaving} className="flex-2 py-4 bg-brand-blue text-white font-black rounded-2xl shadow-xl shadow-blue-500/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : "SAVE CHANGES"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TOAST NOTIFICATION */}
            {toast.show && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-11000 animate-in fade-in slide-in-from-bottom-8 duration-300 pointer-events-none">
                    <div className={`flex items-center gap-2.5 px-5 py-3.5 rounded-full shadow-2xl border font-bold text-sm tracking-wide ${
                        toast.type === 'success' ? 'bg-green-50 text-green-700 border-green-200 shadow-green-900/10' : 'bg-rose-50 text-rose-700 border-rose-200 shadow-rose-900/10'
                    }`}>
                        {toast.type === 'success' ? <CheckCircle2 size={20} className="text-green-500" /> : <AlertCircle size={20} className="text-rose-500" />}
                        {toast.message}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CRM;