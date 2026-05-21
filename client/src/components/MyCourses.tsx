import React, { useState, useEffect } from 'react';
import { 
  Code, Bot, Cpu, PenTool, Edit3, Palette, ScrollText, 
  Lightbulb, Hammer, CheckCircle2, Quote, User, Sparkles, Edit2, X, Save, PlusCircle, Link, Image as ImageIcon,
  GraduationCap, PauseCircle, FolderArchive, FileText, ExternalLink, CalendarDays, AlertTriangle, UploadCloud
} from 'lucide-react';

export interface CourseEnrollment {
  _id: string;
  courseName: string;
  level: string;
  projectName: string;
  currentMilestone: 'Ideation' | 'Prototyping' | 'Building' | 'Polishing' | 'Completed';
  mentorNote: string;
  teacherId: { name: string; photo: string } | string;
  status: 'active' | 'paused' | 'graduated';
  portfolio?: { title: string; mediaUrl: string; _id?: string }[]; 
  resources?: { title: string; fileUrl: string; dateAdded?: string; _id?: string }[]; 
  startDate?: string;
  endDate?: string;
  studentAcceptedGraduation?: boolean;
}

interface MyCoursesProps {
  role: string;
  selectedStudentUsername?: string | null; 
}

const MILESTONES = ['Ideation', 'Prototyping', 'Building', 'Polishing', 'Completed'];

const AVAILABLE_COURSES = [
  'Coding', 'Robotics', 'PCB Designing', 'Graphic Designing', 
  'Drawing', 'Sketching', 'Painting', 'Calligraphy'
];

const getCourseTheme = (name: string) => {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('coding')) return { icon: Code, color: 'text-blue-500', bg: 'bg-blue-50' };
  if (lowerName.includes('robotic')) return { icon: Bot, color: 'text-indigo-500', bg: 'bg-indigo-50' };
  if (lowerName.includes('pcb')) return { icon: Cpu, color: 'text-emerald-500', bg: 'bg-emerald-50' };
  if (lowerName.includes('graphic')) return { icon: PenTool, color: 'text-purple-500', bg: 'bg-purple-50' };
  if (lowerName.includes('sketch') || lowerName.includes('draw')) return { icon: Edit3, color: 'text-orange-500', bg: 'bg-orange-50' };
  if (lowerName.includes('paint')) return { icon: Palette, color: 'text-pink-500', bg: 'bg-pink-50' };
  if (lowerName.includes('calligraphy')) return { icon: ScrollText, color: 'text-amber-500', bg: 'bg-amber-50' };
  return { icon: Sparkles, color: 'text-brand-blue', bg: 'bg-blue-50' };
};

// 🚨 NEW: Dynamic Placeholders based on Course Name!
const getDynamicPlaceholders = (courseName?: string) => {
  const lowerName = (courseName || '').toLowerCase();
  if (lowerName.includes('coding')) return { media: 'e.g. Weather App GitHub Repo', resource: 'e.g. Python Cheat Sheet PDF' };
  if (lowerName.includes('robotic')) return { media: 'e.g. Line Follower Video', resource: 'e.g. Sensor Wiring Diagram PDF' };
  if (lowerName.includes('pcb')) return { media: 'e.g. Smart Watch Schematic', resource: 'e.g. Gerber Files ZIP' };
  if (lowerName.includes('graphic')) return { media: 'e.g. Figma Brand Identity', resource: 'e.g. Logo Vector Assets' };
  if (lowerName.includes('sketch') || lowerName.includes('draw')) return { media: 'e.g. Charcoal Portrait Final', resource: 'e.g. Anatomy Reference Image' };
  if (lowerName.includes('paint')) return { media: 'e.g. Watercolor Landscape', resource: 'e.g. Color Theory Guide' };
  if (lowerName.includes('calligraphy')) return { media: 'e.g. Gothic Script Quote', resource: 'e.g. Stroke Practice Sheets PDF' };
  return { media: 'e.g. Project Screenshot', resource: 'e.g. Reference Material' };
};

const formatDateTime = (dateString?: string) => {
  if (!dateString) return 'Unknown Date';
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
  });
};

