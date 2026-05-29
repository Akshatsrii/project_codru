import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Code, Bot, Cpu, PenTool, Edit3, Palette, ScrollText, 
  Sparkles, Hammer, CheckCircle2, Quote, Loader2, User, ExternalLink, GraduationCap, AlertTriangle
} from 'lucide-react';

const MILESTONES = ['Ideation', 'Prototyping', 'Building', 'Polishing', 'Completed'];

const getCourseTheme = (name: string) => {
  const lowerName = (name || '').toLowerCase();
  if (lowerName.includes('coding')) return { icon: Code, color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-100' };
  if (lowerName.includes('robotic')) return { icon: Bot, color: 'text-indigo-500', bg: 'bg-indigo-50', border: 'border-indigo-100' };
  if (lowerName.includes('pcb')) return { icon: Cpu, color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-100' };
  if (lowerName.includes('graphic')) return { icon: PenTool, color: 'text-purple-500', bg: 'bg-purple-50', border: 'border-purple-100' };
  if (lowerName.includes('sketch') || lowerName.includes('draw')) return { icon: Edit3, color: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-100' };
  if (lowerName.includes('paint')) return { icon: Palette, color: 'text-pink-500', bg: 'bg-pink-50', border: 'border-pink-100' };
  if (lowerName.includes('calligraphy')) return { icon: ScrollText, color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-100' };
  return { icon: Sparkles, color: 'text-brand-blue', bg: 'bg-blue-50', border: 'border-blue-100' };
};

interface CourseWidgetProps {
  data?: any;
  rawData?: any;
  user?: any;
}

const CourseWidget: React.FC<CourseWidgetProps> = ({ user }) => {
  const navigate = useNavigate();
  
  const role = user?.Role || user?.role || 'user';
  
  const [courses, setCourses] = useState<any[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  
  // 🚨 NEW: State for Teacher's Students
  const [assignedStudents, setAssignedStudents] = useState<any[]>([]);
  const [activeSearch, setActiveSearch] = useState("");

  // 1. FETCH TEACHER'S STUDENTS
  useEffect(() => {
    if (role?.toLowerCase() === 'teacher') {
      const fetchStudents = async () => {
        try {
          const token = localStorage.getItem("jwtoken");
          
          // 🚨 Grab the teacher's username just like you do in StudentManagement
          const teacherUsername = user?.username || localStorage.getItem("Username");
          
          // 🚨 Use your actual working backend route!
          const res = await fetch(`${import.meta.env.VITE_API}my-students/${teacherUsername}`, {
            headers: { "Authorization": `Bearer ${token}` }
          });
          
          if (res.ok) {
            const data = await res.json();
            setAssignedStudents(data);
            
            // Auto-select the first student to instantly populate the widget!
            if (data.length > 0 && !activeSearch) {
              setActiveSearch(data[0].username);
            }
          }
        } catch (error) {
          console.error("Failed to fetch students:", error);
        }
      };
      fetchStudents();
    }
  }, [role, user, activeSearch]);

  // 2. FETCH COURSES
  const fetchCourses = async (targetUsername?: string) => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("jwtoken");
      let url = `${import.meta.env.VITE_API}my-courses`;
      
      if (role?.toLowerCase() === 'teacher' && targetUsername) {
        url += `?username=${targetUsername}`;
      }

      const res = await fetch(url, { headers: { "Authorization": `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        
        const activeCourses = data.filter((c: any) => c.status !== 'graduated' || !c.studentAcceptedGraduation);
        const graduatedCourses = data.filter((c: any) => c.status === 'graduated' && c.studentAcceptedGraduation);
        
        setCourses(activeCourses);
        setCompletedCount(graduatedCourses.length);
      } else {
        setCourses([]);
        setCompletedCount(0);
      }
    } catch (error) {
      console.error("Failed to fetch courses:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (role?.toLowerCase() === 'student') {
      fetchCourses();
    } else if (role?.toLowerCase() === 'teacher' && activeSearch) {
      fetchCourses(activeSearch);
    }
  }, [role, activeSearch]);

  return (
    <>
      {/* WIDGET HEADER */}
      <div className="flex items-center justify-between mb-4 relative z-10 gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">
              Active Projects
            </h3>
          </div>
          
          {completedCount > 0 && (
            <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-0.5 rounded-md text-[9px] font-bold tracking-widest shadow-sm shrink-0 whitespace-nowrap">
              {completedCount} DONE
            </span>
          )}
        </div>
        
        {courses.length > 0 && (
          <button 
            onClick={() => navigate('/my-courses')} 
            className="text-[10px] font-bold text-brand-blue hover:text-blue-700 transition-colors flex items-center gap-1 shrink-0 whitespace-nowrap"
          >
              Full Portfolio <ExternalLink size={10} className="mb-0.5" />
          </button>
        )}
      </div>

      {/* 🚨 NEW: STUDENT PILLS FOR TEACHERS */}
      {role?.toLowerCase() === 'teacher' && assignedStudents.length > 0 && (
        <div 
          onWheel={(e) => {
            // 🚨 MAGIC FIX: Converts vertical mouse scrolling to horizontal scrolling!
            e.currentTarget.scrollLeft += e.deltaY;
          }}
          className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-2 mb-2 relative z-10 w-full snap-x"
        >
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

      {/* WIDGET CONTENT */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 relative z-10 flex flex-col space-y-4 pb-2">
        {isLoading ? (
            <div className="h-full flex items-center justify-center min-h-50">
                <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
            </div>
        ) : role?.toLowerCase() === 'teacher' && !activeSearch ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200 py-8 px-4 min-h-50">
                <User size={32} className="opacity-20 mb-3" />
                <h4 className="text-xs font-bold text-slate-700 mb-1 text-center">Student Lookup</h4>
                {/* 🚨 Text updated for pills */}
                <p className="text-[10px] text-slate-500 text-center">Select a student above to view their active projects.</p>
            </div>
        ) : courses.length > 0 ? (
            courses.map((course) => {
              const theme = getCourseTheme(course.courseName);
              const Icon = theme.icon;
              
              const isPendingGraduation = course.status === 'graduated' && !course.studentAcceptedGraduation;
              const currentMilestoneIndex = MILESTONES.indexOf(course.currentMilestone);
              const progressPercentage = isPendingGraduation ? 100 : (currentMilestoneIndex / (MILESTONES.length - 1)) * 100;

              return (
                <div 
                  key={course._id} 
                  onClick={() => navigate('/my-courses')}
                  className={`bg-white rounded-2xl border p-4 shadow-sm hover:shadow-md transition-all cursor-pointer group ${isPendingGraduation ? 'border-amber-200 bg-linear-to-br from-white to-amber-50/30' : theme.border}`}
                >
                  {/* Header Row */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${theme.bg}`}>
                        <Icon size={20} className={theme.color} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-800 leading-tight group-hover:text-brand-blue transition-colors">
                          {course.courseName}
                        </h4>
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                          {course.level}
                        </span>
                      </div>
                    </div>
                    
                    {/* STATUS BADGES */}
                    {isPendingGraduation ? (
                      <span className="flex items-center gap-1 text-[9px] font-bold text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-md uppercase tracking-wider">
                        <AlertTriangle size={10} /> Pending
                      </span>
                    ) : course.status === 'paused' && (
                      <span className="text-[9px] font-bold bg-yellow-50 text-yellow-600 border border-yellow-200 px-2 py-0.5 rounded-md uppercase tracking-wider">
                        Paused
                      </span>
                    )}
                  </div>

                  {/* Project Name */}
                  <div className="mb-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1">
                      <Hammer size={10} /> Active Project
                    </p>
                    <p className="text-sm font-bold text-slate-700 truncate">
                      {course.projectName}
                    </p>
                  </div>

                  {/* MINI PROGRESS BAR */}
                  <div className="mb-4">
                    <div className="flex justify-between items-end mb-1.5">
                      <span className={`text-[10px] font-bold ${isPendingGraduation ? 'text-amber-600' : 'text-brand-blue'}`}>
                        {isPendingGraduation ? 'Awaiting Your Approval' : course.currentMilestone}
                      </span>
                      <span className="text-[9px] font-bold text-slate-400">
                        {Math.round(progressPercentage)}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ease-out ${isPendingGraduation ? 'bg-amber-400' : 'bg-brand-blue'}`}
                        style={{ width: `${progressPercentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Mentor Note Snippet */}
                  {course.mentorNote && (
                    <div className="bg-amber-50/50 rounded-xl p-3 border border-amber-100/50 flex items-start gap-2">
                      <Quote size={12} className="text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-[10px] text-amber-900/80 font-medium italic line-clamp-2 leading-relaxed">
                        "{course.mentorNote}"
                      </p>
                    </div>
                  )}
                </div>
              );
            })
        ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200 py-8 px-4 min-h-50">
                <Sparkles size={32} className="opacity-20 mb-3" />
                <h4 className="text-xs font-bold text-slate-700 mb-1 text-center">No Active Projects</h4>
                <p className="text-[10px] text-slate-500 text-center">
                  {role?.toLowerCase() === 'teacher' ? "This student is not currently building any projects." : "You are not enrolled in any skill courses yet."}
                </p>
            </div>
        )}
      </div>
    </>
  );
};

export default CourseWidget;