import React, { useState, useEffect } from "react";
import { fetchWithCache } from '../utils/apiCache';
import { useNavigate } from "react-router-dom";
import { 
  PersonAdd, 
  RocketLaunch, 
   
  
  Person, 
  Email, 
  Badge 
} from "@mui/icons-material";
import DeleteOutline from '@mui/icons-material/DeleteOutlined';
import ErrorOutline from '@mui/icons-material/ErrorOutlined';
import { CircularProgress } from "@mui/material";

// Lucide icons
import { Search, X, UserPlus, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';

// The sleek Toast Component
import Muialert from "./Muialert";

interface StudentManagementProps {
  userData: any;
}

interface StudentResult {
  _id: string;
  name: string;
  username: string;
}

const StudentManagement: React.FC<StudentManagementProps> = ({ userData }) => {
  const navigate = useNavigate();
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Roster Management State
  const [addModalOpen, setAddModalOpen] = useState(false);
  
  // Unassign Modal State
  const [unassignModalOpen, setUnassignModalOpen] = useState(false);
  const [studentToUnassign, setStudentToUnassign] = useState<string | null>(null);
  const [isUnassigning, setIsUnassigning] = useState(false);

  // Toast Alert State
  const [alertMessage, setAlertMessage] = useState("");
  const [alertSeverity, setAlertSeverity] = useState<"success" | "error" | "info" | "warning">("info");
  const [showAlert, setShowAlert] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  
  // Search-Specific State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<StudentResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentResult | null>(null);

  const teacherUsername = userData?.username || userData?.Username || localStorage.getItem("Username");

  const fetchMyStudents = async (forceRefresh = false) => {
    if (!teacherUsername) return;
    if (forceRefresh || students.length === 0) setLoading(true);
    
    try {
      const token = localStorage.getItem("jwtoken");
      const url = `${import.meta.env.VITE_API}my-students/${teacherUsername}`;
      
      const data = await fetchWithCache(url, { "Authorization": `Bearer ${token}` }, forceRefresh);
      setStudents(data);
    } catch (error) {
      console.error("Failed to fetch roster:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyStudents();
  }, [teacherUsername]);

  // Debounced Search Effect for the Popup
  useEffect(() => {
    if (searchQuery.trim() === '' || selectedStudent) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);

    const timeoutId = setTimeout(async () => {
      try {
        const token = localStorage.getItem("jwtoken");
        const res = await fetch(`${import.meta.env.VITE_API}search-students?q=${searchQuery}`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
        }
      } catch (error) {
        console.error("Search failed:", error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, selectedStudent]);

  // Helper to reset the popup when closed
  const handleCloseModal = () => {
    setAddModalOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    setSelectedStudent(null);
  };

  const handleClaimStudent = async () => {
    if (students.length >= 5) {
      setAlertSeverity("error");
      setAlertMessage("Limit Reached: You can only manage up to 5 students.");
      setShowAlert(true);
      return;
    }

    if (!selectedStudent) return;

    setIsAssigning(true);
    try {
      const token = localStorage.getItem("jwtoken");
      const res = await fetch(`${import.meta.env.VITE_API}assign-teacher`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ studentUsername: selectedStudent.username, teacherUsername })
      });
      if (res.ok) {
        setAlertSeverity("success");
        setAlertMessage("Student successfully added to roster! 🚀");
        setShowAlert(true);
        fetchMyStudents();
        setTimeout(() => handleCloseModal(), 1500);
      } else {
        const data = await res.json();
        setAlertSeverity("error");
        setAlertMessage(data.error || "Failed to assign student.");
        setShowAlert(true);
      }
    } catch (error) {
      setAlertSeverity("error");
      setAlertMessage("Network error assigning student.");
      setShowAlert(true);
    } finally {
      setIsAssigning(false);
    }
  };

  const handleUnassignClick = (username: string) => {
    setStudentToUnassign(username);
    setUnassignModalOpen(true);
  };

  const confirmUnassign = async () => {
    if (!studentToUnassign) return;
    setIsUnassigning(true);

    try {
      const token = localStorage.getItem("jwtoken");
      const res = await fetch(`${import.meta.env.VITE_API}unassign-student`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ studentUsername: studentToUnassign })
      });
      
      if (res.ok) {
        setStudents(prev => prev.filter(s => s.username !== studentToUnassign));
        setAlertSeverity("info");
        setAlertMessage(`Student @${studentToUnassign} removed from roster.`);
        setShowAlert(true);
        setUnassignModalOpen(false);
      } else {
        throw new Error("Failed to unassign");
      }
    } catch (error) {
      setAlertSeverity("error");
      setAlertMessage("Network error while unassigning.");
      setShowAlert(true);
    } finally {
      setIsUnassigning(false);
      setStudentToUnassign(null);
    }
  };

  return (
    <div className="relative w-full pb-12 md:pb-6">
      <div className="flex justify-between items-center mb-8 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-2xl font-display font-bold text-brand-blue">My Students</h2>
          <p className="text-sm text-gray-400">{students.length} of 5 slots filled</p>
        </div>
        
        {/* Mobile Round Button vs Desktop Full Button */}
        <button 
          onClick={() => setAddModalOpen(true)}
          disabled={students.length >= 5}
          className={`w-12 h-12 md:w-auto md:h-auto md:px-6 md:py-3 rounded-full md:rounded-2xl font-bold flex items-center justify-center gap-2 transition shadow-md ${students.length >= 5 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-brand-orange text-white hover:bg-orange-600 active:scale-95'}`}
        >
          <PersonAdd />
          <span className="hidden md:inline">Claim Student</span>
        </button>
      </div>

      {loading ? (
        <div className="flex w-full items-center justify-center py-20">
          <CircularProgress color="inherit" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         
        {students.map((student) => {
          const activeDoubtCount = Array.isArray(student.syllabus) 
            ? student.syllabus.filter((t: any) => 
                (t.hasDoubt || t.status === 'completed_with_doubt') && 
                t.topicName !== "New Topic"
              ).length 
            : 0;

          return (
            <div key={student._id} className="bg-white rounded-4xl p-6 shadow-lg border border-gray-50 relative group transition-all hover:shadow-xl hover:-translate-y-1 flex flex-col h-full min-h-75">
              
              {activeDoubtCount > 0 && (
                <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-red-500 text-white px-3 py-1 rounded-full shadow-lg shadow-red-100 animate-pulse z-10">
                  <ErrorOutline sx={{ fontSize: 14 }} /> 
                  <span className="text-[10px] font-black uppercase tracking-wider">
                    {activeDoubtCount} {activeDoubtCount === 1 ? 'Doubt' : 'Doubts'}
                  </span>
                </div>
              )}

                <button 
                  onClick={() => handleUnassignClick(student.username)}
                  className="absolute top-4 right-4 text-gray-300 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-full"
                >
                  <DeleteOutline fontSize="small" />
                </button>

                <div className="flex flex-col items-center text-center flex-1">
                  <div className={`w-20 h-20 rounded-3xl flex items-center justify-center text-3xl font-bold mb-4 overflow-hidden border-4 shadow-sm transition-all ${activeDoubtCount > 0 ? 'border-red-100 bg-red-50 text-red-500' : 'border-white bg-brand-blue/10 text-brand-blue'}`}>
                    {student.photo ? (
                      <img src={student.photo} className="w-full h-full object-cover" alt={student.name} />
                    ) : (
                      student.name?.[0].toUpperCase()
                    )}
                  </div>

                  <h3 className="text-xl font-bold text-gray-800">{student.name}</h3>
                  <span className="text-xs font-bold text-gray-400 mb-4">@{student.username}</span>
                  
                  <div className="w-full space-y-2 mb-6 border-t border-gray-50 pt-4 flex-1">
                    <div className="flex items-center gap-2 text-gray-500 text-sm">
                      <Email fontSize="inherit" className="text-gray-300" /> 
                      <span className="truncate">{student.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-500 text-sm">
                      <Badge fontSize="inherit" className="text-gray-300" /> 
                      {student.classSemester || "General Track"}
                    </div>
                  </div>

                  <button 
                    onClick={() => navigate(`/update-report/${student.username}`)}
                    className={`w-full py-3 mt-auto rounded-2xl font-bold flex items-center justify-center gap-2 transition shadow-md ${activeDoubtCount > 0 ? 'bg-red-600 hover:bg-red-700 shadow-red-100' : 'bg-slate-900 hover:bg-brand-blue shadow-slate-200'} text-white`}
                  >
                    <RocketLaunch fontSize="small" /> 
                    {activeDoubtCount > 0 ? 'Solve Doubts' : 'Update Report'}
                  </button>
                </div>
              </div>
            );
          })}

          {Array.from({ length: 5 - students.length }).map((_, i) => (
            <div key={`empty-${i}`} className="border-2 border-dashed border-gray-200 rounded-4xl flex flex-col items-center justify-center p-8 opacity-60 min-h-75">
              <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center text-gray-300 mb-2">
                <Person fontSize="large" />
              </div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Available Slot</p>
            </div>
          ))}
        </div>
      )}

      {/* THE NEW SEARCH-ENABLED CLAIM MODAL */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-slate-50/50">
              <h2 className="font-display text-xl font-bold text-gray-800 flex items-center gap-2">
                <UserPlus className="text-brand-blue" size={24} />
                Claim Student
              </h2>
              <button onClick={handleCloseModal} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition">
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 relative">
              <p className="text-sm text-gray-500 mb-4 font-medium">
                Search for a student by their name or username to add them to your roster.
              </p>

              {/* Input Area */}
              <div className={`flex items-center gap-2 border-2 transition-colors rounded-xl px-3 py-2 relative z-20 ${selectedStudent ? 'border-green-500 bg-green-50' : 'border-gray-200 focus-within:border-brand-blue bg-white'}`}>
                {isSearching ? (
                  <Loader2 className="animate-spin text-brand-blue" size={18} />
                ) : selectedStudent ? (
                  <CheckCircle2 className="text-green-500" size={18} />
                ) : (
                  <Search className="text-gray-400" size={18} />
                )}
                
                <input
                  type="text"
                  placeholder="Type a name or username..."
                  value={searchQuery}
                  onChange={(e) => {
                    if (selectedStudent) {
                      setSelectedStudent(null);
                      setSearchQuery("");
                    } else {
                      setSearchQuery(e.target.value);
                    }
                  }}
                  className="flex-1 bg-transparent border-none focus:outline-none text-sm font-medium text-gray-700 placeholder:text-gray-400 py-1"
                  autoComplete="off"
                />

                {selectedStudent && (
                  <button onClick={() => { setSelectedStudent(null); setSearchQuery(''); }} className="p-1 text-gray-400 hover:text-red-500 rounded-full">
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* Dropdown Results */}
              {searchResults.length > 0 && (
                <div className="absolute top-25 left-6 right-6 mt-1 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden z-30 max-h-48 overflow-y-auto custom-scrollbar">
                  {searchResults.map((student) => (
                    <button
                      key={student._id}
                      onClick={() => {
                        setSelectedStudent(student);
                        setSearchQuery(student.name || student.username);
                        setSearchResults([]);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-50 last:border-0 transition flex flex-col"
                    >
                      <span className="text-sm font-bold text-gray-800">{student.name || "Unknown Name"}</span>
                      <span className="text-xs font-medium text-gray-400">@{student.username}</span>
                    </button>
                  ))}
                </div>
              )}
              
              {/* Empty Search State */}
              {searchQuery.length > 1 && searchResults.length === 0 && !isSearching && !selectedStudent && (
                 <div className="absolute top-25 left-6 right-6 mt-1 bg-white border border-gray-100 rounded-xl shadow-xl p-4 text-center z-30">
                   <p className="text-sm text-gray-500 font-medium">No students found matching "{searchQuery}"</p>
                 </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-100 bg-slate-50 flex justify-end gap-3 rounded-b-3xl">
              <button 
                onClick={handleCloseModal}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-200 transition"
              >
                Cancel
              </button>
              <button
                disabled={!selectedStudent || isAssigning}
                onClick={handleClaimStudent}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition flex items-center gap-2 ${
                  selectedStudent && !isAssigning
                    ? 'bg-brand-orange text-white hover:bg-orange-600 shadow-md shadow-orange-500/20' 
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {isAssigning ? <Loader2 className="animate-spin" size={16} /> : 'Assign Student'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* THE NEW UNASSIGN CONFIRMATION MODAL */}
      {unassignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-500 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <h3 className="text-xl font-display font-bold text-gray-800">Remove Student?</h3>
            </div>
            <p className="text-sm text-gray-500 mb-8 pl-1">
              Are you sure you want to remove <span className="font-bold text-gray-700">@{studentToUnassign}</span> from your roster? You can always add them back later if needed.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setUnassignModalOpen(false)} 
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-200 transition"
              >
                Cancel
              </button>
              <button 
                onClick={confirmUnassign} 
                disabled={isUnassigning}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition shadow-md shadow-red-500/20 flex items-center gap-2"
              >
                {isUnassigning ? <Loader2 className="animate-spin" size={16} /> : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* THE TOAST SYSTEM */}
      {showAlert && (
        <Muialert 
          message={alertMessage} 
          severity={alertSeverity} 
          onClose={() => setShowAlert(false)} 
        />
      )}

    </div>
  );
};

export default StudentManagement;