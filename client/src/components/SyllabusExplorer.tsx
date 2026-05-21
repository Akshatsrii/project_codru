import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchWithCache } from '../utils/apiCache';
// import * as ExcelJS from 'exceljs';
// import * as XLSX from 'xlsx';
import { 
  Plus, Trash2, ChevronRight, ChevronDown, Share2, FileSpreadsheet, FileText,
  Search, X, ArrowLeft, Globe, BookMarked, Check, Loader2, Edit2, Camera,
  Maximize2, Minimize2, BookOpen, ShieldCheck, Send, DownloadCloud, Lock
} from 'lucide-react';
import { IconButton, Tooltip, Switch, FormControlLabel } from "@mui/material";

export interface TrackerNode {
  _id: string;
  title: string;
  parentId: string | null;
  course: string;
  level: number;
  order: number;
  isCustom: boolean;
  children?: TrackerNode[];
}

const SyllabusExplorer = ({ userData }: { userData: any }) => {
  const { username: routeUsername } = useParams<{ username: string }>();
  const navigate = useNavigate();
  
  // 🚨 SMART AUTHENTICATION ROLES
  const token = localStorage.getItem("jwtoken");
  const myUsername = localStorage.getItem("Username") || localStorage.getItem("username");
  const isLoggedIn = !!token && !!myUsername;

  const [isScanningAI, setIsScanningAI] = useState(false);
  const [aiScanStatus, setAiScanStatus] = useState(""); // To show "Analyzing images...", "Building tree...", etc.

  // 🚨 FIXED: Make targetUsername a State so we can click between students!
  const [targetUsername, setTargetUsername] = useState(routeUsername || myUsername);
  
  // Keep it synced if the URL changes
  useEffect(() => {
    setTargetUsername(routeUsername || myUsername);
  }, [routeUsername, myUsername]);

  const isOwner = myUsername === targetUsername;
  
  const isAdmin = userData?.isAdmin;
  const isTeacher = userData?.Role === "Teacher";
  const isStrictAdmin = isAdmin && !isTeacher; 
  const isHybridAdmin = isAdmin && isTeacher;  

  // --- STATE ---
  const [userNodes, setUserNodes] = useState<TrackerNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [activeView, setActiveView] = useState<'path' | 'preview' | 'global_builder'>(isStrictAdmin ? 'global_builder' : 'path');
  const [isGlobalMode, setIsGlobalMode] = useState(isStrictAdmin); 
  
  const [previewCourse, setPreviewCourse] = useState<string | null>(null);
  const [globalCourses, setGlobalCourses] = useState<string[]>([]);
  const [previewNodes, setPreviewNodes] = useState<TrackerNode[]>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false); 
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingNodeTitle, setEditingNodeTitle] = useState("");

  const [addingTo, setAddingTo] = useState<{ parentId: string | null, course: string } | null>(null);
  const [newCourseName, setNewCourseName] = useState("");
  const [isCreatingCourse, setIsCreatingCourse] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  
  // 🚨 MULTI-SELECT STUDENT PUSH STATES
  const [showPushModal, setShowPushModal] = useState<{ isOpen: boolean, courseName: string }>({ isOpen: false, courseName: "" });
  const [teacherStudents, setTeacherStudents] = useState<any[]>([]);
  const [pushSearchQuery, setPushSearchQuery] = useState("");
  const [showPushDropdown, setShowPushDropdown] = useState(false);
  const [selectedPushTargets, setSelectedPushTargets] = useState<any[]>([]);

  const [showCSVModal, setShowCSVModal] = useState(false);
  const [csvParsedData, setCsvParsedData] = useState<{subjectName: string; tree: any[]}[]>([]);
  const [csvTargetCourse, setCsvTargetCourse] = useState("");
  const [isUploadingCSV, setIsUploadingCSV] = useState(false);

  const [cloudLink, setCloudLink] = useState("");
  const [isFetchingLink, setIsFetchingLink] = useState(false);

  const [expandedNodes, setExpandedNodes] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  const processSpreadsheetData = async (file: File | Blob, fileName: string) => {
  const reader = new FileReader();
  
  reader.onload = async (e) => {
    const XLSX = await import('xlsx');
    const data = new Uint8Array(e.target?.result as ArrayBuffer);
    const workbook = XLSX.read(data, { type: 'array' });
    
    const allParsedSubjects: {subjectName: string; tree: any[]}[] = [];

    // 🚨 NEW: Loop through every single tab in the Excel file!
    for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];
        
        const tree: any[] = [];
        let currentChapter: any = null;
        let currentTopic: any = null;
        let currentSubTopic: any = null;

        for (let i = 1; i < rows.length; i++) {
          const cols = rows[i];
          if (!cols || cols.length === 0) continue;

          const chapterName = cols[1]?.toString().trim();
          const topicName = cols[2]?.toString().trim();
          const subTopicName = cols[3]?.toString().trim();
          const subSubTopicName = cols[4]?.toString().trim();

          if (chapterName && chapterName.toLowerCase().includes('book') && !topicName) continue; 

          if (chapterName) {
              currentChapter = { title: chapterName, children: [] };
              tree.push(currentChapter);
              currentTopic = null; currentSubTopic = null;
          }
          if (topicName) {
              currentTopic = { title: topicName, children: [] };
              if (currentChapter) currentChapter.children.push(currentTopic);
              currentSubTopic = null;
          }
          if (subTopicName) {
              currentSubTopic = { title: subTopicName, children: [] };
              if (currentTopic) currentTopic.children.push(currentSubTopic);
          }
          if (subSubTopicName) {
              const subSub = { title: subSubTopicName, children: [] };
              if (currentSubTopic) currentSubTopic.children.push(subSub);
          }
        }
        
        // Only add this sheet to our payload if it actually had syllabus data inside it
        if (tree.length > 0) {
            allParsedSubjects.push({ subjectName: sheetName, tree: tree });
        }
    }

    // Edge Case: If it's just a generic 1-page CSV and the tab is called "Sheet1", use the file name
    if (allParsedSubjects.length === 1 && allParsedSubjects[0].subjectName === "Sheet1") {
       let detectedSubject = fileName.replace(/\.(csv|xlsx|xls)$/i, '');
       if (detectedSubject.includes(' - ')) {
          const parts = detectedSubject.split(' - ');
          detectedSubject = parts[parts.length - 1]; 
       } else if (fileName !== "Google_Sheet.xlsx" && fileName !== "OneDrive_Document.xlsx") {
          detectedSubject = fileName;
       }
       allParsedSubjects[0].subjectName = detectedSubject.trim() || "Unknown Subject";
    }

    setCsvParsedData(allParsedSubjects);
  };
  
  reader.readAsArrayBuffer(file);
};  

  // 🚨 HANDLER 1: Local File Drop
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processSpreadsheetData(file, file.name);
  };

  // 🚨 HANDLER 2: Cloud Link Fetcher
  const handleLinkProcess = async () => {
    if (!cloudLink.trim()) return;
    setIsFetchingLink(true);

    try {
      let fetchUrl = cloudLink;
      let fakeFileName = "Cloud_Document";

      // 1. Google Sheets Interceptor
      const gsMatch = cloudLink.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (gsMatch) {
        // Force Google to return a raw Excel file instead of the HTML webpage
        fetchUrl = `https://docs.google.com/spreadsheets/export?id=${gsMatch[1]}&exportFormat=xlsx`;
        fakeFileName = "Google_Sheet.xlsx";
      } 
      // 2. OneDrive/SharePoint Interceptor
      else if (cloudLink.includes('sharepoint.com') || cloudLink.includes('onedrive.live.com')) {
        // Append download flag to force raw file
        fetchUrl = cloudLink.includes('?') ? `${cloudLink}&download=1` : `${cloudLink}?download=1`;
        fakeFileName = "OneDrive_Document.xlsx";
      }

      const res = await fetch(fetchUrl);
      if (!res.ok) throw new Error("Could not access file");
      
      const blob = await res.blob();
      processSpreadsheetData(blob, fakeFileName);

    } catch (err) {
      alert("Could not fetch the cloud document. Make sure the link's privacy is set to 'Anyone with the link can view', or download it and upload the file directly!");
    } finally {
      setIsFetchingLink(false);
    }
  };

  const handleConfirmCSVUpload = async () => {
    if (!csvTargetCourse || csvParsedData.length === 0) return;
    setIsUploadingCSV(true);

    const token = localStorage.getItem("jwtoken");
    const endpoint = isGlobalMode ? 'nodes/master' : 'nodes';
    const username = isGlobalMode ? 'admin' : targetUsername;

    try {
        for (const subjectData of csvParsedData) {
            console.log(`🚀 Starting Subject: ${subjectData.subjectName}`);
            
            // 1. Create the Root Subject
            const rootRes = await fetch(`${import.meta.env.VITE_API}dashboard/tracker/${endpoint}`, {
                method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ title: subjectData.subjectName, parentId: null, course: csvTargetCourse, username })
            });
            const rootNode = await rootRes.json();

            // 2. Upload the tree
            const uploadTree = async (nodes: any[], parentId: string) => {
                for (const node of nodes) {
                    console.log(`⏳ Saving: ${node.title}...`); // <-- THIS SHOWS PROGRESS
                    
                    const res = await fetch(`${import.meta.env.VITE_API}dashboard/tracker/${endpoint}`, {
                        method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                        body: JSON.stringify({ title: node.title, parentId, course: csvTargetCourse, username })
                    });
                    const savedNode = await res.json();
                    
                    if (node.children && node.children.length > 0) {
                        await uploadTree(node.children, savedNode._id);
                    }
                }
            };

            await uploadTree(subjectData.tree, rootNode._id);
            console.log(`✅ Finished Subject: ${subjectData.subjectName}`);
        }

        showToast("Multi-Subject Syllabus Uploaded Successfully!");
        // ... rest of your success logic

    } catch (error) {
        console.error("🔥 FATAL UPLOAD ERROR:", error); // <-- THIS CATCHES SILENT FAILURES
        showToast("Error during bulk upload", "error");
    } finally {
        setIsUploadingCSV(false);
    }
  };

  const handleAIUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsScanningAI(true);
    setAiScanStatus("Uploading images to secure server...");

    try {
      // 1. Convert files to Base64 (but just the raw data string)
      const base64Images = await Promise.all(
        Array.from(files).map(async (file) => {
          return new Promise<{mimeType: string, data: string}>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64Data = (reader.result as string).split(',')[1];
              resolve({
                mimeType: file.type,
                data: base64Data
              });
            };
            reader.readAsDataURL(file);
          });
        })
      );

      setAiScanStatus("AI is reading the syllabus... this takes a few seconds.");
      
      // 2. Send the images to YOUR backend, safely hiding the API key
      const token = localStorage.getItem("jwtoken");
      const res = await fetch(`${import.meta.env.VITE_API}api/extract-syllabus`, {
        method: "POST",
        headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}` // Secure it so only logged-in teachers can use your AI
        },
        body: JSON.stringify({ images: base64Images })
      });

      if (!res.ok) throw new Error("Backend failed to process AI request");

      const parsedData = await res.json();
      
      // 3. Feed it into our existing review state
      setCsvParsedData(parsedData);
      showToast("AI Extraction Successful! Please review the syllabus.");

    } catch (error) {
      console.error("AI Scan Failed:", error);
      showToast("Failed to read the images. Please ensure they are clear pictures of the index.", "error");
    } finally {
      setIsScanningAI(false);
      setAiScanStatus("");
      e.target.value = ''; 
    }
  };

  // 🚨 EARLY RETURN: IF NOT LOGGED IN
  if (!isLoggedIn) {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center bg-slate-50 p-6 font-body">
        <div className="bg-white p-8 md:p-10 rounded-4xl shadow-2xl max-w-md w-full text-center border border-gray-100 animate-in zoom-in-95 duration-300">
          <div className="w-20 h-20 bg-blue-50 text-brand-blue rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock size={32} strokeWidth={2.5} />
          </div>
          <h2 className="text-2xl font-black text-slate-800 mb-3">Sign in to continue</h2>
          <p className="text-sm text-gray-500 mb-8 leading-relaxed">
            {routeUsername 
              ? `You need an account to view and import ${routeUsername}'s learning path into your own tracker.` 
              : 'Please log in to build, share, and explore community syllabus trackers.'}
          </p>
          <button onClick={() => navigate('/login')} className="w-full bg-brand-blue text-white font-black py-4 rounded-xl shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-95 transition-all">
            Log In or Sign Up
          </button>
        </div>
      </div>
    );
  }

  const handleExportCourse = async (courseName: string, nodes: any[], format: 'xlsx' | 'csv') => {
    setIsProcessing(true);
    try {
      if (format === 'xlsx') {
        const ExcelJS = await import('exceljs');
        const wb = new ExcelJS.Workbook();
        wb.creator = 'Syllabus Tracker';

        // Loop through each Subject to create separate tabs
        for (const subject of nodes) {
          const safeSheetName = subject.title.replace(/[\\/*?:[\]]/g, '').substring(0, 31) || "Subject";
          const ws = wb.addWorksheet(safeSheetName);
          
          // 1. Setup Exact Column Widths
          ws.columns = [
            { header: 'S.No', key: 'sno', width: 8 },
            { header: 'Chapter Name', key: 'chapter', width: 45 },
            { header: 'Topic Name', key: 'topic', width: 40 },
            { header: 'Sub-Topic Name', key: 'subtopic', width: 35 },
            { header: 'Sub-Sub-Topic Name', key: 'subsubtopic', width: 35 }
          ];

          // 2. Style the Header Row
          const headerRow = ws.getRow(1);
          headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
          headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }; 
          headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
          headerRow.height = 30;

          let serial = 1;
          let currentRow = 2; // Data starts on row 2

          // 3. 🚨 THE VERTICAL MERGE ENGINE 🚨
          const drawNode = (node: any, depth: number, currentSNo: number | null) => {
             const startRow = currentRow;
             const row = ws.getRow(startRow);

             // Write the title in the correct column based on depth
             if (depth === 1) {
                 row.getCell(1).value = currentSNo;
                 row.getCell(2).value = node.title;
                 // Add subtle background color to Chapter cells
                 row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                 row.getCell(2).font = { bold: true, color: { argb: 'FF0284C7' } };
             } 
             else if (depth === 2) row.getCell(3).value = node.title;
             else if (depth === 3) row.getCell(4).value = node.title;
             else if (depth >= 4) row.getCell(5).value = node.title;

             // If it has children, recurse down WITHOUT advancing the row yet
             if (node.children && node.children.length > 0) {
                 for (const child of node.children) {
                     drawNode(child, depth + 1, currentSNo);
                 }
             } else {
                 // It's a leaf node (end of the line), so NOW we advance to the next row!
                 currentRow++;
             }

             // Now that children are drawn, merge the parent cell vertically down to the currentRow!
             const endRow = currentRow - 1;
             if (endRow > startRow) {
                 if (depth === 1) {
                     ws.mergeCells(startRow, 1, endRow, 1); // Merge S.No
                     ws.mergeCells(startRow, 2, endRow, 2); // Merge Chapter Name
                 } 
                 else if (depth === 2) ws.mergeCells(startRow, 3, endRow, 3); // Merge Topic
                 else if (depth === 3) ws.mergeCells(startRow, 4, endRow, 4); // Merge Sub-topic
                 else if (depth >= 4) ws.mergeCells(startRow, 5, endRow, 5);
             }
          };

          // Execute the engine for this subject
          if (subject.children) {
              for (const chapter of subject.children) {
                  drawNode(chapter, 1, serial++);
              }
          }

          // 4. Paint Borders & Alignment over the generated grid
          for (let r = 1; r < currentRow; r++) {
            const row = ws.getRow(r);
            for (let c = 1; c <= 5; c++) {
              const cell = row.getCell(c);
              cell.border = {
                top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
              };
              if (r > 1) {
                  cell.alignment = { 
                      vertical: 'middle', 
                      horizontal: c === 1 ? 'center' : 'left', 
                      wrapText: true 
                  };
              }
            }
          }
        }

        // Trigger Download
        const buffer = await wb.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${courseName}_Master_Syllabus.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast(`Exported ${courseName} with formatting!`);
      } 
      else if (format === 'csv') {
        // ... (Keep your existing CSV logic here if needed, though Excel is now the star!)
        showToast("CSV export triggered!");
      }
    } catch (error) {
      console.error("Export failed:", error);
      showToast("Failed to export syllabus", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  // --- RECURSIVE HELPERS ---
  const getDescendantIds = (node: any): string[] => {
    let ids: string[] = [];
    if (node.children) {
      node.children.forEach((child: any) => {
        ids.push(child._id);
        ids = ids.concat(getDescendantIds(child));
      });
    }
    return ids;
  };

  const handleExpandSpecificNode = (node: TrackerNode) => {
    const descendantIds = getDescendantIds(node);
    setExpandedNodes(prev => Array.from(new Set([...prev, node._id, ...descendantIds])));
  };

  const handleCollapseSpecificNode = (node: TrackerNode) => {
    const descendantIds = getDescendantIds(node);
    setExpandedNodes(prev => prev.filter(id => id !== node._id && !descendantIds.includes(id)));
  };

  const buildTree = (nodes: TrackerNode[]) => {
    const nodesMap = new Map<string, any>();
    const roots: any[] = [];
    nodes.forEach(node => nodesMap.set(node._id, { ...node, children: [] }));
    nodesMap.forEach(node => {
      if (node.parentId && nodesMap.has(node.parentId)) {
        nodesMap.get(node.parentId).children.push(node);
      } else { roots.push(node); }
    });
    const recursiveSort = (arr: any[]) => {
      arr.sort((a, b) => a.order - b.order);
      arr.forEach(item => recursiveSort(item.children));
    };
    recursiveSort(roots);
    return roots;
  };

  // --- API CALLS ---
  const fetchUserNodes = async () => {
    setIsLoading(true);
    try {
      const url = `${import.meta.env.VITE_API}dashboard/tracker/nodes?username=${targetUsername}`; 
      const data = await fetchWithCache(url, { "Authorization": `Bearer ${token}` }, true);
      setUserNodes(Array.isArray(data) ? data : []);
    } catch (err) { setUserNodes([]); } finally { setIsLoading(false); }
  };

  const fetchGlobalCourses = async () => {
    fetch(`${import.meta.env.VITE_API}dashboard/tracker/available-courses`, {
      headers: { "Authorization": `Bearer ${token}` }
    })
      .then(res => res.ok ? res.json() : [])
      .then(data => setGlobalCourses(data));
  };

  // 🚨 FETCH STUDENTS FOR TEACHER PUSH MODAL
  useEffect(() => {
    if (isTeacher && myUsername) {
      const fetchStudents = async () => {
        try {
          const res = await fetch(`${import.meta.env.VITE_API}my-students/${myUsername}`, {
            headers: { "Authorization": `Bearer ${token}` }
          });
          if (res.ok) setTeacherStudents(await res.json());
        } catch (e) { console.error(e); }
      };
      fetchStudents();
    }
  }, [isTeacher, myUsername, token]);

  useEffect(() => {
    if (!isStrictAdmin) fetchUserNodes();
    fetchGlobalCourses();
  }, [targetUsername, isStrictAdmin]);

  useEffect(() => {
    if ((activeView === 'preview' || activeView === 'global_builder') && previewCourse) {
      setIsLoadingPreview(true);
      fetch(`${import.meta.env.VITE_API}dashboard/tracker/blueprint?course=${encodeURIComponent(previewCourse)}`, {
        headers: { "Authorization": `Bearer ${token}` } 
      })
        .then(res => res.ok ? res.json() : [])
        .then(data => setPreviewNodes(data))
        .finally(() => setIsLoadingPreview(false));
    }
  }, [activeView, previewCourse]);

  // --- MEMOS ---
  const courseTrees = useMemo(() => {
    const filtered = searchQuery.trim() 
      ? userNodes.filter(n => n.title.toLowerCase().includes(searchQuery.toLowerCase()))
      : userNodes;
    const groups: Record<string, any[]> = {};
    filtered.forEach(node => {
      if (!groups[node.course]) groups[node.course] = [];
      groups[node.course].push(node);
    });
    const finalTrees: Record<string, any[]> = {};
    Object.keys(groups).forEach(course => finalTrees[course] = buildTree(groups[course]));
    return finalTrees;
  }, [userNodes, searchQuery]);

  const previewTree = useMemo(() => buildTree(previewNodes), [previewNodes]);

  // --- ACTIONS ---
  const handleAddNode = async (parentId: string | null, courseName: string, explicitTitle?: string) => {
    const finalTitle = explicitTitle !== undefined ? explicitTitle : newItemName;
    if (!finalTitle.trim() || !courseName.trim()) return;
    setIsProcessing(true);
    try {
      const endpoint = isGlobalMode ? 'nodes/master' : 'nodes'; 
      const res = await fetch(`${import.meta.env.VITE_API}dashboard/tracker/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ 
          title: finalTitle.trim(), 
          parentId, 
          course: courseName.trim(),
          username: isGlobalMode ? 'admin' : targetUsername 
        })
      });
      if (res.ok) {
        setNewItemName(""); setAddingTo(null); setIsCreatingCourse(false); 
        if (isGlobalMode) {
            if (!previewCourse) setPreviewCourse(courseName); 
            else fetchGlobalCourses(); 
        } else {
            fetchUserNodes();
        }
        showToast("Added successfully");
      }
    } catch (err) { showToast("Error adding", "error"); }
    finally { setIsProcessing(false); }
  };
  const handleEditNode = async (nodeId: string) => {
    if (!editingNodeTitle.trim()) return;
    setIsProcessing(true);
    
    try {
      const endpoint = isGlobalMode ? 'nodes/master' : 'nodes';
      // Assuming your backend uses a PUT request to update a node by ID
      const res = await fetch(`${import.meta.env.VITE_API}dashboard/tracker/${endpoint}/${nodeId}?username=${isGlobalMode ? 'admin' : targetUsername}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ 
          title: editingNodeTitle.trim(),
          username: isGlobalMode ? 'admin' : targetUsername 
        })
      });

      if (res.ok) {
        setEditingNodeId(null);
        setEditingNodeTitle("");
        
        // Update the UI instantly
        if (isGlobalMode) {
           setPreviewNodes(prev => prev.map(n => n._id === nodeId ? { ...n, title: editingNodeTitle.trim() } : n));
        } else {
           fetchUserNodes();
        }
        showToast("Renamed successfully!");
      } else {
        showToast("Failed to rename node", "error");
      }
    } catch (err) { 
      showToast("Error renaming node", "error"); 
    } finally { 
      setIsProcessing(false); 
    }
  };

  const handleShareCourse = (courseName: string) => {
    const url = `${window.location.origin}/edit-syllabus/${targetUsername}`;
    navigator.clipboard.writeText(url);
    showToast(`Link to ${courseName} copied!`);
  };

  const handleImportSharedCourse = async (courseName: string) => {
    setIsProcessing(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API}dashboard/tracker/clone-path`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ sourceUsername: targetUsername, targetUsernames: [myUsername], courseName })
      });
      if (res.ok) {
        showToast(`Imported ${courseName} to your tracker!`);
        setTimeout(() => navigate('/dashboard'), 1500);
      } else { showToast("Failed to import", "error"); }
    } catch (err) { showToast("Import failed", "error"); }
    finally { setIsProcessing(false); }
  };

  const handleSubscribeToGlobal = async (courseName: string) => {
    setIsProcessing(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API}dashboard/tracker/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ courseName, username: myUsername })
      });
      if (res.ok) {
        showToast(`Added ${courseName} to your tracker!`);
        setTimeout(() => navigate('/dashboard'), 1500);
      } else { showToast("Failed to subscribe", "error"); }
    } catch (err) { showToast("Subscription failed", "error"); }
    finally { setIsProcessing(false); }
  };

  const handlePushToStudent = async () => {
    if (selectedPushTargets.length === 0 || !showPushModal.courseName) return;
    setIsProcessing(true);
    try {
      const usernames = selectedPushTargets.map(u => u.username);
      const res = await fetch(`${import.meta.env.VITE_API}dashboard/tracker/clone-path`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ 
          sourceUsername: targetUsername, 
          targetUsernames: usernames, 
          courseName: showPushModal.courseName 
        })
      });

      if (res.ok) {
        showToast(`Syllabus pushed to ${usernames.length} student(s)!`);
        setShowPushModal({ isOpen: false, courseName: "" });
        setSelectedPushTargets([]);
      } else { showToast("Failed to push syllabus", "error"); }
    } catch (err) { showToast("Push failed", "error"); }
    finally { setIsProcessing(false); }
  };

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
  };

  // --- NODE RENDERER ---
  const renderNode = (node: any, index: number, siblings: any[], courseName: string, isPreview: boolean = false) => {
    const isExpanded = expandedNodes.includes(node._id);
    const hasChildren = node.children && node.children.length > 0;
    const canEdit = (!isPreview && (isOwner || isTeacher)) || (isPreview && isGlobalMode);
    const isEditingThis = editingNodeId === node._id;

    return (
      <div key={node._id} className="w-full">
        <div className="flex items-center justify-between py-2.5 pr-4 border-b border-gray-50 hover:bg-slate-50 transition group">
          <div className="flex items-center flex-1 min-w-0" style={{ paddingLeft: `${(node.level - 1) * 1.5}rem` }}>
            <div className="w-8 flex justify-center shrink-0">
              {hasChildren && !isEditingThis && (
                <button onClick={() => setExpandedNodes(prev => prev.includes(node._id) ? prev.filter(i => i !== node._id) : [...prev, node._id])} className="p-1 text-gray-400 hover:text-brand-blue rounded-md active:bg-gray-100">
                  {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </button>
              )}
            </div>
            
            {/* 🚨 THE INLINE EDITING INPUT 🚨 */}
            {isEditingThis ? (
              <div className="flex items-center gap-2 flex-1 mr-4 py-0.5">
                <input 
                  autoFocus 
                  value={editingNodeTitle} 
                  onChange={e => setEditingNodeTitle(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && handleEditNode(node._id)}
                  className="flex-1 bg-white border border-brand-blue rounded-lg px-3 py-1 text-sm font-bold outline-none shadow-sm" 
                />
                <button onClick={() => handleEditNode(node._id)} className="bg-green-500 text-white p-1.5 rounded-lg hover:bg-green-600 transition shadow-sm"><Check size={14} strokeWidth={3}/></button>
                <button onClick={() => setEditingNodeId(null)} className="bg-gray-100 text-gray-500 p-1.5 rounded-lg hover:bg-gray-200 transition shadow-sm"><X size={14} strokeWidth={3}/></button>
              </div>
            ) : (
              <span className={`text-sm ${hasChildren ? 'font-bold text-gray-700' : 'font-medium text-gray-500 pl-2'} truncate`}>
                {node.title}
              </span>
            )}
          </div>

          <div className={`flex items-center gap-1 transition-opacity ${isEditingThis ? 'hidden' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'}`}>
            {hasChildren && (
              <div className="flex items-center gap-1 mr-2 border-r border-gray-100 pr-2 shrink-0">
                <button onClick={() => handleExpandSpecificNode(node)} className="p-1 text-gray-400 hover:text-brand-blue bg-white rounded shadow-sm md:shadow-none md:bg-transparent" title="Expand Sub-topics"><Maximize2 size={14}/></button>
                <button onClick={() => handleCollapseSpecificNode(node)} className="p-1 text-gray-400 hover:text-brand-blue bg-white rounded shadow-sm md:shadow-none md:bg-transparent" title="Collapse Sub-topics"><Minimize2 size={14}/></button>
              </div>
            )}
            
            {canEdit && (
              <>
                <IconButton size="small" onClick={() => setAddingTo({ parentId: node._id, course: courseName })} className="text-brand-blue"><Plus size={16}/></IconButton>
                {/* 🚨 THE NEW EDIT BUTTON 🚨 */}
                <IconButton size="small" onClick={() => { setEditingNodeId(node._id); setEditingNodeTitle(node.title); }} className="text-brand-orange"><Edit2 size={14}/></IconButton>
                
                <IconButton size="small" onClick={() => { 
                  if(window.confirm(`Delete "${node.title}" and all its sub-topics?`)) {
                    const endpoint = isGlobalMode ? 'nodes/master' : 'nodes';
                    fetch(`${import.meta.env.VITE_API}dashboard/tracker/${endpoint}/${node._id}?username=${isGlobalMode ? 'admin' : targetUsername}`, { 
                      method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
                    }).then(() => isGlobalMode ? setPreviewNodes(prev => prev.filter(n => n._id !== node._id)) : fetchUserNodes()) 
                  }
                }} className="text-red-400"><Trash2 size={14}/></IconButton>
              </>
            )}
          </div>
        </div>

        {addingTo?.parentId === node._id && (
          <div className="flex items-center gap-2 py-2 pr-4 bg-blue-50/30" style={{ paddingLeft: `${node.level * 1.5}rem` }}>
            <input autoFocus value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="Sub-topic name..." className="flex-1 bg-white border border-blue-200 rounded-lg px-3 py-1.5 text-sm outline-none" />
            <button onClick={() => handleAddNode(node._id, courseName)} className="bg-brand-blue text-white p-1.5 rounded-lg"><Check size={16}/></button>
            <button onClick={() => setAddingTo(null)} className="text-gray-400"><X size={16}/></button>
          </div>
        )}

        {isExpanded && node.children && node.children.map((child: any, idx: number) => renderNode(child, idx, node.children, courseName, isPreview))}
      </div>
    );
  };

  return (
    // 🚨 THE FIX: Changed h-screen to h-full flex-1 min-h-0 to perfectly lock into your app layout without causing global scroll!
    <div 
      className="w-full flex bg-white overflow-hidden relative font-body"
      // 🚨 Change 75px to whatever the actual height of your top navbar is (usually 64px, 72px, or 80px)
      style={{ height: 'calc(100vh - 80px)' }} 
    >
      
      {/* --- SIDEBAR --- */}
      <div className={`absolute inset-y-0 left-0 z-50 bg-slate-50 flex flex-col transition-transform duration-300 md:relative md:translate-x-0 md:w-80 md:border-r border-gray-200 ${isMobileSidebarOpen ? 'translate-x-0 w-[85%]' : '-translate-x-full w-[85%]'}`}>
        <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-white shrink-0">
          <h2 className="font-black text-xl text-brand-blue flex items-center gap-2"><Globe size={24} /> Explorer</h2>
          <IconButton onClick={() => setIsMobileSidebarOpen(false)} className="md:hidden"><X size={20}/></IconButton>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
          {isStrictAdmin ? (
            <div className="bg-orange-50 text-brand-orange p-3.5 rounded-xl font-bold flex items-center gap-2 border border-brand-orange/20 shadow-sm">
              <ShieldCheck size={18}/> Global Master Catalog
            </div>
          ) : isHybridAdmin ? (
            <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm">
              <FormControlLabel
                control={<Switch checked={isGlobalMode} onChange={(e) => {
                  setIsGlobalMode(e.target.checked);
                  setActiveView(e.target.checked ? 'global_builder' : 'path');
                }} color="warning" />}
                label={<span className="text-xs font-black uppercase tracking-tighter text-slate-600">Global Catalog Mode</span>}
              />
            </div>
          ) : null}

          {/* REGULAR USER / STUDENT VIEW */}
          {!isStrictAdmin && !isTeacher && (
            <div className="space-y-2">
              <button onClick={() => { setActiveView('path'); setIsGlobalMode(false); setIsMobileSidebarOpen(false); setTargetUsername(myUsername); }} className={`w-full flex items-center gap-3 p-3 rounded-xl font-bold text-sm transition-all ${activeView === 'path' ? 'bg-brand-blue text-white shadow-lg' : 'bg-white border text-gray-700'}`}>
                <BookMarked size={18} /> {isOwner ? 'My Syllabus' : `${targetUsername.split('@')[0]}'s Syllabus`}
              </button>
            </div>
          )}

          {/* 👨‍🏫 TEACHER DASHBOARD: ACCORDION VIEW */}
          {isTeacher && (
            <div className="space-y-4">
              
              {/* Teacher's Personal Tracker */}
              <button 
                onClick={() => { setActiveView('path'); setIsGlobalMode(false); setTargetUsername(myUsername); setExpandedStudentId(null); setIsMobileSidebarOpen(false); }} 
                className={`w-full flex items-center gap-3 p-3 rounded-xl font-bold text-sm transition-all ${activeView === 'path' && targetUsername === myUsername && !isGlobalMode ? 'bg-brand-blue text-white shadow-lg' : 'bg-white border border-gray-100 text-gray-700 hover:border-gray-300'}`}
              >
                <BookMarked size={18} /> My Master Tracker
              </button>

              {/* Students Accordion List */}
              <div className="pt-2">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2 mb-3">My Students (Max 5)</p>
                <div className="space-y-2">
                  {teacherStudents.map((student) => {
                    const isExpanded = expandedStudentId === student.username;
                    const isActive = targetUsername === student.username && activeView === 'path';

                    return (
                      <div key={student.username} className={`border rounded-xl overflow-hidden bg-white transition-colors ${isActive ? 'border-brand-blue shadow-sm' : 'border-gray-100 hover:border-gray-300'}`}>
                        <button
                          onClick={() => {
                            // Toggle open/closed
                            setExpandedStudentId(isExpanded ? null : student.username);
                            // Instantly switch the main view to this student!
                            setTargetUsername(student.username);
                            setActiveView('path');
                            setIsGlobalMode(false);
                          }}
                          className={`w-full text-left p-3 transition-all duration-300 flex items-center justify-between ${
                            isActive ? 'bg-brand-blue text-white' : 'bg-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-3 truncate pr-2">
                            <div className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center font-black text-xs ${
                              isActive ? 'bg-white text-brand-blue' : 'bg-brand-blue/10 text-brand-blue'
                            }`}>
                              {(student.name || "S").charAt(0).toUpperCase()}
                            </div>
                            <div className="font-bold text-sm truncate">
                              {student.name || student.username}
                            </div>
                          </div>
                          <div className={`transform transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`}>
                            <ChevronDown size={16}/>
                          </div>
                        </button>

                        {/* Accordion Body: Shows a quick summary of courses they are taking */}
                        {isExpanded && (
                          <div className="p-3 bg-slate-50 border-t border-gray-100/50">
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 pl-1">
                              Assigned Courses
                            </div>
                            {isLoading ? (
                              <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-brand-blue"/></div>
                            ) : Object.keys(courseTrees).length > 0 ? (
                              <div className="space-y-1">
                                {Object.keys(courseTrees).map(courseName => (
                                  <div key={courseName} className="text-xs font-bold text-slate-700 py-1.5 px-2 bg-white rounded-lg border border-gray-100 shadow-sm flex items-center gap-2">
                                    <BookOpen size={12} className="text-brand-blue"/> <span className="truncate">{courseName}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-xs text-gray-400 italic pl-1">No syllabus tracked yet.</div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                  
                  {teacherStudents.length === 0 && (
                    <div className="text-xs text-center p-4 text-gray-400 border border-dashed rounded-xl">No students assigned yet.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="pt-4">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2 mb-3">Global Catalog</p>
            <div className="space-y-1.5">
              {globalCourses.map(course => (
                <button key={course} onClick={() => { 
                    setPreviewCourse(course); 
                    setActiveView(isGlobalMode ? 'global_builder' : 'preview'); 
                    setIsMobileSidebarOpen(false); 
                  }} 
                  className={`w-full flex items-center justify-between p-3 rounded-xl text-sm font-bold transition-all ${previewCourse === course && (activeView === 'preview' || activeView === 'global_builder') ? 'bg-slate-900 text-white' : 'bg-white border text-gray-600 hover:border-brand-blue'}`}
                >
                  <span className="truncate">{course}</span><ChevronRight size={14}/>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* --- MAIN CONTENT AREA --- */}
      <div className="flex-1 flex flex-col bg-white overflow-hidden relative">
        <div className="p-4 md:p-8 border-b border-gray-100 shrink-0">
          <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
            <button onClick={() => navigate(-1)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors self-start md:self-auto"><ArrowLeft size={20} /></button>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 leading-tight">
              {activeView === 'path' ? (isOwner ? 'Personal Path Builder' : `${targetUsername}'s Tracked Syllabus`) : 
               activeView === 'global_builder' ? 'Editing Global Catalog' : 
               `Previewing: ${previewCourse}`}
            </h1>
          </div>

          <div className="relative max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" placeholder="Search topics..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-transparent rounded-2xl focus:bg-white focus:border-brand-blue outline-none transition-all text-sm font-medium" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/30 custom-scrollbar pb-32">
          {isLoading || isLoadingPreview ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brand-orange" size={48}/></div> : (
            <div className="max-w-5xl mx-auto space-y-8">
              
              {activeView === 'path' && (
                Object.keys(courseTrees).length === 0 ? (
                  <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-4xl bg-white">
                    <BookOpen size={64} className="mx-auto text-gray-200 mb-4" />
                    <h2 className="text-xl font-bold text-gray-800">No Custom Syllabus Yet</h2>
                  </div>
                ) : (
                  Object.entries(courseTrees).map(([courseName, roots]) => (
                    <div key={courseName} className="animate-in fade-in slide-in-from-bottom-4">
                      
                      <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 px-2 gap-3">
                        <div className="flex items-center gap-2">
                           <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-brand-blue"><BookOpen size={18}/></div>
                           <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">{courseName}</h2>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* 🚨 NEW: Export Button Group 🚨 */}
                          <div className="flex items-center bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden mr-1">
                            <button onClick={() => handleExportCourse(courseName, roots, 'xlsx')} className="flex items-center gap-1.5 px-3 py-1.5 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-all border-r border-gray-100" title="Export as Excel">
                              <FileSpreadsheet size={14} className="text-emerald-600"/> Excel
                            </button>
                            <button onClick={() => handleExportCourse(courseName, roots, 'csv')} className="flex items-center gap-1.5 px-3 py-1.5 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-all" title="Export as CSV">
                              <FileText size={14} className="text-blue-500"/> CSV
                            </button>
                          </div>

                          <button onClick={() => handleShareCourse(courseName)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 transition-all shadow-sm">
                            <Share2 size={14}/> Share
                          </button>
                          
                          {(isTeacher || isAdmin) && (
                            <button onClick={() => setShowPushModal({ isOpen: true, courseName })} className="flex items-center gap-1.5 px-3 py-1.5 border-2 border-brand-blue text-brand-blue bg-blue-50 rounded-lg text-xs font-bold hover:bg-brand-blue hover:text-white transition-all shadow-sm">
                              <Send size={14}/> Push
                            </button>
                          )}

                          {!isOwner && (
                            <button onClick={() => handleImportSharedCourse(courseName)} className="bg-brand-orange text-white px-4 py-1.5 rounded-lg text-xs font-black shadow-md active:scale-95 transition-transform flex items-center gap-1.5">
                              <DownloadCloud size={14}/> Add to My Tracker
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="border border-gray-200 rounded-3xl overflow-hidden bg-white shadow-sm">
                        {roots.map((node, idx) => renderNode(node, idx, roots, courseName))}
                        {(isOwner || isTeacher) && (
                          <button onClick={() => setAddingTo({ parentId: null, course: courseName })} className="w-full py-4 text-xs font-black text-brand-blue hover:bg-blue-50/50 transition-colors border-t border-gray-100 flex items-center justify-center gap-2 uppercase tracking-widest">
                            <Plus size={14} strokeWidth={3}/> Add Root Subject to {courseName}
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )
              )}

              {(activeView === 'preview' || activeView === 'global_builder') && previewCourse && (
                <div className="border border-gray-200 rounded-3xl overflow-hidden bg-white shadow-sm animate-in fade-in">
                   <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                     <span className="font-bold text-sm uppercase tracking-widest flex items-center gap-2">
                        {isGlobalMode ? <ShieldCheck size={18} className="text-orange-500"/> : <Globe size={18}/>}
                        {previewCourse}
                     </span>
                     {!isGlobalMode && (
                        <button onClick={() => handleSubscribeToGlobal(previewCourse!)} className="bg-brand-orange px-4 py-1.5 rounded-lg text-xs font-black hover:scale-105 transition-transform flex items-center gap-1">
                          <DownloadCloud size={14}/> ADD TO MY TRACKER
                        </button>
                     )}
                   </div>
                   {previewTree.map((node, idx) => renderNode(node, idx, previewTree, previewCourse!, !isGlobalMode))}
                   
                   {isGlobalMode && (
                      <button onClick={() => setAddingTo({ parentId: null, course: previewCourse! })} className="w-full py-4 text-xs font-black text-brand-orange hover:bg-orange-50/50 transition-colors border-t border-gray-100 flex items-center justify-center gap-2 uppercase tracking-widest">
                        <Plus size={14} strokeWidth={3}/> Add Master Subject to {previewCourse}
                      </button>
                   )}
                </div>
              )}

              {(isOwner || isGlobalMode || isTeacher) && (activeView === 'path' || activeView === 'global_builder') && (
                <div className="border-2 border-dashed border-gray-200 rounded-4xl p-10 text-center bg-white/50 hover:bg-white transition-all mt-12">
                  {isCreatingCourse ? (
                    <div className="max-w-sm mx-auto space-y-3 animate-in zoom-in-95 duration-200">
                      <input autoFocus value={newCourseName} onChange={e => setNewCourseName(e.target.value)} placeholder="Course Name (e.g., JEE Mains)" className="w-full border-2 border-gray-100 rounded-2xl px-5 py-3 outline-none focus:border-brand-blue font-bold" />
                      <input value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="First Subject (e.g., Physics)" className="w-full border-2 border-gray-100 rounded-2xl px-5 py-3 outline-none focus:border-brand-blue font-bold" />
                      <div className="flex gap-2 pt-2">
                        <button onClick={() => handleAddNode(null, newCourseName, newItemName)} disabled={!newCourseName.trim() || !newItemName.trim() || isProcessing} className="flex-1 bg-slate-900 text-white py-3.5 rounded-2xl font-black shadow-lg disabled:opacity-30">CREATE</button>
                        <button onClick={() => setIsCreatingCourse(false)} className="px-5 py-3.5 bg-gray-100 text-gray-500 rounded-2xl font-bold hover:bg-gray-200 transition-colors">CANCEL</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16">
                      {/* Option 1: Manual Creation */}
                      <button onClick={() => setIsCreatingCourse(true)} className="flex flex-col items-center gap-3 group">
                        <div className="p-5 bg-brand-blue/5 text-brand-blue rounded-full group-hover:scale-110 group-hover:bg-brand-blue group-hover:text-white transition-all duration-300 shadow-sm">
                          <Plus size={40}/>
                        </div>
                        <span className="text-slate-900 font-black text-lg">Create New {isGlobalMode ? 'Master Catalog' : 'Course Group'}</span>
                      </button>

                      {/* Option 2: CSV Upload */}
                      <button onClick={() => setShowCSVModal(true)} className="flex flex-col items-center gap-3 group">
                        <div className="p-5 bg-green-50 text-green-600 rounded-full group-hover:scale-110 group-hover:bg-green-500 group-hover:text-white transition-all duration-300 shadow-sm">
                          <DownloadCloud size={40}/>
                        </div>
                        <span className="text-slate-900 font-black text-lg">Import from Spreadsheet</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* PUSH TO STUDENT MODAL */}
      {showPushModal.isOpen && (
        <div className="fixed inset-0 z-1000 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-visible shadow-2xl animate-in zoom-in-95 duration-200 p-6 text-center">
            <div className="w-16 h-16 bg-blue-50 text-brand-blue rounded-full flex items-center justify-center mx-auto mb-4"><Send size={24}/></div>
            <h3 className="text-xl font-black text-slate-800 mb-2">Push Syllabus</h3>
            <p className="text-sm text-gray-500 mb-6">Search and select students to copy <b>{showPushModal.courseName}</b> directly into their trackers.</p>
            
            <div className="relative text-left mb-4 z-50">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                autoFocus 
                type="text" 
                placeholder="Search student name or @username..." 
                value={pushSearchQuery} 
                onChange={(e) => { setPushSearchQuery(e.target.value); setShowPushDropdown(true); }} 
                onFocus={() => setShowPushDropdown(true)}
                onBlur={() => setTimeout(() => setShowPushDropdown(false), 200)}
                className="w-full border-2 border-gray-100 rounded-2xl pl-12 pr-4 py-3 outline-none focus:border-brand-blue font-bold text-sm transition-colors" 
              />
              
              {showPushDropdown && pushSearchQuery.trim() !== "" && (
                <div className="absolute w-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-2xl max-h-56 overflow-y-auto custom-scrollbar p-1.5 animate-in fade-in slide-in-from-top-2">
                  {teacherStudents.filter(s => 
                    !selectedPushTargets.some(st => st.username === s.username) && 
                    (s.name?.toLowerCase().includes(pushSearchQuery.toLowerCase()) || 
                     s.username?.toLowerCase().includes(pushSearchQuery.toLowerCase()))
                  ).length === 0 ? (
                    <div className="p-4 text-center text-xs text-gray-400 font-medium">No students found matching "{pushSearchQuery}"</div>
                  ) : (
                    teacherStudents.filter(s => 
                      !selectedPushTargets.some(st => st.username === s.username) && 
                      (s.name?.toLowerCase().includes(pushSearchQuery.toLowerCase()) || 
                       s.username?.toLowerCase().includes(pushSearchQuery.toLowerCase()))
                    ).map(student => (
                      <div 
                        key={student._id || student.username} 
                        onMouseDown={(e) => { 
                          e.preventDefault(); 
                          setSelectedPushTargets([...selectedPushTargets, student]); 
                          setPushSearchQuery(""); 
                          setShowPushDropdown(false); 
                        }} 
                        className="flex items-center gap-3 p-2.5 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors group"
                      >
                        {student.photo ? (
                          <img src={student.photo} alt={student.name} className="w-8 h-8 rounded-full object-cover shadow-sm border border-slate-200 shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-brand-blue/10 text-brand-blue flex items-center justify-center font-bold text-xs shrink-0 shadow-inner">
                            {(student.name || "S").charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex flex-col text-left">
                          <span className="text-sm font-bold text-gray-800 leading-tight">{student.name}</span>
                          <span className="text-[10px] font-medium text-gray-400">@{student.username}</span>
                        </div>
                        <div className="ml-auto w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-brand-blue group-hover:text-white transition-all shrink-0">
                          <Plus size={12} strokeWidth={3} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 mb-6 min-h-9 justify-center bg-slate-50 p-3 rounded-2xl border border-dashed border-gray-200">
              {selectedPushTargets.length === 0 && (
                <span className="text-xs text-slate-400 italic mt-1 font-medium">Select students from above</span>
              )}
              {selectedPushTargets.map(user => (
                <span key={user.username} className="bg-white text-slate-700 pl-1.5 pr-2 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 border border-slate-200 shadow-sm animate-in zoom-in duration-200">
                  {user.photo ? (
                    <img src={user.photo} alt={user.name} className="w-5 h-5 rounded-full object-cover" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-brand-blue/10 text-brand-blue flex items-center justify-center text-[9px] shrink-0">
                      {(user.name || "S").charAt(0).toUpperCase()}
                    </div>
                  )}
                  {(user.name || user.username).split(' ')[0]}
                  <button 
                    type="button" 
                    onClick={() => setSelectedPushTargets(selectedPushTargets.filter(x => x.username !== user.username))} 
                    className="w-4 h-4 flex items-center justify-center bg-slate-100 rounded-full hover:bg-rose-500 hover:text-white text-slate-400 transition-colors ml-1"
                  >
                    <X size={10} strokeWidth={3} />
                  </button>
                </span>
              ))}
            </div>

            <div className="flex gap-2">
              <button onClick={() => { setShowPushModal({ isOpen: false, courseName: "" }); setSelectedPushTargets([]); setPushSearchQuery(""); }} className="flex-1 py-3.5 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition">Cancel</button>
              <button onClick={handlePushToStudent} disabled={isProcessing || selectedPushTargets.length === 0} className="flex-2 py-3.5 bg-brand-blue text-white rounded-xl font-black shadow-lg shadow-blue-500/20 disabled:opacity-50 flex justify-center items-center transition-all active:scale-95">
                {isProcessing ? <Loader2 size={18} className="animate-spin" /> : `Push to ${selectedPushTargets.length} Student${selectedPushTargets.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE TRIGGER */}
      {!isMobileSidebarOpen && (
        <button onClick={() => setIsMobileSidebarOpen(true)} className="md:hidden fixed bottom-6 left-6 z-40 bg-slate-900 text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center active:scale-95 transition-transform">
          <Globe size={24} />
        </button>
      )}

      {/* TOAST */}
      {toast.show && (
        <div className={`fixed bottom-10 left-1/2 -translate-x-1/2 z-100 animate-in slide-in-from-bottom-5 flex items-center gap-2 px-6 py-3.5 rounded-full shadow-2xl font-bold text-sm ${toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-rose-600 text-white'}`}>
          {toast.type === 'success' ? <Check size={18} /> : <X size={18} />} {toast.message}
        </div>
      )}
 {/* 🚨 CSV IMPORT MODAL */}
      {showCSVModal && (
        <div className="fixed inset-0 z-1000 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><DownloadCloud className="text-brand-blue"/> Bulk Import Syllabus</h3>
              {/* FIXED: setCsvParsedData instead of setCsvParsedTree */}
              <button onClick={() => { setShowCSVModal(false); setCsvParsedData([]); }} className="hover:bg-gray-200 p-2 rounded-full transition"><X size={20}/></button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
  
              {/* 🚨 MOVED: This input now sits OUTSIDE the if/else block so it never disappears! */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-700 mb-2">Target Course / Batch Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. JEE Mains 2026" 
                  value={csvTargetCourse} 
                  onChange={e => setCsvTargetCourse(e.target.value)} 
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-brand-blue" 
                />
              </div>

              {csvParsedData.length === 0 ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 text-sm text-brand-blue font-medium">
                    Upload an Excel file <b>(.xlsx, .xls)</b>, a <b>.csv</b>, or paste a public <b>Google Sheets / OneDrive</b> link!
                  </div>
                  
                  {/* Cloud Link Input */}
                  <div className="flex gap-2">
                    <input type="text" placeholder="Paste Google Sheets or Excel Share Link..." value={cloudLink} onChange={e => setCloudLink(e.target.value)} className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-3 font-medium outline-none focus:border-brand-blue text-sm" />
                    <button onClick={handleLinkProcess} disabled={isFetchingLink || !cloudLink} className="bg-slate-900 text-white px-6 rounded-xl font-bold hover:bg-brand-blue transition-colors disabled:opacity-50">
                      {isFetchingLink ? "Fetching..." : "Fetch"}
                    </button>
                  </div>

                  <div className="flex items-center gap-4 my-2">
                    <div className="h-px bg-gray-200 flex-1"></div>
                    <span className="text-xs font-black text-gray-400 uppercase tracking-widest">OR</span>
                    <div className="h-px bg-gray-200 flex-1"></div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                    
                    {/* Option 1: The Traditional Excel/CSV Upload */}
                    <div className="border-2 border-dashed border-gray-300 rounded-2xl p-6 text-center hover:border-green-500 hover:bg-green-50 transition-colors relative cursor-pointer bg-slate-50 group">
                      <input type="file" accept=".csv, .xlsx, .xls" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                      <FileSpreadsheet size={32} className="mx-auto text-gray-400 mb-3 group-hover:text-green-500 transition-colors"/>
                      <h4 className="font-black text-gray-700 mb-1">Standard Import</h4>
                      <p className="text-xs text-gray-500 font-medium">Upload Excel or CSV files</p>
                    </div>

                    {/* Option 2: The Magic AI Scanner */}
                    <div className={`border-2 border-dashed rounded-2xl p-6 text-center relative overflow-hidden transition-colors ${isScanningAI ? 'border-brand-blue bg-blue-50' : 'border-gray-300 bg-slate-50 hover:border-brand-blue hover:bg-blue-50 cursor-pointer group'}`}>
                      
                      {isScanningAI ? (
                        <div className="flex flex-col items-center justify-center h-full relative z-20">
                          <Loader2 size={32} className="text-brand-blue animate-spin mb-3"/>
                          <h4 className="font-black text-brand-blue mb-1">AI Processing...</h4>
                          <p className="text-xs text-blue-600 font-bold animate-pulse">{aiScanStatus}</p>
                        </div>
                      ) : (
                        <>
                          {/* Allow multiple image uploads at once! */}
                          <input type="file" accept="image/png, image/jpeg, image/webp" multiple onChange={handleAIUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                          <Camera size={32} className="mx-auto text-gray-400 mb-3 group-hover:text-brand-blue transition-colors"/>
                          <h4 className="font-black text-gray-700 mb-1">Magic AI Scanner</h4>
                          <p className="text-xs text-gray-500 font-medium">Take photos of the book's Index</p>
                        </>
                      )}

                      {/* Cool animated background gradient for the AI scanner */}
                      {isScanningAI && <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/50 to-transparent w-[200%] animate-[shimmer_2s_infinite] -z-10"></div>}
                    </div>

                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-col gap-1 bg-green-50 text-green-700 px-4 py-3 rounded-xl border border-green-200 font-bold text-sm">
                      <div className="flex items-center justify-between">
                        <span>Found {csvParsedData.length} Subject(s) in File!</span>
                        <button onClick={() => setCsvParsedData([])} className="text-xs underline hover:text-green-900">Change File</button>
                      </div>
                      <span className="text-xs text-green-600">Subjects: {csvParsedData.map(s => s.subjectName).join(', ')}</span>
                  </div>
                  
                  {/* Multi-Subject Preview Box */}
                  <div className="border border-gray-200 rounded-xl p-4 bg-slate-50 h-100 overflow-y-auto text-sm font-medium text-gray-600 custom-scrollbar space-y-6">
                      {csvParsedData.map((subject, sIdx) => (
                        <div key={sIdx} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                            <div className="font-black text-brand-blue text-lg mb-3 border-b pb-2 uppercase tracking-wide">
                              📚 {subject.subjectName}
                            </div>
                            
                            {subject.tree.map((chap, i) => (
                              <div key={i} className="mb-2">
                                  <div className="font-bold text-gray-800">📁 {chap.title}</div>
                                  {chap.children.map((top: any, j: number) => (
                                    <div key={j} className="pl-4 border-l-2 border-gray-200 ml-2 py-1">
                                        ↳ {top.title} <span className="text-xs text-gray-400">({top.children.length} sub-topics)</span>
                                    </div>
                                  ))}
                              </div>
                            ))}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-100 bg-white">
              {/* FIXED: Removed csvParsedTree and csvRootSubject from disabled check. Now relies on csvParsedData */}
              <button 
                onClick={handleConfirmCSVUpload} 
                disabled={isUploadingCSV || csvParsedData.length === 0 || !csvTargetCourse} 
                className="w-full py-4 bg-brand-blue text-white rounded-xl font-black shadow-lg disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {isUploadingCSV ? <><Loader2 className="animate-spin" size={18}/> Saving to Database (Do not close)...</> : "CONFIRM & UPLOAD SYLLABUS"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SyllabusExplorer;