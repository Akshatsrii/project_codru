import { useEffect, useState, useMemo } from "react";
import { ShieldAlert, Loader2 } from "lucide-react";
import { DataGrid, GridColDef, GridToolbar } from "@mui/x-data-grid";

// 🚨 Added our MUI v6 theme survival kit!
import { ThemeProvider, useTheme, alpha, lighten, darken } from "@mui/material/styles";

export default function AdminAuditLog() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 🚨 THE V9 FIX: Polyfill directly on your real theme to prevent Context crashes!
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

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const token = localStorage.getItem("jwtoken");
        const res = await fetch(`${import.meta.env.VITE_API}admin/audit-log`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        
        if (res.ok) {
          const data = await res.json();
          // DataGrid requires a unique 'id' property. If your backend sends '_id', we map it.
          const formattedData = data.map((item: any) => ({
            ...item,
            id: item.id || item._id, // Ensure id exists
          }));
          setLogs(formattedData);
        }
      } catch (error) {
        console.error("Failed to fetch logs", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  // --- MUI DATAGRID COLUMNS DEFINITION ---
  const columns: GridColDef[] = [
    { 
      field: "timestamp", 
      headerName: "Date & Time", 
      flex: 1, 
      minWidth: 180,
      renderCell: (params) => (
        <span className="text-gray-500 font-medium">
          {new Date(params.value).toLocaleDateString()}{" "}
          <span className="text-xs text-gray-400">
            {new Date(params.value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </span>
      )
    },
    { 
      field: "triggeredBy", 
      headerName: "Agent (Who)", 
      flex: 1, 
      minWidth: 130,
      renderCell: (params) => (
        <span className={`font-bold px-2 py-1 rounded-md text-xs ${
          params.value === 'System' ? 'bg-gray-100 text-gray-600' : 'bg-brand-blue/10 text-brand-blue'
        }`}>
          @{params.value}
        </span>
      )
    },
    { 
      field: "action", 
      headerName: "Action Taken", 
      flex: 2, // Give this column double the space
      minWidth: 250,
      renderCell: (params) => (
        <span className="text-gray-800 font-medium whitespace-normal leading-tight py-2">
          {params.value}
        </span>
      )
    },
    { 
      field: "recipient", 
      headerName: "Target (Recipient)", 
      flex: 1, 
      minWidth: 150,
      renderCell: (params) => (
        <span className="font-semibold text-gray-600">
          @{params.value}
        </span>
      )
    },
    { 
      field: "isRead", 
      headerName: "Status", 
      width: 120, // Fixed width for status
      renderCell: (params) => (
        params.value ? (
          <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold border border-gray-200 px-2 py-1 rounded-md">Read</span>
        ) : (
          <span className="text-[10px] uppercase tracking-wider text-brand-orange font-bold bg-brand-orange/10 px-2 py-1 rounded-md">Unread</span>
        )
      )
    }
  ];

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin text-brand-orange" /></div>;

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 animate-fade-in flex flex-col h-175">
      
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-display font-bold text-gray-800 flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-brand-orange" />
          Security & Activity Log
        </h2>
        <p className="text-sm text-gray-500">Master record of all platform notifications and triggers.</p>
      </div>

      {/* MUI DataGrid */}
      <div className="flex-1 w-full bg-white rounded-xl overflow-hidden border border-gray-100">
        {/* 🚨 Wraps perfectly with the safeTheme preserving MUI v6 architecture */}
        <ThemeProvider theme={patchedTheme}>
          <DataGrid
            rows={logs}
            columns={columns}
            initialState={{
              pagination: {
                paginationModel: { page: 0, pageSize: 25 },
              },
              sorting: {
                sortModel: [{ field: 'timestamp', sort: 'desc' }],
              },
            }}
            pageSizeOptions={[10, 25, 50, 100]}
            disableRowSelectionOnClick
            slots={{ toolbar: GridToolbar }} // 🚨 This adds the built-in Export/Filter/Density menu!
            slotProps={{
              toolbar: {
                showQuickFilter: true, // 🚨 Adds a fast universal search bar!
                quickFilterProps: { debounceMs: 500 },
              },
            }}
            sx={{
              border: 'none',
              '& .MuiDataGrid-cell': {
                borderColor: '#f1f5f9', // Light gray borders
                display: 'flex',
                alignItems: 'center', // Vertically center content
              },
              '& .MuiDataGrid-columnHeaders': {
                backgroundColor: '#f8fafc', // match your slate-50 background
                color: '#64748b',
                fontWeight: 'bold',
                borderBottom: '1px solid #e2e8f0',
              },
              '& .MuiDataGrid-toolbarContainer': {
                padding: '16px',
                backgroundColor: '#f8fafc',
                borderBottom: '1px solid #f1f5f9',
              }
            }}
          />
        </ThemeProvider>
      </div>
    </div>
  );
}