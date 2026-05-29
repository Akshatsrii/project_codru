import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
// 1. 🚨 Import the API hook and Toolbar from Data Grid
import { DataGrid, GridColDef, Toolbar, useGridApiContext } from "@mui/x-data-grid";
import { RocketLaunch, ArrowBack, Edit, Delete } from "@mui/icons-material";
// 2. 🚨 Import standard MUI components for our custom search
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, InputAdornment } from "@mui/material";

// Theme survival kit
import { ThemeProvider, useTheme, alpha, lighten, darken } from "@mui/material/styles";

// 3. 🚨 Import the Search icon from lucide-react
import { Loader2, Search } from "lucide-react";

// Components
import Muialert from "./Muialert";

interface ProblemRecord {
  _id: string;
  week: number;
  question: string;
  answer: string;
  link: string;
}

// 4. 🚨 NEW: Create a custom search bar that talks to the Data Grid
function CustomGridSearch() {
  const apiRef = useGridApiContext();

  return (
    <TextField
      placeholder="Search problems..."
      size="small"
      onChange={(event) => {
        // Split the search string by spaces and tell the grid to filter
        const searchWords = event.target.value.split(' ').filter((word) => word !== '');
        apiRef.current.setQuickFilterValues(searchWords);
      }}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <Search size={16} className="text-gray-400" />
            </InputAdornment>
          ),
        },
      }}
      sx={{ 
        width: "250px", 
        '& .MuiOutlinedInput-root': { borderRadius: '8px', bgcolor: 'white' } 
      }}
    />
  );
}

