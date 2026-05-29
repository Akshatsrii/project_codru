import React, { useState, useEffect, useMemo } from 'react';
import { fetchWithCache, invalidateCacheItem } from '../utils/apiCache';
import { useNavigate } from "react-router-dom";
import { 
  CheckCircle, Circle, AlertCircle, Filter, ChevronDown, Loader2, Plus,
  ChevronRight, User, TrendingUp, Clock, Zap, Maximize2, Minimize2, Search, X, Download, Edit3, BookOpen
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Muialert from "./Muialert";

export interface TrackerNode {
  _id: string;
  title: string;
  parentId: string | null;
  course: string;
  level: number;
  order: number;
  status: 'not_started' | 'completed' | 'completed_with_doubt';
  hasDoubt: boolean;
  isCustom: boolean;
  lastUpdated?: string;
  children?: TrackerNode[]; 
}

interface SyllabusTrackerProps {
  role: 'student' | 'teacher' | string;
  readOnly?: boolean;
  selectedStudentUsername?: string | null;
}

const ProgressBar = ({ percent, colorClass = "bg-brand-blue" }: { percent: number, colorClass?: string }) => (
  <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden mt-3 md:mt-4">
    <div 
      className={`h-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(0,0,0,0.1)] ${colorClass}`} 
      style={{ width: `${percent}%` }} 
    />
  </div>
);

const formatTimeAgo = (dateString?: string) => {
  if (!dateString) return null;
  return new Date(dateString).toLocaleString('en-GB', { 
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' 
  });
};

const getNodeStats = (node: TrackerNode): { total: number, completed: number, doubt: number } => {
  let total = 1;
  let completed = node.status.includes('completed') ? 1 : 0;
  let doubt = node.hasDoubt ? 1 : 0;

  node.children?.forEach(child => {
    const childStats = getNodeStats(child);
    total += childStats.total;
    completed += childStats.completed;
    doubt += childStats.doubt;
  });
  return { total, completed, doubt };
};

// --- HELPER: Get all descendant IDs for individual expand/collapse ---
const getDescendantIds = (node: TrackerNode): string[] => {
  let ids: string[] = [];
  if (node.children) {
    node.children.forEach(child => {
      ids.push(child._id);
      ids = ids.concat(getDescendantIds(child));
    });
  }
  return ids;
};

export const SyllabusTracker: React.FC<SyllabusTrackerProps> = ({ role, readOnly = false, selectedStudentUsername }) => {
  const navigate = useNavigate();
  const safeRole = role?.toLowerCase() || 'student';
  const myUsername = localStorage.getItem("Username") || localStorage.getItem("username");
  
  const targetUsername = selectedStudentUsername || myUsername;
  const isMyOwnSyllabus = safeRole === 'teacher' && selectedStudentUsername === myUsername;

  const [courses, setCourses] = useState<string[]>([]);
  const [activeCourse, setActiveCourse] = useState<string | null>(null);

  const [flatNodes, setFlatNodes] = useState<TrackerNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'doubts'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<string[]>([]);
  const [teacherStudents, setTeacherStudents] = useState<any[]>([]);

  const [alertInfo, setAlertInfo] = useState({ show: false, message: "", type: "info" as "success"| "error" | "info" });
  const [isMobileSearchActive, setIsMobileSearchActive] = useState(false);

  useEffect(() => {
    const fetchTeacherStudents = async () => {
      if (safeRole === 'teacher') {
        if (!myUsername) return;
        const token = localStorage.getItem("jwtoken");
        const res = await fetch(`${import.meta.env.VITE_API}my-students/${myUsername}`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) setTeacherStudents(await res.json());
      }
    };
    fetchTeacherStudents();
  }, [safeRole, myUsername]);

  useEffect(() => {
    const fetchCourses = async () => {
      if (safeRole === 'teacher' && !selectedStudentUsername) {
        setIsLoading(false);
        return;
      }
      try {
        const token = localStorage.getItem("jwtoken");
        let url = `${import.meta.env.VITE_API}dashboard/tracker/courses?username=${targetUsername}`;
        
        const res = await fetch(url, { headers: { "Authorization": `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          setCourses(data);
          
          if (data.length > 0) {
            if (!activeCourse || !data.includes(activeCourse)) {
              setActiveCourse(data[0]);
            }
            setIsLoading(false);
          } else { 
            setActiveCourse(null);
            setIsLoading(false); 
          }
        } else { 
          setIsLoading(false); 
        }
      } catch (err) { 
        console.error(err);
        setIsLoading(false); 
      }
    };
    fetchCourses();
  }, [safeRole, selectedStudentUsername, targetUsername]);

  const fetchSyllabusNodes = async () => {
    if (!activeCourse) return;
    setIsLoading(true);
    try {
      const token = localStorage.getItem("jwtoken");
      let url = `${import.meta.env.VITE_API}dashboard/tracker/nodes?course=${encodeURIComponent(activeCourse)}&username=${targetUsername}`;
      
      const data = await fetchWithCache(url, { "Authorization": `Bearer ${token}` }, true); 
      setFlatNodes(Array.isArray(data) ? data : []);
    } catch (error) { 
      console.error(error);
      setFlatNodes([]); 
    } finally { 
      setIsLoading(false); 
    }
  };

  useEffect(() => {
    fetchSyllabusNodes();
  }, [activeCourse, targetUsername]);

  const commonDoubts = useMemo(() => {
    if (safeRole !== 'teacher' || teacherStudents.length === 0) return [];
    
    const doubtMap = new Map<string, { count: number; course: string; title: string; lastUpdated: string | null }>();
    
    teacherStudents.forEach(student => {
      const studentSyllabus = Array.isArray(student.syllabus) ? student.syllabus : [];
      studentSyllabus.forEach((node: any) => {
        if (node.title && (node.hasDoubt || node.status === 'completed_with_doubt')) {
          const key = `${node.course}_${node.title}`;
          const existing = doubtMap.get(key);
          
          if (existing) {
            existing.count++;
            if (node.lastUpdated && (!existing.lastUpdated || new Date(node.lastUpdated) > new Date(existing.lastUpdated))) {
              existing.lastUpdated = node.lastUpdated;
            }
          } else {
            doubtMap.set(key, { 
              count: 1, 
              course: node.course || "General", 
              title: node.title, 
              lastUpdated: node.lastUpdated || null 
            });
          }
        }
      });
    });
    return Array.from(doubtMap.values()).sort((a, b) => b.count - a.count);
  }, [teacherStudents, safeRole]);

  const treeRoots = useMemo(() => {
    let filtered = flatNodes;
    if (filter === 'doubts') filtered = filtered.filter(n => n.hasDoubt || n.status === 'completed_with_doubt');
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(n => n.title.toLowerCase().includes(query));
    }
    
    const nodeMap = new Map<string, TrackerNode>();
    const roots: TrackerNode[] = [];
    
    filtered.forEach(node => nodeMap.set(node._id, { ...node, children: [] }));
    
    nodeMap.forEach(node => {
      if (node.parentId && nodeMap.has(node.parentId)) {
        nodeMap.get(node.parentId)!.children!.push(node);
      } else { 
        roots.push(node); 
      }
    });
    
    const sortNodes = (nodes: TrackerNode[]) => {
      nodes.sort((a, b) => a.order - b.order);
      nodes.forEach(n => { if (n.children) sortNodes(n.children); });
    };
    sortNodes(roots);
    
    return roots;
  }, [flatNodes, filter, searchQuery]);

  const overallStats = useMemo(() => {
    const total = flatNodes.length;
    const completed = flatNodes.filter(t => t.status.includes('completed')).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    const latestDate = flatNodes.map(t => t.lastUpdated).filter(Boolean).sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime())[0];
    return { total, completed, percentage, lastActivity: latestDate };
  }, [flatNodes]);

  const handleUpdateNode = async (nodeId: string, updates: { status?: TrackerNode['status'], hasDoubt?: boolean }) => {
    if (readOnly || (safeRole === 'teacher' && !isMyOwnSyllabus)) return; 
    
    const now = new Date().toISOString();
    
    setFlatNodes(prev => prev.map(t => {
      if (t._id === nodeId) {
        let newStatus = updates.status !== undefined ? updates.status : t.status;
        let newDoubt = updates.hasDoubt !== undefined ? updates.hasDoubt : t.hasDoubt;
        
        if (newDoubt && newStatus === 'completed') newStatus = 'completed_with_doubt';
        if (!newDoubt && newStatus === 'completed_with_doubt') newStatus = 'completed';
        
        return { ...t, status: newStatus, hasDoubt: newDoubt, lastUpdated: now };
      }
      return t;
    }));

    try {
      const token = localStorage.getItem("jwtoken");
      await fetch(`${import.meta.env.VITE_API}dashboard/tracker/progress`, {
        method: "PUT", 
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ nodeId, ...updates, username: targetUsername })   
      });
      invalidateCacheItem(`${import.meta.env.VITE_API}dashboard/tracker/nodes?course=${activeCourse}`);
    } catch (error) { 
      console.error(error); 
    }
  };

  // --- GLOBAL EXPAND/COLLAPSE ---
  const handleExpandAll = () => {
    setExpandedNodes(flatNodes.filter(n => flatNodes.some(child => child.parentId === n._id)).map(n => n._id));
  };
  const handleCollapseAll = () => { 
    setExpandedNodes([]); 
    setSearchQuery(''); 
  };
  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => prev.includes(nodeId) ? prev.filter(id => id !== nodeId) : [...prev, nodeId]);
  };

  // --- 🚨 INDIVIDUAL NODE EXPAND/COLLAPSE ---
  const handleExpandSpecificNode = (node: TrackerNode) => {
    const descendantIds = getDescendantIds(node);
    setExpandedNodes(prev => Array.from(new Set([...prev, node._id, ...descendantIds])));
  };
  const handleCollapseSpecificNode = (node: TrackerNode) => {
    const descendantIds = getDescendantIds(node);
    setExpandedNodes(prev => prev.filter(id => id !== node._id && !descendantIds.includes(id)));
  };

  // --- RENDERERS ---

  const renderNodeTree = (node: TrackerNode, depth: number) => {
    const isExpanded = expandedNodes.includes(node._id);
    const hasChildren = node.children && node.children.length > 0;
    const isCompleted = node.status.includes('completed');

    return (
      <div key={node._id} className="w-full flex flex-col">
        <div className="w-full py-2.5 pr-4 flex items-start hover:bg-gray-50 transition border-b border-gray-100 bg-white group">
          
          <div style={{ width: `${depth * 1.5}rem` }} className="shrink-0" />
          
          <div className="w-8 flex items-start justify-center shrink-0">
            {hasChildren && (
              <button 
                onClick={() => toggleNode(node._id)} 
                className="p-1 text-gray-400 hover:text-brand-blue rounded-md active:bg-gray-100 mt-0.5"
              >
                {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              </button>
            )}
          </div>
          
          <button 
            disabled={readOnly || (safeRole === 'teacher' && !isMyOwnSyllabus)} 
            onClick={() => handleUpdateNode(node._id, { status: isCompleted ? 'not_started' : 'completed' })} 
            className="mt-1 shrink-0 cursor-pointer hover:scale-110 active:scale-95 transition disabled:cursor-default mr-3"
          >
            {isCompleted ? <CheckCircle className="text-green-500" size={18} /> : <Circle className="text-gray-300" size={18} />}
          </button>
          
          <div className="flex-1 flex flex-col min-w-0 mt-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span 
                onClick={() => hasChildren && toggleNode(node._id)}
                className={`text-sm font-medium leading-snug ${hasChildren ? 'cursor-pointer hover:text-brand-blue' : ''} ${isCompleted ? 'text-gray-400 line-through' : 'text-gray-700'}`}
              >
                {node.title}
              </span>
              
              {hasChildren && (
                <span className="text-[10px] text-gray-500 font-bold bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded shrink-0">
                  {node.children!.filter(c => c.status.includes('completed')).length}/{node.children!.length}
                </span>
              )}
              
              {node.isCustom && (
                <span className="text-[9px] uppercase font-black text-brand-orange bg-orange-50 border border-orange-100 px-1.5 py-0.5 rounded shrink-0">
                  Custom
                </span>
              )}
            </div>
          </div>

          {/* 🚨 RESTORED: Individual Expand/Collapse Buttons for child nodes */}
          {hasChildren && (
            <div className="flex items-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity gap-1 mr-2 shrink-0 mt-0.5">
              <button 
                onClick={() => handleExpandSpecificNode(node)} 
                className="p-1 text-gray-400 hover:text-brand-blue bg-white rounded shadow-sm md:shadow-none md:bg-transparent" 
                title="Expand Sub-topics"
              >
                <Maximize2 size={14}/>
              </button>
              <button 
                onClick={() => handleCollapseSpecificNode(node)} 
                className="p-1 text-gray-400 hover:text-brand-blue bg-white rounded shadow-sm md:shadow-none md:bg-transparent" 
                title="Collapse Sub-topics"
              >
                <Minimize2 size={14}/>
              </button>
            </div>
          )}

          <button 
            disabled={readOnly || (safeRole === 'teacher' && !isMyOwnSyllabus)} 
            onClick={() => handleUpdateNode(node._id, { hasDoubt: !node.hasDoubt })} 
            className={`ml-2 p-1.5 rounded-lg shrink-0 transition active:scale-95 ${node.hasDoubt ? 'bg-red-100 text-red-500 shadow-sm' : 'text-gray-300 hover:text-red-400 bg-gray-50 hover:bg-red-50'} disabled:cursor-default mt-0.5`}
          >
            <AlertCircle size={16} />
          </button>
        </div>

        {hasChildren && isExpanded && (
          <div className="w-full animate-in slide-in-from-top-2 duration-300">
            {node.children!.map(child => renderNodeTree(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const studentObj = teacherStudents.find(s => s.username === selectedStudentUsername);
  const studentFirstName = studentObj?.name?.split(' ')[0];
  
  const headerTitle = isMyOwnSyllabus 
    ? "My Personal Progress" 
    : safeRole === 'teacher' 
      ? (studentFirstName ? `${studentFirstName}'s Progress` : "Student's Progress") 
      : 'Your Journey';

  const generatePDF = () => {
    const doc = new jsPDF();
    const pdfStudentName = isMyOwnSyllabus ? "My" : (safeRole === 'teacher' ? (studentObj?.name || "Student") : "My");
    const date = new Date().toLocaleDateString('en-GB');

    doc.setFillColor(23, 101, 164); doc.rect(0, 0, 210, 45, 'F'); doc.setFontSize(22); doc.setTextColor(255, 255, 255);
    doc.text(`ACADEMIC REPORT: ${activeCourse?.toUpperCase() || 'SYLLABUS'}`, 14, 25);
    
    doc.setFontSize(10); doc.text(`STUDENT: ${pdfStudentName.toUpperCase()}`, 14, 35); doc.text(`GENERATED: ${date}`, 160, 35);

    const remainingPercent = 100 - overallStats.percentage;
    
    doc.setDrawColor(34, 197, 94); doc.setLineWidth(1.5); doc.circle(40, 75, 15, 'S'); doc.setTextColor(34, 197, 94); doc.setFontSize(12); doc.text(`${overallStats.percentage}%`, 35, 77); doc.setFontSize(8); doc.text("MASTERED", 32, 95);
    doc.setDrawColor(234, 179, 8); doc.circle(80, 75, 15, 'S'); doc.setTextColor(234, 179, 8); doc.setFontSize(12); doc.text(`${remainingPercent}%`, 75, 77); doc.setFontSize(8); doc.text("REMAINING", 72, 95);

    doc.setTextColor(40); doc.setFontSize(14); doc.text("I. COMPLETED MILESTONES", 14, 115);
    const completedRows = flatNodes.filter(t => t.status.includes('completed')).map(t => [t.title, `Level ${t.level}`, t.status]);
    
    autoTable(doc, { startY: 120, head: [['Node Title', 'Depth', 'Status']], body: completedRows, headStyles: { fillColor: [34, 197, 94] }, styles: { fontSize: 8 }});
    doc.save(`${pdfStudentName}_${activeCourse || 'Syllabus'}_Report.pdf`);
  };

  if (safeRole === 'teacher' && !selectedStudentUsername) {
    return (
      <div className="w-full h-full flex flex-col overflow-hidden">
        <div className="flex justify-between items-center mb-4 md:mb-6 shrink-0">
          <h3 className="font-display text-xl md:text-3xl font-black text-gray-900 flex items-center gap-2 md:gap-3">
            <Zap className="text-brand-orange animate-pulse w-6 h-6 md:w-8 md:h-8" /> Class Insights
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto pr-2 pb-6 custom-scrollbar">
          {teacherStudents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center"><User size={60} className="text-gray-300 mb-4" /><p className="text-xl font-bold text-gray-500 mb-2">No Students Yet</p><p className="text-sm text-gray-400">Invite students to start tracking collective class doubts.</p></div>
          ) : commonDoubts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center"><CheckCircle size={60} className="text-green-400 mb-4 opacity-50" /><p className="text-xl font-bold text-gray-500 mb-2">All Clear!</p><p className="text-sm text-gray-400">There are currently no active doubts reported across the class.</p></div>
          ) : (
            <div className="space-y-3">
              {commonDoubts.map((doubt, idx) => (
                <div key={idx} className="p-4 bg-red-50/50 border border-red-100 rounded-xl flex justify-between items-center transition-all">
                  <div className="min-w-0 pr-4">
                    <h4 className="font-bold text-gray-800 text-sm md:text-base truncate">{doubt.title}</h4>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded shadow-sm">{doubt.course}</span>
                      {doubt.lastUpdated && <span className="text-[10px] text-red-400 italic flex items-center gap-1 whitespace-nowrap"><Clock size={10} /> {formatTimeAgo(doubt.lastUpdated)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-2 bg-white px-3 py-2 rounded-lg border border-red-100 shadow-sm shrink-0">
                    <User size={16} className="text-red-500" />
                    <span className="font-black text-red-600 text-lg leading-none">{doubt.count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col overflow-hidden pb-0">
      
      {/* TABS FOR COURSES */}
      {courses.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-2 shrink-0 custom-scrollbar">
          {courses.map((course) => (
            <button key={course} onClick={() => setActiveCourse(course)} className={`px-5 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all border shadow-sm flex items-center gap-2 ${activeCourse === course ? 'bg-brand-blue border-brand-blue text-white ring-4 ring-blue-50' : 'bg-white border-gray-200 text-gray-600 hover:border-brand-blue/50'}`}>
              <BookOpen size={14} />{course}
            </button>
          ))}
          {!readOnly && (
            <button onClick={() => navigate(selectedStudentUsername ? `/edit-syllabus/${selectedStudentUsername}` : '/edit-syllabus')} className="px-3 py-2 rounded-full border-2 border-dashed border-gray-300 text-gray-400 hover:text-brand-blue hover:border-brand-blue transition-colors"><Plus size={16} /></button>
          )}
        </div>
      )}

      {activeCourse && (
        <div className="mb-4 md:mb-8 shrink-0 relative animate-in fade-in slide-in-from-top-4">
          <div className="flex flex-row items-center justify-between gap-2 md:gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="font-display text-xl md:text-3xl font-black text-gray-900 flex items-center gap-1.5 md:gap-3 mb-1 md:mb-2 truncate">
                <TrendingUp className="text-brand-blue shrink-0 w-6 h-6 md:w-8 md:h-8" />
                <span className="truncate">{headerTitle}</span>
              </h3>
              <div className="flex flex-wrap items-center gap-2 md:gap-3 text-xs md:text-sm font-medium text-gray-500">
                <span>{overallStats.completed} / {overallStats.total} Nodes Done</span>
                {overallStats.lastActivity && <span className="hidden sm:flex bg-slate-50 px-2 py-1 rounded border border-gray-200 items-center gap-1"><Clock size={12}/> {formatTimeAgo(overallStats.lastActivity)}</span>}
              </div>
            </div>
            <div className="text-right shrink-0"><span className="text-3xl md:text-5xl font-black text-brand-blue tabular-nums leading-none">{overallStats.percentage}%</span></div>
          </div>
          <ProgressBar percent={overallStats.percentage} colorClass={overallStats.percentage === 100 ? "bg-green-500" : "bg-brand-blue"} />
        </div>
      )}

      {/* CONTROLS */}
      {activeCourse && (
        <div className="flex flex-row items-center justify-between gap-2 mb-4 md:mb-6 shrink-0 animate-in fade-in">
          <div className="relative flex-1 w-full max-w-md hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input type="text" placeholder="Search topics..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-brand-blue transition" />
            {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"><X size={16}/></button>}
          </div>

          {isMobileSearchActive ? (
            <div className="relative flex-1 w-full md:hidden animate-in fade-in slide-in-from-right-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input autoFocus type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-brand-blue rounded-xl text-sm font-medium focus:outline-none transition shadow-sm" />
              <button onClick={() => { setIsMobileSearchActive(false); setSearchQuery(''); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"><X size={16}/></button>
            </div>
          ) : (
            <div className="flex items-center w-full md:w-auto justify-between md:justify-end gap-2">
              <button onClick={() => setIsMobileSearchActive(true)} className="md:hidden p-2.5 bg-gray-50 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-100 transition flex items-center justify-center"><Search size={18} /></button>
              <div className="flex items-center gap-2">
                <button onClick={() => navigate(selectedStudentUsername ? `/edit-syllabus/${selectedStudentUsername}` : '/edit-syllabus')} className="p-2.5 md:px-3 md:py-2 bg-brand-blue text-white rounded-xl text-xs font-bold hover:bg-blue-800 transition shadow-sm flex items-center gap-1.5" title="Edit Syllabus"><Edit3 size={18} className="md:w-3.5 md:h-3.5"/> <span className="hidden md:inline">Edit Syllabus</span></button>
                <button onClick={generatePDF} className="p-2.5 md:px-3 md:py-2 bg-brand-orange text-white rounded-xl text-xs font-bold hover:bg-orange-600 transition shadow-sm flex items-center gap-1.5" title="Download Report"><Download size={18} className="md:w-3.5 md:h-3.5"/> <span className="hidden md:inline">Report</span></button>
                <div className="w-px h-6 bg-gray-200 mx-1 hidden sm:block" />
                <button onClick={handleExpandAll} className="p-2.5 md:px-3 md:py-2 bg-slate-50 text-brand-blue border border-gray-200 rounded-xl text-xs font-bold hover:bg-blue-50 transition flex items-center gap-1.5" title="Expand All"><Maximize2 size={18} className="md:w-3.5 md:h-3.5"/> <span className="hidden md:inline">Expand All</span></button>
                <button onClick={handleCollapseAll} className="p-2.5 md:px-3 md:py-2 bg-gray-50 text-gray-500 border border-gray-200 rounded-xl text-xs font-bold hover:bg-gray-100 transition flex items-center gap-1.5" title="Reset Filters"><Minimize2 size={18} className="md:w-3.5 md:h-3.5"/> <span className="hidden md:inline">Reset</span></button>
                <button onClick={() => setFilter(prev => prev === 'all' ? 'doubts' : 'all')} className={`p-2.5 md:px-4 md:py-2 rounded-xl transition flex items-center gap-1.5 text-xs font-bold border ${filter === 'doubts' ? 'bg-red-50 border-red-200 text-red-500 shadow-sm' : 'bg-slate-900 border-slate-900 text-white'}`} title="Filter by Doubts"><Filter size={18} className="md:w-3.5 md:h-3.5"/> <span className="hidden md:inline">{filter === 'doubts' ? 'Doubts' : 'All'}</span></button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SYLLABUS TREE / EMPTY STATE */}
      <div className="flex-1 overflow-y-auto pr-2 pb-32 md:pb-6 custom-scrollbar">
        {isLoading ? (
          <div className="w-full flex justify-center py-20"><Loader2 className="animate-spin text-brand-orange" size={40} /></div>
        ) : treeRoots.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-100 mx-4 shadow-sm animate-in fade-in">
            <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"><BookOpen size={40} className="text-slate-300" /></div>
            <p className="text-xl font-black text-gray-800">No Syllabus in {activeCourse || 'this Course'}</p>
            <p className="text-sm text-gray-500 mt-2 max-w-xs mx-auto">Your tracker for this section is currently empty. Add topics from the catalog or create your own path.</p>
            {!readOnly && (
              <button onClick={() => navigate(selectedStudentUsername ? `/edit-syllabus/${selectedStudentUsername}` : '/edit-syllabus')} className="mt-8 inline-flex items-center gap-2 bg-brand-blue text-white px-8 py-3.5 rounded-2xl font-bold hover:bg-blue-800 transition-all shadow-lg active:scale-95"><Plus size={20} /> Open Syllabus Builder</button>
            )}
          </div>
        ) : (
          treeRoots.map((subjectNode) => {
            const stats = getNodeStats(subjectNode);
            const subjectPercentage = Math.round((stats.completed / stats.total) * 100);
            const isSubjectCompleted = subjectNode.status.includes('completed');
            const hasSubjectDoubt = subjectNode.hasDoubt;
            const isExpanded = expandedNodes.includes(subjectNode._id);

            return (
              <div key={subjectNode._id} className="border border-gray-200 rounded-2xl overflow-hidden bg-white mb-4 last:mb-0 group/subject transition-all hover:border-brand-blue/30 shadow-sm animate-in fade-in group">
                  <div className="w-full p-4 bg-slate-50 border-b border-gray-100">
                    <div className="flex items-center justify-between mb-3">
                      
                      <div className="flex items-center gap-1 flex-1 min-w-0">
                          <div className="w-8 flex items-center justify-center shrink-0">
                            <button onClick={() => toggleNode(subjectNode._id)} className="p-1 text-gray-400 hover:text-brand-blue rounded-md active:bg-gray-100">{isExpanded ? <ChevronDown size={22} /> : <ChevronRight size={22} />}</button>
                          </div>
                          <button disabled={readOnly || (safeRole === 'teacher' && !isMyOwnSyllabus)} onClick={() => handleUpdateNode(subjectNode._id, { status: isSubjectCompleted ? 'not_started' : 'completed' })} className="shrink-0 cursor-pointer hover:scale-110 active:scale-95 transition disabled:cursor-default mx-2">{isSubjectCompleted ? <CheckCircle className="text-green-500" size={24} /> : <Circle className="text-gray-300" size={24} />}</button>
                          <div className="flex items-center flex-wrap min-w-0 gap-2">
                            <span onClick={() => toggleNode(subjectNode._id)} className={`font-bold text-base md:text-lg cursor-pointer hover:text-brand-blue transition min-w-0 truncate ${isSubjectCompleted ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{subjectNode.title}</span>
                            {subjectNode.isCustom && <span className="text-[10px] uppercase font-black text-brand-orange bg-orange-50 border border-orange-100 px-1.5 py-0.5 rounded shrink-0">Custom</span>}
                          </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                          {/* 🚨 RESTORED: Individual Expand/Collapse Buttons for subject nodes */}
                          {subjectNode.children && subjectNode.children.length > 0 && (
                            <div className="flex items-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity gap-1 mr-1 shrink-0">
                              <button onClick={() => handleExpandSpecificNode(subjectNode)} className="p-1.5 text-gray-400 hover:text-brand-blue bg-white rounded shadow-sm md:shadow-none md:bg-transparent" title="Expand Sub-topics"><Maximize2 size={16}/></button>
                              <button onClick={() => handleCollapseSpecificNode(subjectNode)} className="p-1.5 text-gray-400 hover:text-brand-blue bg-white rounded shadow-sm md:shadow-none md:bg-transparent" title="Collapse Sub-topics"><Minimize2 size={16}/></button>
                            </div>
                          )}

                          <span className={`text-xs font-black px-2 py-1 rounded-md border shadow-sm ${subjectPercentage === 100 ? 'bg-green-50 border-green-200 text-green-600' : 'bg-white border-gray-200 text-brand-blue'}`}>{subjectPercentage}%</span>
                          <button disabled={readOnly || (safeRole === 'teacher' && !isMyOwnSyllabus)} onClick={() => handleUpdateNode(subjectNode._id, { hasDoubt: !hasSubjectDoubt })} className={`p-1.5 rounded-lg transition active:scale-95 ${hasSubjectDoubt ? 'bg-red-100 text-red-500 shadow-sm' : 'text-gray-300 hover:text-red-400 bg-gray-50 hover:bg-red-50'} disabled:cursor-default`}><AlertCircle size={20} /></button>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden mt-1"><div className={`h-full transition-all duration-1000 ease-out ${subjectPercentage === 100 ? "bg-green-500" : "bg-brand-blue"}`} style={{ width: `${subjectPercentage}%` }} /></div>
                  </div>
                  {isExpanded && subjectNode.children && (<div className="w-full animate-in slide-in-from-top-2 duration-300">{subjectNode.children.map(child => renderNodeTree(child, 0))}</div>)}
              </div>
            );
          })
        )}
      </div>

      {alertInfo.show && <Muialert message={alertInfo.message} severity={alertInfo.type} onClose={() => setAlertInfo({ ...alertInfo, show: false })} />}
    </div>
  );
};

export default SyllabusTracker;