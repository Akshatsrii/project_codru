import React, { useState, useEffect, useMemo } from 'react';
import { Target, ChevronRight, Zap, User, AlertCircle, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CircularProgress = ({ percentage, size = 60, strokeWidth = 6, color = "#6366f1" }: { percentage: number, size?: number, strokeWidth?: number, color?: string }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="currentColor" strokeWidth={strokeWidth} fill="transparent" className="text-slate-100" />
        <circle
          cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth={strokeWidth} fill="transparent"
          strokeDasharray={circumference}
          style={{ strokeDashoffset: offset, transition: 'stroke-dashoffset 1s ease-in-out' }}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-[10px] font-black text-slate-700">{percentage}%</span>
    </div>
  );
};

interface SyllabusWidgetProps {
  data?: any;
  rawData?: any;
  user?: any;
}

const SyllabusWidget: React.FC<SyllabusWidgetProps> = ({ data, user }) => {
  const navigate = useNavigate();
  
  const role = user?.Role || user?.role || 'user';
  const isTeacher = role.toLowerCase() === 'teacher';

  const [assignedStudents, setAssignedStudents] = useState<any[]>([]);
  const [activeSearch, setActiveSearch] = useState<string>(""); // Empty = Class Insights Mode
  const [studentProgress, setStudentProgress] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);

  // 1. FETCH TEACHER'S STUDENTS (For Class Insights & Pills)
  useEffect(() => {
    if (isTeacher) {
      const fetchStudents = async () => {
        setIsLoading(true);
        try {
          const token = localStorage.getItem("jwtoken");
          const teacherUsername = user?.username || localStorage.getItem("Username");
          
          const res = await fetch(`${import.meta.env.VITE_API}my-students/${teacherUsername}`, {
            headers: { "Authorization": `Bearer ${token}` }
          });
          
          if (res.ok) {
            const result = await res.json();
            setAssignedStudents(result);
            // We intentionally leave activeSearch empty to show Class Insights by default
          }
        } catch (error) {
          console.error("Failed to fetch students:", error);
        } finally {
          setIsLoading(false);
        }
      };
      fetchStudents();
    }
  }, [isTeacher, user]);

  // 2. FETCH SPECIFIC STUDENT PROGRESS (When a pill is clicked)
  useEffect(() => {
    if (isTeacher && activeSearch) {
      const fetchStudentSyllabus = async () => {
        setIsCalculating(true);
        try {
          const token = localStorage.getItem("jwtoken");
          const res = await fetch(`${import.meta.env.VITE_API}dashboard/syllabus?username=${activeSearch}`, {
            headers: { "Authorization": `Bearer ${token}` }
          });
          
          if (res.ok) {
            const rawTopics = await res.json();
            
            // Group by subject and calculate percentage just like the backend
            const subjectMap: Record<string, { total: number, completed: number }> = {};
            rawTopics.forEach((t: any) => {
              const subj = t.subject || "General";
              if (!subjectMap[subj]) subjectMap[subj] = { total: 0, completed: 0 };
              subjectMap[subj].total++;
              if (t.status && t.status.includes('completed')) subjectMap[subj].completed++;
            });

            // Get top 3
            const topSubjects = Object.keys(subjectMap)
              .filter(k => subjectMap[k].total > 0)
              .map(k => ({ 
                name: k, 
                percentage: Math.round((subjectMap[k].completed / subjectMap[k].total) * 100) 
              }))
              .sort((a, b) => b.percentage - a.percentage)
              .slice(0, 3);

            setStudentProgress(topSubjects);
          }
        } catch (error) {
          console.error("Failed to fetch student syllabus:", error);
        } finally {
          setIsCalculating(false);
        }
      };
      fetchStudentSyllabus();
    }
  }, [isTeacher, activeSearch]);

  // 3. CALCULATE CLASS INSIGHTS (Common Doubts)
  const commonDoubts = useMemo(() => {
    if (!isTeacher || assignedStudents.length === 0) return [];
    
    const doubtMap = new Map<string, { count: number; subject: string }>();
    
    assignedStudents.forEach(student => {
      const syllabus = Array.isArray(student.syllabus) ? student.syllabus : [];
      syllabus.forEach((topic: any) => {
        if (topic.topicName && topic.topicName !== "New Topic" && (topic.hasDoubt || topic.status === 'completed_with_doubt')) {
          const key = topic.topicName;
          const existing = doubtMap.get(key);
          if (existing) { 
            existing.count++; 
          } else { 
            doubtMap.set(key, { count: 1, subject: topic.subject || "General" }); 
          }
        }
      });
    });
    
    return Array.from(doubtMap.entries())
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3); // Show top 3 most common doubts
  }, [assignedStudents, isTeacher]);

  const handleNavigate = () => {
    localStorage.setItem("currentView", "syllabus");
    localStorage.setItem("activeTab", "Syllabus Tracker");
    navigate('/dashboard/syllabus');
  };

  // Determine which data array to render circles for
  const displaySubjects = isTeacher ? studentProgress : (Array.isArray(data) ? data : []);

  return (
    <div className="flex flex-col h-full">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-4 relative z-10 gap-2 shrink-0">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">
            {isTeacher && !activeSearch ? 'Class Insights' : 'Course Progress'}
          </h3>
        </div>
        
        <button 
            onClick={handleNavigate}
            className="text-[10px] font-bold text-brand-blue hover:underline flex items-center gap-1 transition-all whitespace-nowrap shrink-0"
        >
            View Tracker <ChevronRight size={10} className="mb-0.5" />
        </button>
      </div>

      {/* 🚨 TEACHER STUDENT PILLS */}
      {isTeacher && assignedStudents.length > 0 && (
        <div 
          onWheel={(e) => {
            // 🚨 MAGIC FIX: Converts vertical mouse scrolling to horizontal scrolling!
            e.currentTarget.scrollLeft += e.deltaY;
          }}
          className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-2 mb-2 relative z-10 w-full snap-x"
        >
          {/* "Class Insights" Default Pill */}
          <button
            onClick={() => setActiveSearch("")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap transition-all shrink-0 border ${
              activeSearch === "" 
                ? 'bg-indigo-500 text-white border-indigo-500 shadow-md shadow-indigo-500/20' 
                : 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100'
            }`}
          >
            <Zap size={12} className={activeSearch === "" ? "text-white" : "text-indigo-500"} />
            Class Insights
          </button>
          
          <div className="w-px h-4 bg-slate-200 mx-1 shrink-0"></div>

          {/* Student Pills */}
          {assignedStudents.map((student) => (
            <button
              key={student._id}
              onClick={() => setActiveSearch(student.username)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap transition-all shrink-0 border ${
                activeSearch === student.username 
                  ? 'bg-brand-blue text-white border-brand-blue shadow-md shadow-blue-500/20' 
                  : 'bg-white text-slate-500 border-slate-200 hover:border-brand-blue/50 hover:bg-blue-50 hover:text-brand-blue'
              }`}
            >
              {student.photo ? (
                <img src={student.photo} alt={student.name} className="w-4 h-4 rounded-full object-cover shrink-0" />
              ) : (
                <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] shrink-0 ${activeSearch === student.username ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  {student.name.charAt(0).toUpperCase()}
                </div>
              )}
              {student.name.split(' ')[0]}
            </button>
          ))}
        </div>
      )}

      {/* CONTENT AREA */}
      <div className="flex-1 flex flex-col justify-center relative z-10 overflow-y-auto custom-scrollbar">
        {isLoading || isCalculating ? (
            <div className="flex items-center justify-center h-full min-h-30">
                <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
            </div>
        ) : isTeacher && !activeSearch ? (
            // ==========================================
            // 📊 CLASS INSIGHTS VIEW
            // ==========================================
            commonDoubts.length > 0 ? (
              <div className="flex flex-col gap-2 w-full">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 px-1">Top Priority Doubts</p>
                {commonDoubts.map((doubt, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 bg-red-50/50 border border-red-100 rounded-xl hover:bg-red-50 transition-colors">
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="text-xs font-bold text-slate-800 truncate">{doubt.name}</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase">{doubt.subject}</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-red-100 shadow-sm shrink-0">
                      <User size={10} className="text-red-500" />
                      <span className="text-xs font-bold text-red-600">{doubt.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200 py-6 px-4 h-full">
                  <Zap size={28} className="opacity-20 mb-2 text-indigo-500" />
                  <h4 className="text-xs font-bold text-slate-700 mb-1">Clear Skies</h4>
                  <p className="text-[9px] text-slate-500 text-center leading-relaxed">
                      No active doubts logged by your students right now!
                  </p>
              </div>
            )
        ) : displaySubjects.length > 0 ? (
            // ==========================================
            // 🎯 STUDENT PROGRESS CIRCLES
            // ==========================================
            <div className="grid grid-cols-3 gap-2 w-full">
                {displaySubjects.map((subj: any, idx: number) => (
                    <div 
                        key={idx} 
                        className="flex flex-col items-center gap-3 p-2 rounded-2xl hover:bg-slate-50 transition-colors cursor-pointer group"
                        onClick={handleNavigate}
                    >
                        <CircularProgress percentage={subj.percentage} />
                        <span className="text-[10px] font-bold text-slate-600 text-center leading-tight truncate w-full group-hover:text-indigo-600">
                            {subj.name}
                        </span>
                    </div>
                ))}
            </div>
        ) : (
            // ==========================================
            // 📭 EMPTY STATE
            // ==========================================
            <div className="flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200 py-6 px-4 h-full">
                <Target size={28} className="opacity-20 mb-2" />
                <h4 className="text-xs font-bold text-slate-700 mb-1">No Progress Yet</h4>
                <p className="text-[9px] text-slate-500 text-center leading-relaxed max-w-37.5">
                    {isTeacher 
                      ? "This student hasn't marked any topics as complete."
                      : "Mark topics as complete in the tracker to see your mastery here."
                    }
                </p>
            </div>
        )}
      </div>
    </div>
  );
};

export default SyllabusWidget;