const UpdateReport = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  
  // Top Form State
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [link, setLink] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Table & Auto-calculate State
  const [history, setHistory] = useState<ProblemRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [nextProblemNo, setNextProblemNo] = useState(1);
  
  // 🚨 NEW: Sleek Toast Alert State
  const [alertMessage, setAlertMessage] = useState("");
  const [alertSeverity, setAlertSeverity] = useState<"success" | "error" | "info" | "warning">("info");
  const [showAlert, setShowAlert] = useState(false);

  // Modal States
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ProblemRecord | null>(null);

  // MUI v9 Theme Polyfill
  const baseTheme = useTheme();
  const patchedTheme = useMemo(() => {
    const clone = { ...baseTheme };
    // @ts-ignore
    clone.alpha = alpha || ((c: any) => c);
    // @ts-ignore
    clone.lighten = lighten || ((c: any) => c);
    // @ts-ignore
    clone.darken = darken || ((c: any) => c);
    return clone;
  }, [baseTheme]);

  const fetchHistory = async () => {
    try {
      setLoadingHistory(true);
      const token = localStorage.getItem("jwtoken"); 

      const response = await fetch(`${import.meta.env.VITE_API}user-report/${username}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        cache: "no-store"
      });
      
      if (!response.ok) throw new Error("Failed to load history");
      const data = await response.json();
      
      const existingTasks: ProblemRecord[] = data.tasks || [];
      setHistory(existingTasks); 
      
      if (existingTasks.length > 0) {
        const highestNum = Math.max(...existingTasks.map(t => t.week || 0));
        setNextProblemNo(highestNum + 1);
      } else {
        setNextProblemNo(1);
      }
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [username]);

  // Handle Main Form Submission
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API}update-report/${username}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("jwtoken")}`
        },
        body: JSON.stringify({ week: nextProblemNo, question, answer, link }),
      });

      if (!response.ok) throw new Error("Failed to update report");

      setAlertSeverity("success");
      setAlertMessage("Planet successfully added to path! 🚀");
      setShowAlert(true);
      
      setQuestion(""); setAnswer(""); setLink("");
      fetchHistory();
    } catch (error: any) {
      setAlertSeverity("error");
      setAlertMessage(error.message || "An error occurred");
      setShowAlert(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Edit
  const handleEditSubmit = async () => {
    if (!selectedRecord) return;
    setEditModalOpen(false);
    
    setAlertSeverity("info");
    setAlertMessage("Saving changes...");
    setShowAlert(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API}edit-report-task/${username}/${selectedRecord._id}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("jwtoken")}`
        },
        body: JSON.stringify(selectedRecord),
      });

      if (!response.ok) throw new Error("Failed to edit problem");
      
      setAlertSeverity("success");
      setAlertMessage("Problem edited successfully!");
      setShowAlert(true);
      fetchHistory();
    } catch (error: any) {
      setAlertSeverity("error");
      setAlertMessage(error.message || "Failed to edit");
      setShowAlert(true);
    }
  };

  // Handle Delete (Triggers Re-indexing on Backend)
  const handleDeleteConfirm = async () => {
    if (!selectedRecord) return;
    setDeleteModalOpen(false);

    setAlertSeverity("info");
    setAlertMessage("Deleting and re-indexing universe...");
    setShowAlert(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API}delete-report-task/${username}/${selectedRecord.week}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${localStorage.getItem("jwtoken")}` },
      });

      if (!response.ok) throw new Error("Failed to delete problem");
      
      setAlertSeverity("success");
      setAlertMessage("Problem deleted and path re-indexed! 🌌");
      setShowAlert(true);
      
      await fetchHistory(); 
    } catch (error: any) {
      setAlertSeverity("error");
      setAlertMessage(error.message || "Failed to delete");
      setShowAlert(true);
    }
  };

  const columns: GridColDef[] = [
    { 
      field: "week", 
      headerName: "Prob #", 
      width: 80,
      renderCell: (params) => (
        <span className="font-black text-brand-blue bg-blue-50 px-2 py-1 rounded-md">
          {params.value}
        </span>
      )
    },
    { field: "question", headerName: "Problem Faced", flex: 1, minWidth: 200 },
    { field: "answer", headerName: "Solution Figured", flex: 1.5, minWidth: 300 },
    { 
      field: "link", 
      headerName: "Link", 
      flex: 0.5,
      renderCell: (params) => (
        params.value ? (
          <a href={params.value} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-bold text-xs">
            View
          </a>
        ) : <span className="text-gray-400 text-xs">None</span>
      )
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 120,
      renderCell: (params) => (
        <div className="flex items-center gap-3 h-full">
          <button 
            onClick={() => { setSelectedRecord(params.row); setEditModalOpen(true); }}
            className="text-gray-400 hover:text-brand-blue transition"
            title="Edit Problem"
          >
            <Edit fontSize="small" />
          </button>
          <button 
            onClick={() => { setSelectedRecord(params.row); setDeleteModalOpen(true); }}
            className="text-gray-400 hover:text-red-500 transition"
            title="Delete Problem"
          >
            <Delete fontSize="small" />
          </button>
        </div>
      )
    }
  ];

  // 5. 🚨 UPDATED: Inject our Custom Search into the Toolbar!
  const CustomToolbar = useCallback((props: any) => {
    return (
      <Toolbar {...props} className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50/50">
        <h2 className="px-4 text-lg font-bold text-gray-700">Evolution History</h2>
        <CustomGridSearch />
      </Toolbar>
    );
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 animate-fade-in-up">
      <div className="max-w-7xl mx-auto space-y-6 flex flex-col h-full">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-2">
          <button onClick={() => navigate(-1)} className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-100 transition">
            <ArrowBack sx={{ color: '#4b5563' }} />
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-brand-blue">Update Report</h1>
            <p className="text-gray-500 text-xs md:text-sm mt-1">Charting the planetary path for <span className="font-bold text-brand-orange">@{username}</span></p>
          </div>
        </div>

        {/* TOP SECTION: The Compact Form */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-6 md:p-8 relative">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Problem No.</label>
                <input type="text" className="w-full bg-gray-100 border border-gray-200 text-gray-700 rounded-xl px-4 py-3 font-black text-center" value={`# ${nextProblemNo}`} readOnly />
              </div>
              <div className="md:col-span-5">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Problem Faced</label>
                <input type="text" className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-blue outline-none transition" value={question} onChange={(e) => setQuestion(e.target.value)} required />
              </div>
              <div className="md:col-span-5">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Reference Link</label>
                <input type="url" className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-blue outline-none transition" value={link} onChange={(e) => setLink(e.target.value)} />
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Solution Figured</label>
              <textarea 
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-blue outline-none transition resize-none h-24" 
                value={answer} 
                onChange={(e) => setAnswer(e.target.value)} 
                required 
              />
            </div>
            <div className="flex justify-end mt-2">
              <button 
                type="submit" 
                disabled={isSubmitting} 
                className="bg-brand-blue text-white font-bold py-3 px-8 rounded-xl hover:bg-blue-800 transition flex items-center gap-2 disabled:opacity-50" 
                style={{ backgroundColor: '#1765a4' }}
              >
                {isSubmitting ? <Loader2 className="animate-spin w-5 h-5" /> : <RocketLaunch fontSize="small" />}
                {isSubmitting ? "Initializing..." : "Add to Path"}
              </button>
            </div>
          </form>
        </div>

        {/* BOTTOM SECTION: The DataGrid */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden h-125 flex flex-col shrink-0">
          <ThemeProvider theme={patchedTheme}>
            <DataGrid
              rows={history}
              columns={columns}
              getRowId={(row) => row._id || row.week} 
              loading={loadingHistory}
              disableRowSelectionOnClick
              
              slots={{ toolbar: CustomToolbar }}
              showToolbar

              sx={{
                border: 'none',
                '& .MuiDataGrid-columnHeaders': { bgcolor: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase' },
                '& .MuiDataGrid-cell': { borderBottom: '1px solid #f1f5f9' },
              }}
            />
          </ThemeProvider>
        </div>
        
        {/* BOTTOM SPACER */}
        <div className="h-24 md:h-8 w-full shrink-0"></div>
      </div>

      {/* EDIT MODAL */}
      <Dialog open={editModalOpen} onClose={() => setEditModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold', color: '#1765a4' }}>Edit Problem #{selectedRecord?.week}</DialogTitle>
        <DialogContent dividers className="flex flex-col gap-4">
          <TextField 
            label="Problem Faced" 
            fullWidth 
            value={selectedRecord?.question || ""} 
            onChange={(e) => setSelectedRecord(prev => prev ? {...prev, question: e.target.value} : null)}
          />
          <TextField 
            label="Solution Figured" 
            fullWidth 
            multiline 
            rows={4}
            value={selectedRecord?.answer || ""} 
            onChange={(e) => setSelectedRecord(prev => prev ? {...prev, answer: e.target.value} : null)}
          />
          <TextField 
            label="Reference Link" 
            fullWidth 
            value={selectedRecord?.link || ""} 
            onChange={(e) => setSelectedRecord(prev => prev ? {...prev, link: e.target.value} : null)}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setEditModalOpen(false)} color="inherit" sx={{ fontWeight: 'bold' }}>Cancel</Button>
          <Button onClick={handleEditSubmit} variant="contained" sx={{ bgcolor: '#1765a4', fontWeight: 'bold' }}>Save Changes</Button>
        </DialogActions>
      </Dialog>

      {/* DELETE CONFIRMATION MODAL */}
      <Dialog open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)}>
        <DialogTitle sx={{ fontWeight: 'bold', color: '#dc2626' }}>Delete Problem #{selectedRecord?.week}?</DialogTitle>
        <DialogContent>
          <p className="text-gray-600">
            Are you sure you want to delete this planet from their path? <br/><br/>
            <strong>Note:</strong> All subsequent problems will automatically be shifted down by one number to maintain the path sequence.
          </p>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteModalOpen(false)} color="inherit" sx={{ fontWeight: 'bold' }}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} variant="contained" color="error" sx={{ fontWeight: 'bold' }}>Delete & Re-index</Button>
        </DialogActions>
      </Dialog>

      {/* 🚨 THE NEW TOAST SYSTEM */}
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

export default UpdateReport;