const MyCourses: React.FC<MyCoursesProps> = ({ role, selectedStudentUsername }) => {
  const [courses, setCourses] = useState<CourseEnrollment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [editingCourse, setEditingCourse] = useState<CourseEnrollment | null>(null);
  const [editForm, setEditForm] = useState({ projectName: '', currentMilestone: '', mentorNote: '', status: 'active' as any });
  const [isSaving, setIsSaving] = useState(false);

  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [enrollForm, setEnrollForm] = useState({ courseName: AVAILABLE_COURSES[0], level: 'Level 1', projectName: '' });
  const [isEnrolling, setIsEnrolling] = useState(false);

  const [linkModalCourse, setLinkModalCourse] = useState<CourseEnrollment | null>(null);
  const [linkForm, setLinkForm] = useState({ title: '', mediaUrl: '' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaTab, setMediaTab] = useState<'link' | 'upload'>('link');
  const [isSavingLink, setIsSavingLink] = useState(false);

  const [resourceModalCourse, setResourceModalCourse] = useState<CourseEnrollment | null>(null);
  const [resourceForm, setResourceForm] = useState({ title: '', fileUrl: '' });
  const [isSavingResource, setIsSavingResource] = useState(false);

  useEffect(() => {
    const fetchCourses = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem("jwtoken");
        let url = `${import.meta.env.VITE_API}my-courses`;
        if (role === 'Teacher' && selectedStudentUsername) url += `?username=${selectedStudentUsername}`;

        const res = await fetch(url, { headers: { "Authorization": `Bearer ${token}` } });
        if (res.ok) setCourses(await res.json());
      } catch (error) {
        console.error("Failed to fetch courses:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (role === 'student' || role === 'Student' || (role === 'Teacher' && selectedStudentUsername)) fetchCourses();
    else setIsLoading(false);
  }, [role, selectedStudentUsername]);

  const handleEditClick = (course: CourseEnrollment) => {
    setEditForm({ projectName: course.projectName, currentMilestone: course.currentMilestone, mentorNote: course.mentorNote, status: course.status || 'active' });
    setEditingCourse(course);
  };

  const handleSaveEdit = async () => {
    if (!editingCourse) return;
    setIsSaving(true);
    let payload: any = { ...editForm };
    if (editForm.status === 'graduated' && editingCourse.status !== 'graduated') {
      payload.endDate = new Date().toISOString();
    }
    try {
      const token = localStorage.getItem("jwtoken");
      const res = await fetch(`${import.meta.env.VITE_API}course/${editingCourse._id}`, {
        method: 'PUT', headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }, body: JSON.stringify(payload)
      });
      if (res.ok) {
        setCourses(prev => prev.map(c => c._id === editingCourse._id ? { ...c, ...payload } as CourseEnrollment : c));
        setEditingCourse(null); 
      }
    } catch (error) { console.error(error); } finally { setIsSaving(false); }
  };

  const handleEnrollStudent = async () => {
    if (!selectedStudentUsername) return;
    setIsEnrolling(true);
    try {
      const token = localStorage.getItem("jwtoken");
      const res = await fetch(`${import.meta.env.VITE_API}enroll-course`, {
        method: 'POST', headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ studentUsername: selectedStudentUsername, courseName: enrollForm.courseName, level: enrollForm.level, projectName: enrollForm.projectName || "Brainstorming Phase..." })
      });
      if (res.ok) {
        const data = await res.json();
        setCourses(prev => [data.course, ...prev]);
        setIsEnrollModalOpen(false);
        setEnrollForm({ courseName: AVAILABLE_COURSES[0], level: 'Level 1', projectName: '' }); 
      }
    } catch (error) { console.error(error); } finally { setIsEnrolling(false); }
  };

  const handleSaveLink = async () => {
    if (!linkModalCourse || !linkForm.title) return;
    if (mediaTab === 'link' && !linkForm.mediaUrl) return;
    if (mediaTab === 'upload' && !selectedFile) return;

    setIsSavingLink(true);

    try {
      let finalMediaUrl = linkForm.mediaUrl;

      if (mediaTab === 'upload' && selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("upload_preset", "cute_profiles"); 
        formData.append("cloud_name", "da6jhcsmm"); 

        const cloudinaryRes = await fetch("https://api.cloudinary.com/v1_1/da6jhcsmm/image/upload", { 
          method: "POST", body: formData 
        });

        if (!cloudinaryRes.ok) throw new Error("Failed to upload image");
        
        const cloudinaryData = await cloudinaryRes.json();
        finalMediaUrl = cloudinaryData.secure_url;
      }

      const token = localStorage.getItem("jwtoken");
      const updatedPortfolio = [...(linkModalCourse.portfolio || []), { title: linkForm.title, mediaUrl: finalMediaUrl }];
      
      const res = await fetch(`${import.meta.env.VITE_API}course/${linkModalCourse._id}`, {
        method: 'PUT',
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ portfolio: updatedPortfolio })
      });

      if (res.ok) {
        setCourses(prev => prev.map(c => c._id === linkModalCourse._id ? { ...c, portfolio: updatedPortfolio } : c));
        setLinkModalCourse(null);
        setLinkForm({ title: '', mediaUrl: '' });
        setSelectedFile(null);
        setMediaTab('link');
      }
    } catch (error) {
      console.error("Failed to add media:", error);
    } finally {
      setIsSavingLink(false);
    }
  };

  const handleSaveResource = async () => {
    if (!resourceModalCourse || !resourceForm.title || !resourceForm.fileUrl) return;
    setIsSavingResource(true);
    try {
      const token = localStorage.getItem("jwtoken");
      const updatedResources = [...(resourceModalCourse.resources || []), { title: resourceForm.title, fileUrl: resourceForm.fileUrl }];
      const res = await fetch(`${import.meta.env.VITE_API}course/${resourceModalCourse._id}`, {
        method: 'PUT', headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ resources: updatedResources })
      });
      if (res.ok) {
        setCourses(prev => prev.map(c => c._id === resourceModalCourse._id ? { ...c, resources: updatedResources } : c));
        setResourceModalCourse(null);
        setResourceForm({ title: '', fileUrl: '' });
      }
    } catch (error) { console.error(error); } finally { setIsSavingResource(false); }
  };

  const handleStudentGraduationResponse = async (courseId: string, isAccepted: boolean) => {
    try {
      const token = localStorage.getItem("jwtoken");
      const payload = isAccepted 
        ? { studentAcceptedGraduation: true }
        : { status: 'active', endDate: null, studentAcceptedGraduation: false };

      const res = await fetch(`${import.meta.env.VITE_API}course/${courseId}`, {
        method: 'PUT', headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (res.ok) setCourses(prev => prev.map(c => c._id === courseId ? { ...c, ...payload } as CourseEnrollment : c));
    } catch (error) { console.error(error); }
  };

  if (isLoading) return <div className="flex justify-center items-center py-20"><div className="w-8 h-8 border-4 border-brand-orange border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 relative">
      {role === 'Teacher' && selectedStudentUsername && (
        <div className="flex justify-end mb-4">
          <button onClick={() => setIsEnrollModalOpen(true)} className="flex items-center gap-2 px-5 py-2.5 bg-brand-orange text-white font-bold rounded-xl shadow-md hover:bg-orange-600 active:scale-95 transition">
            <PlusCircle size={18} /> Assign New Course
          </button>
        </div>
      )}

      {role === 'Teacher' && !selectedStudentUsername ? (
        <div className="bg-white rounded-3xl p-10 text-center border border-gray-100 shadow-sm flex flex-col items-center mt-4">
          <User size={48} className="text-gray-200 mb-4" />
          <h3 className="font-display text-xl font-bold text-gray-800 mb-2">Select a Student</h3>
          <p className="text-gray-500 text-sm max-w-sm">Please select a student from your class list above to view, manage, or assign their skill development courses.</p>
        </div>
      ) : courses.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center border border-gray-100 shadow-sm flex flex-col items-center mt-4">
          <Sparkles size={48} className="text-gray-200 mb-4" />
          <h3 className="font-display text-xl font-bold text-gray-800 mb-2">No Active Courses</h3>
          <p className="text-gray-500 text-sm max-w-sm">{role === 'Teacher' ? "This student isn't enrolled in any skill courses yet." : "You haven't enrolled in any skill development courses yet."}</p>
        </div>
      ) : (
        courses.map((course) => {
          const theme = getCourseTheme(course.courseName);
          const Icon = theme.icon;
          const currentMilestoneIndex = MILESTONES.indexOf(course.currentMilestone);
          const teacherName = typeof course.teacherId === 'object' ? course.teacherId.name : 'Your Mentor';
          
          const portfolioItems = course.portfolio || [];
          const resourceItems = course.resources || [];
          
          const isGraduated = course.status === 'graduated';
          const isPaused = course.status === 'paused';
          const isPendingGraduation = isGraduated && !course.studentAcceptedGraduation;

          return (
            <div key={course._id} className={`bg-white border rounded-3xl overflow-hidden shadow-lg transition-all hover:shadow-xl relative group mt-4 ${isGraduated && !isPendingGraduation ? 'border-green-200 shadow-green-100/50' : isPaused ? 'border-yellow-200 shadow-yellow-100/50 opacity-80' : 'border-gray-100 shadow-gray-200/40'}`}>
              
              {role === 'Teacher' && (
                <button onClick={() => handleEditClick(course)} className="absolute top-4 right-4 bg-white border border-gray-200 text-gray-500 hover:text-brand-blue hover:border-brand-blue p-2 rounded-xl shadow-sm transition-all z-20">
                  <Edit2 size={16} />
                </button>
              )}

              <div className="p-5 border-b border-gray-50 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl ${theme.bg}`}><Icon className={theme.color} size={24} /></div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="font-display font-black text-xl text-gray-800">{course.courseName}</h3>
                      {isGraduated && (
                        <span className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${isPendingGraduation ? 'text-amber-700 bg-amber-100 border-amber-200' : 'text-green-700 bg-green-100 border-green-200'}`}>
                          {isPendingGraduation ? <AlertTriangle size={12} /> : <GraduationCap size={12} />} 
                          {isPendingGraduation ? 'Pending Approval' : 'Graduated'}
                        </span>
                      )}
                      {isPaused && (
                        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-md border border-yellow-200">
                          <PauseCircle size={12} /> Paused
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-bold uppercase tracking-wider text-gray-400 bg-white px-2 py-0.5 rounded-md border border-gray-200 shadow-sm">{course.level}</span>
                      <span className="text-[10px] font-medium text-gray-400 flex items-center gap-1">
                        <CalendarDays size={12} /> Started: {formatDateTime(course.startDate)}
                      </span>
                      {course.endDate && isGraduated && (
                        <span className={`text-[10px] font-bold flex items-center gap-1 ${isPendingGraduation ? 'text-amber-500' : 'text-green-500'}`}>
                          • Completed: {formatDateTime(course.endDate)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 md:p-8">
                
                {role?.toLowerCase() === 'student' && isPendingGraduation && (
                  <div className="bg-linear-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-5 mb-8 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 animate-in slide-in-from-top-4 duration-500">
                    <div>
                      <h4 className="text-green-800 font-bold flex items-center gap-2 mb-1">
                        <GraduationCap size={18} /> Graduation Proposed!
                      </h4>
                      <p className="text-sm text-green-700 font-medium">Your mentor marked this project as complete. Do you agree?</p>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button onClick={() => handleStudentGraduationResponse(course._id, false)} className="flex-1 sm:flex-none px-4 py-2 bg-white border border-green-200 text-green-700 font-bold rounded-xl hover:bg-green-50 transition active:scale-95 text-sm">
                        I need more time
                      </button>
                      <button onClick={() => handleStudentGraduationResponse(course._id, true)} className="flex-1 sm:flex-none px-5 py-2 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 shadow-md shadow-green-500/20 transition active:scale-95 text-sm">
                        Accept & Complete
                      </button>
                    </div>
                  </div>
                )}

                <div className="mb-8">
                  <p className="text-sm font-bold text-brand-orange uppercase tracking-wider mb-1 flex items-center gap-2">
                    <Hammer size={14} /> Active Project
                  </p>
                  <h4 className="text-2xl md:text-3xl font-display font-black text-gray-900">{course.projectName}</h4>
                </div>

                <div className="relative mb-8">
                  <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-100 -translate-y-1/2 rounded-full z-0"></div>
                  <div className={`absolute top-1/2 left-0 h-1 -translate-y-1/2 rounded-full z-0 transition-all duration-700 ease-out ${isGraduated && !isPendingGraduation ? 'bg-green-500' : 'bg-brand-blue'}`} style={{ width: `${(currentMilestoneIndex / (MILESTONES.length - 1)) * 100}%` }}></div>
                  <div className="relative z-10 flex justify-between">
                    {MILESTONES.map((milestone, idx) => {
                      const isCompleted = idx < currentMilestoneIndex;
                      const isActive = idx === currentMilestoneIndex;
                      return (
                        <div key={milestone} className="flex flex-col items-center gap-2">
                          <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${isCompleted ? (isGraduated && !isPendingGraduation ? 'bg-green-500 border-green-500 text-white' : 'bg-brand-blue border-brand-blue text-white') : isActive ? 'bg-white border-brand-blue text-brand-blue shadow-[0_0_15px_rgba(37,99,235,0.3)] scale-110' : 'bg-white border-gray-200 text-gray-300'}`}>
                            {isCompleted ? <CheckCircle2 size={14} /> : <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-brand-blue' : 'bg-gray-200'}`} />}
                          </div>
                          <span className={`text-[10px] md:text-xs font-bold ${isActive ? 'text-brand-blue' : isCompleted ? 'text-gray-600' : 'text-gray-400'}`}>{milestone}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-amber-50/60 border border-amber-200/60 rounded-2xl p-5 relative overflow-hidden mb-8">
                  <Quote className="absolute -top-2 -left-2 text-amber-500/10 rotate-180" size={80} />
                  <div className="relative z-10 flex gap-4 items-start">
                    <div className="bg-amber-100 p-2 rounded-xl shrink-0 mt-1"><Lightbulb className="text-amber-600" size={20} /></div>
                    <div>
                      <h5 className="text-xs font-bold uppercase tracking-wider text-amber-800 mb-1">Note from {teacherName}</h5>
                      <p className="text-amber-900/80 font-medium leading-relaxed italic text-sm md:text-base">"{course.mentorNote}"</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-gray-100 pt-6">
                  {/* PROJECT LINKS & MEDIA */}
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h5 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                        <ImageIcon size={16} className="text-brand-blue" /> Project Gallery
                      </h5>
                      <button onClick={() => setLinkModalCourse(course)} className="text-xs font-bold text-brand-blue bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition flex items-center gap-1.5">
                        <PlusCircle size={14} /> Add Media
                      </button>
                    </div>

                    {portfolioItems.length === 0 ? (
                      <div className="text-center py-6 bg-gray-50 border border-dashed border-gray-200 rounded-2xl">
                        <p className="text-sm font-medium text-gray-400">No media added yet.</p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {portfolioItems.map((item, idx) => {
                          const isImage = item.mediaUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i) != null || item.mediaUrl.includes('cloudinary');
                          return (
                            <a key={idx} href={item.mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl hover:border-brand-blue hover:shadow-sm transition bg-white group">
                              {isImage ? (
                                <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-gray-100 border border-gray-200">
                                  <img src={item.mediaUrl} alt={item.title} className="w-full h-full object-cover" />
                                </div>
                              ) : (
                                <div className="bg-slate-50 p-2 rounded-lg text-gray-400 group-hover:text-brand-blue group-hover:bg-blue-50 transition shrink-0">
                                  <Link size={18} />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-800 truncate">{item.title}</p>
                                {!isImage && <p className="text-xs text-gray-400 truncate">{item.mediaUrl}</p>}
                              </div>
                              <ExternalLink size={14} className="text-gray-300 group-hover:text-brand-blue" />
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* COURSE RESOURCES */}
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h5 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                        <FolderArchive size={16} className="text-brand-orange" /> Resources Vault
                      </h5>
                      {role === 'Teacher' && (
                        <button onClick={() => setResourceModalCourse(course)} className="text-xs font-bold text-brand-orange bg-orange-50 px-3 py-1.5 rounded-lg hover:bg-orange-100 transition flex items-center gap-1.5">
                          <PlusCircle size={14} /> Add
                        </button>
                      )}
                    </div>
                    {resourceItems.length === 0 ? (
                      <div className="text-center py-6 bg-gray-50 border border-dashed border-gray-200 rounded-2xl">
                        <p className="text-sm font-medium text-gray-400">No resources provided yet.</p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {resourceItems.map((item, idx) => (
                          <a key={idx} href={item.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 border border-orange-100/50 rounded-xl hover:border-brand-orange hover:shadow-sm transition bg-orange-50/30 group">
                            <div className="bg-orange-100 p-2 rounded-lg text-brand-orange group-hover:bg-brand-orange group-hover:text-white transition shrink-0">
                              <FileText size={18} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-gray-800 truncate">{item.title}</p>
                            </div>
                            <ExternalLink size={14} className="text-orange-300 group-hover:text-brand-orange" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })
      )}

      {/* 🚨 ADD MEDIA / LINK MODAL (UPDATED WITH DYNAMIC PLACEHOLDERS) 🚨 */}
      {linkModalCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-slate-50">
              <h3 className="font-display font-bold text-lg text-gray-800 flex items-center gap-2">
                <ImageIcon size={18} className="text-brand-blue" /> Add Project Media
              </h3>
              <button 
                onClick={() => {
                  setLinkModalCourse(null);
                  setLinkForm({ title: '', mediaUrl: '' });
                  setSelectedFile(null);
                  setMediaTab('link');
                }} 
                className="p-2 text-gray-400 hover:text-red-500 transition hover:bg-red-50 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Media Title</label>
                <input 
                  type="text" 
                  value={linkForm.title} 
                  onChange={(e) => setLinkForm(prev => ({ ...prev, title: e.target.value }))} 
                  placeholder={getDynamicPlaceholders(linkModalCourse.courseName).media} 
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-brand-blue focus:bg-white transition text-gray-800 font-medium" 
                />
              </div>

              <div className="flex p-1 bg-gray-100 rounded-xl">
                <button 
                  onClick={() => setMediaTab('link')} 
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mediaTab === 'link' ? 'bg-white text-brand-blue shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Web Link
                </button>
                <button 
                  onClick={() => setMediaTab('upload')} 
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${mediaTab === 'upload' ? 'bg-white text-brand-blue shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <UploadCloud size={16} /> Upload Image
                </button>
              </div>

              <div className="pt-2">
                {mediaTab === 'link' ? (
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">URL / Link</label>
                    <input 
                      type="url" 
                      value={linkForm.mediaUrl} 
                      onChange={(e) => setLinkForm(prev => ({ ...prev, mediaUrl: e.target.value }))} 
                      placeholder="https://..." 
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-brand-blue focus:bg-white transition text-gray-800 font-medium" 
                    />
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center text-center bg-gray-50/50 hover:bg-gray-50 hover:border-brand-blue transition group relative">
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <ImageIcon size={32} className={`mb-2 transition ${selectedFile ? 'text-brand-blue' : 'text-gray-300 group-hover:text-brand-blue'}`} />
                    {selectedFile ? (
                      <div>
                        <p className="text-sm font-bold text-brand-blue">{selectedFile.name}</p>
                        <p className="text-xs text-gray-400 mt-1">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-bold text-gray-700">Click or drag image to upload</p>
                        <p className="text-xs text-gray-400 mt-1">PNG, JPG, GIF up to 5MB</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>
            <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 mt-auto">
              <button 
                onClick={() => {
                  setLinkModalCourse(null);
                  setLinkForm({ title: '', mediaUrl: '' });
                  setSelectedFile(null);
                  setMediaTab('link');
                }} 
                className="px-5 py-2.5 font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-xl transition"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveLink} 
                disabled={isSavingLink || !linkForm.title || (mediaTab === 'link' ? !linkForm.mediaUrl : !selectedFile)} 
                className="flex items-center gap-2 px-6 py-2.5 font-bold text-white bg-brand-blue rounded-xl shadow-md hover:bg-blue-600 active:scale-95 transition disabled:opacity-50"
              >
                {isSavingLink ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={18} />} 
                {isSavingLink ? 'Uploading...' : 'Save Media'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🚨 ADD RESOURCE MODAL (UPDATED WITH DYNAMIC PLACEHOLDERS) 🚨 */}
      {resourceModalCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-slate-50">
              <h3 className="font-display font-bold text-lg text-gray-800 flex items-center gap-2">
                <FolderArchive size={18} className="text-brand-orange" /> Add Course Resource
              </h3>
              <button onClick={() => setResourceModalCourse(null)} className="p-2 text-gray-400 hover:text-red-500 transition hover:bg-red-50 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Resource Title</label>
                <input 
                  type="text" 
                  value={resourceForm.title} 
                  onChange={(e) => setResourceForm(prev => ({ ...prev, title: e.target.value }))} 
                  placeholder={getDynamicPlaceholders(resourceModalCourse.courseName).resource} 
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-brand-orange focus:bg-white transition text-gray-800 font-medium" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">File URL</label>
                <input 
                  type="url" 
                  value={resourceForm.fileUrl} 
                  onChange={(e) => setResourceForm(prev => ({ ...prev, fileUrl: e.target.value }))} 
                  placeholder="https://drive.google.com/..." 
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-brand-orange focus:bg-white transition text-gray-800 font-medium" 
                />
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setResourceModalCourse(null)} className="px-5 py-2.5 font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-xl transition">Cancel</button>
              <button onClick={handleSaveResource} disabled={isSavingResource || !resourceForm.title || !resourceForm.fileUrl} className="flex items-center gap-2 px-6 py-2.5 font-bold text-white bg-brand-orange rounded-xl shadow-md hover:bg-orange-600 active:scale-95 transition disabled:opacity-50">
                {isSavingResource ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={18} />} Add Resource
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT PROGRESS MODAL */}
      {editingCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-slate-50">
              <h3 className="font-display font-bold text-lg text-gray-800 flex items-center gap-2">
                <Edit2 size={18} className="text-brand-blue" /> Update Progress
              </h3>
              <button onClick={() => setEditingCourse(null)} className="p-2 text-gray-400 hover:text-red-500 transition hover:bg-red-50 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-5">
              <div className="flex gap-4 mb-2">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Project Name</label>
                  <input type="text" value={editForm.projectName} onChange={(e) => setEditForm(prev => ({ ...prev, projectName: e.target.value }))} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-brand-blue focus:bg-white transition text-gray-800 font-medium" />
                </div>
                <div className="w-1/3">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Status</label>
                  <select 
                    value={editForm.status} 
                    disabled={editingCourse.status === 'graduated'}
                    onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value as any }))} 
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-brand-blue focus:bg-white transition text-gray-800 font-medium appearance-none disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                  >
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="graduated">Graduated</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Current Milestone</label>
                <select value={editForm.currentMilestone} onChange={(e) => setEditForm(prev => ({ ...prev, currentMilestone: e.target.value }))} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-brand-blue focus:bg-white transition text-gray-800 font-medium appearance-none">
                  {MILESTONES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2"><Lightbulb size={14} className="text-amber-500" /> Mentor's Note</label>
                <textarea value={editForm.mentorNote} onChange={(e) => setEditForm(prev => ({ ...prev, mentorNote: e.target.value }))} rows={4} className="w-full px-4 py-3 bg-amber-50/50 border border-amber-200/50 rounded-xl focus:outline-none focus:border-amber-400 focus:bg-amber-50 transition text-amber-900 font-medium italic resize-none" />
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setEditingCourse(null)} className="px-5 py-2.5 font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-xl transition">Cancel</button>
              <button onClick={handleSaveEdit} disabled={isSaving} className="flex items-center gap-2 px-6 py-2.5 font-bold text-white bg-brand-blue rounded-xl shadow-md hover:bg-blue-600 active:scale-95 transition disabled:opacity-50">
                {isSaving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={18} />} Save Updates
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ENROLL MODAL */}
      {isEnrollModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-slate-50">
              <h3 className="font-display font-bold text-lg text-gray-800 flex items-center gap-2">
                <PlusCircle size={18} className="text-brand-orange" /> Assign Course
              </h3>
              <button onClick={() => setIsEnrollModalOpen(false)} className="p-2 text-gray-400 hover:text-red-500 transition hover:bg-red-50 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Select Course</label>
                <select value={enrollForm.courseName} onChange={(e) => setEnrollForm(prev => ({ ...prev, courseName: e.target.value }))} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-brand-orange focus:bg-white transition text-gray-800 font-medium appearance-none">
                  {AVAILABLE_COURSES.map(course => <option key={course} value={course}>{course}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Course Level</label>
                <select value={enrollForm.level} onChange={(e) => setEnrollForm(prev => ({ ...prev, level: e.target.value }))} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-brand-orange focus:bg-white transition text-gray-800 font-medium appearance-none">
                  {['Level 1', 'Level 2', 'Level 3'].map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Initial Project Idea</label>
                <input type="text" value={enrollForm.projectName} onChange={(e) => setEnrollForm(prev => ({ ...prev, projectName: e.target.value }))} placeholder="e.g. Brainstorming..." className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-brand-orange focus:bg-white transition text-gray-800 font-medium" />
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setIsEnrollModalOpen(false)} className="px-5 py-2.5 font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-xl transition">Cancel</button>
              <button onClick={handleEnrollStudent} disabled={isEnrolling} className="flex items-center gap-2 px-6 py-2.5 font-bold text-white bg-brand-orange rounded-xl shadow-md hover:bg-orange-600 active:scale-95 transition disabled:opacity-50">
                {isEnrolling ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={18} />} Enroll Student
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default MyCourses;