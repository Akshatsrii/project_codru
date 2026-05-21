import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Search, 
  ExternalLink, 
  Loader2, 
  Rocket, 
  AlertCircle,
  CheckCircle2,
  X
} from 'lucide-react';

interface StudentWidgetProps {
  user?: any;
}

const StudentWidget: React.FC<StudentWidgetProps> = ({ user }) => {
  const navigate = useNavigate();
  const [students, setStudents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const teacherUsername = user?.username || localStorage.getItem("Username");

  // 🚨 INTERNAL NAVIGATION HANDLER
  const handleNavigateToManagement = () => {
    localStorage.setItem("currentView", "management");
    localStorage.setItem("activeTab", "Management");
    navigate('/dashboard');
  };

  // 1. FETCH TEACHER'S ROSTER
  useEffect(() => {
    const fetchRoster = async () => {
      if (!teacherUsername) return;
      try {
        const token = localStorage.getItem("jwtoken");
        const res = await fetch(`${import.meta.env.VITE_API}my-students/${teacherUsername}`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        
        if (res.ok) {
          const data = await res.json();
          setStudents(data);
        }
      } catch (error) {
        console.error("Failed to fetch roster for widget:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchRoster();
  }, [teacherUsername]);

  // 2. INSTANT SEARCH & SORT (Doubts always stay on top)
  const filteredStudents = useMemo(() => {
    let list = [...students];

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s => 
        s.name?.toLowerCase().includes(q) || 
        s.username?.toLowerCase().includes(q)
      );
    }

    // Sort: Students with doubts first
    return list.sort((a, b) => {
      const aDoubts = (a.syllabus || []).filter((t: any) => t.hasDoubt || t.status === 'completed_with_doubt').length;
      const bDoubts = (b.syllabus || []).filter((t: any) => t.hasDoubt || t.status === 'completed_with_doubt').length;
      return bDoubts - aDoubts;
    }).slice(0, 5); // Show top 5 relevant students
  }, [students, searchQuery]);

  return (
    <div className="flex flex-col h-full relative">
      
      {/* WIDGET HEADER */}
      <div className="flex items-center justify-between mb-4 relative z-10 gap-2 shrink-0">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center text-brand-orange shadow-inner">
            <Users size={16} strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">My Roster</h3>
            <p className="text-[9px] font-bold text-slate-400 tracking-wider">
              {students.length} of 5 Slots Filled
            </p>
          </div>
        </div>
        
        <button 
          onClick={handleNavigateToManagement} 
          className="text-[10px] font-bold text-brand-blue hover:underline transition-colors flex items-center gap-1 shrink-0 whitespace-nowrap"
        >
            Full Roster <ExternalLink size={10} className="mb-0.5" />
        </button>
      </div>

      {/* QUICK SEARCH */}
      <div className="mb-4 shrink-0 relative z-10">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
        <input 
          type="text" 
          placeholder="Quick search student..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none transition-all shadow-sm"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-rose-500 transition-colors">
            <X size={14} />
          </button>
        )}
      </div>

      {/* STUDENT LIST */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 relative z-10 flex flex-col gap-2 pb-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-full min-h-37.5">
            <Loader2 className="w-6 h-6 text-brand-orange animate-spin" />
          </div>
        ) : filteredStudents.length > 0 ? (
          filteredStudents.map((student) => {
            const doubtCount = (student.syllabus || []).filter((t: any) => t.hasDoubt || t.status === 'completed_with_doubt').length;

            return (
              <div 
                key={student._id}
                className={`flex items-center justify-between p-3 bg-white rounded-2xl border transition-all group ${
                  doubtCount > 0 ? 'border-rose-200 bg-linear-to-br from-white to-rose-50/30' : 'border-gray-100 hover:border-brand-blue/30'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative shrink-0">
                    {student.photo ? (
                      <img src={student.photo} alt={student.name} className="w-10 h-10 rounded-full object-cover border border-gray-100 shadow-sm" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-sm border border-gray-200">
                        {student.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    {doubtCount > 0 && (
                      <div className="absolute -top-1 -right-1 bg-rose-500 text-white text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-full border-2 border-white shadow-sm animate-pulse">
                        {doubtCount}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col min-w-0">
                    <h4 className="text-sm font-bold text-slate-800 truncate">{student.name}</h4>
                    <p className="text-[10px] font-medium text-slate-400 truncate">@{student.username}</p>
                  </div>
                </div>

                <button 
                  onClick={() => navigate(`/update-report/${student.username}`)}
                  className={`p-2 rounded-xl transition-all shadow-sm active:scale-90 ${
                    doubtCount > 0 
                      ? 'bg-rose-500 text-white hover:bg-rose-600' 
                      : 'bg-slate-900 text-white hover:bg-brand-blue'
                  }`}
                  title={doubtCount > 0 ? "Solve Doubts" : "Update Report"}
                >
                  <Rocket size={14} />
                </button>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-2xl h-full min-h-35.7">
            <Users size={28} className="opacity-20 mb-2" />
            <h4 className="text-xs font-bold text-slate-700">No Students Found</h4>
            <button 
              onClick={handleNavigateToManagement}
              className="mt-2 text-[10px] font-black text-brand-blue uppercase tracking-widest hover:underline"
            >
              + Claim Student
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentWidget;