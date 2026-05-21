import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Trash2, Edit3, Image as ImageIcon, X, AlertTriangle } from "lucide-react";

interface MyPostsProps {
  preloadedPosts?: any[];
  isOwner?: boolean;
}

const MyPosts = ({ preloadedPosts, isOwner = true }: MyPostsProps) => {
  const [posts, setPosts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // --- NEW: MODAL STATES ---
  const [postToDelete, setPostToDelete] = useState<string | null>(null);
  const [postToEdit, setPostToEdit] = useState<any | null>(null);
  const [editContent, setEditContent] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null); // Custom error pop-up

  useEffect(() => {
    if (preloadedPosts) {
      setPosts(preloadedPosts);
      setIsLoading(false);
    } else {
      const fetchDashboardPosts = async () => {
        try {
          const token = localStorage.getItem("jwtoken");
          const res = await fetch(`${import.meta.env.VITE_API}my-posts`, {
            headers: { "Authorization": `Bearer ${token}` }
          });
          
          if (res.ok) {
            const data = await res.json();
            const finalData = Array.isArray(data) ? data : (data.posts || data.blogs || []);
            setPosts(finalData);
          }
        } catch (error) {
          console.error("Dashboard error:", error);
        } finally {
          setIsLoading(false);
        }
      };
      fetchDashboardPosts();
    }
  }, [preloadedPosts]);

  // ==========================================
  // DELETE LOGIC
  // ==========================================
  const confirmDelete = async () => {
    if (!postToDelete) return;

    // Optimistically hide the post
    const originalPosts = [...posts];
    setPosts(prev => prev.filter(p => p._id !== postToDelete));
    
    // Grab the ID and close the modal immediately for a snappy feel
    const targetId = postToDelete;
    setPostToDelete(null);

    try {
      const token = localStorage.getItem("jwtoken");
      const res = await fetch(`${import.meta.env.VITE_API}posts/${targetId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || errData.error || "Failed to delete");
      }
    } catch (error: any) {
      console.error("Error deleting post:", error);
      setErrorMsg(error.message || "Failed to delete post. Please try again.");
      setPosts(originalPosts); // Put it back if the server failed
    }
  };

  // ==========================================
  // EDIT LOGIC
  // ==========================================
  const saveEdit = async () => {
    if (!postToEdit) return;

    try {
      const token = localStorage.getItem("jwtoken");
      const res = await fetch(`${import.meta.env.VITE_API}posts/${postToEdit._id}`, {
        method: "PUT",
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ content: editContent })
      });

      if (res.ok) {
        // Update the UI instantly
        setPosts(prev => prev.map(p => p._id === postToEdit._id ? { ...p, content: editContent } : p));
        setPostToEdit(null); // Close modal
      } else {
        throw new Error("Failed to update post");
      }
    } catch (error: any) {
      console.error("Error updating post:", error);
      setErrorMsg("Failed to update post. Make sure you are connected to the internet.");
    }
  };

  if (isLoading) return <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin text-brand-orange" /></div>;

  return (
    <div className="w-full relative">
      
      {/* --- RENDER POSTS --- */}
      {posts.length === 0 ? (
        <div className="text-center bg-white rounded-3xl p-10 border border-gray-100 flex flex-col items-center">
           <ImageIcon className="w-12 h-12 text-gray-200 mb-3" />
          <p className="text-gray-500 font-medium">You haven't published any posts yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post: any) => (
            <div 
              key={post._id} 
              onClick={() => navigate(`/post/${post._id}`)}
              className="group cursor-pointer bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all overflow-hidden h-64 relative flex flex-col"
            >
              
              {/* 🚨 3. THE FIX: Wrap action buttons in isOwner check */}
              {isOwner && (
                <div className="absolute top-3 right-3 z-20 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditContent(post.content);
                      setPostToEdit(post);
                    }}
                    className="p-2 bg-white/90 backdrop-blur-sm hover:bg-white text-gray-700 hover:text-brand-blue rounded-full shadow-md transition transform hover:scale-110"
                    title="Edit Post"
                  >
                    <Edit3 size={16} />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setPostToDelete(post._id);
                    }}
                    className="p-2 bg-white/90 backdrop-blur-sm hover:bg-white text-gray-700 hover:text-red-500 rounded-full shadow-md transition transform hover:scale-110"
                    title="Delete Post"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}

              {/* IMAGE CHECK */}
              {post.imageUrl || post.photo ? (
                <div className="flex-1 relative overflow-hidden bg-gray-100">
                  <img 
                    src={post.imageUrl || post.photo} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                    alt="post"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent"></div>
                  <div className="absolute bottom-3 left-3 right-3">
                    <p className="text-white text-sm font-medium line-clamp-2 drop-shadow-md">
                      {post.content}
                    </p>
                  </div>
                </div>
              ) : (
                /* TEXT ONLY CHECK */
                <div className="flex-1 p-6 flex flex-col justify-center bg-slate-50 relative">
                  <p className="text-gray-700 line-clamp-4 italic text-center font-serif text-lg">
                    "{post.content}"
                  </p>
                </div>
              )}
              
              {/* STATS FOOTER */}
              <div className="h-12 bg-white border-t border-gray-100 flex items-center justify-between px-4 text-xs font-bold text-gray-500 relative z-10">
                <span>{new Date(post.createdAt || Date.now()).toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                <div className="flex gap-4">
                  <span className="flex items-center gap-1 hover:text-red-500 transition">❤️ {post.likes || 0}</span>
                  <span className="flex items-center gap-1 hover:text-brand-blue transition">💬 {post.comments?.length || 0}</span>
                </div>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* ========================================== */}
      {/* CUSTOM MODALS */}
      {/* ========================================== */}

      {/* 1. DELETE CONFIRMATION MODAL */}
      {postToDelete && (
        <div className="fixed inset-0 z-150 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setPostToDelete(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden p-6 text-center" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-display font-bold text-gray-800 mb-2">Delete Post?</h3>
            <p className="text-gray-500 text-sm mb-6">This action cannot be undone. Are you sure you want to permanently remove this post?</p>
            <div className="flex gap-3">
              <button onClick={() => setPostToDelete(null)} className="flex-1 py-3 rounded-xl font-bold text-gray-600 bg-gray-50 hover:bg-gray-100 transition">Cancel</button>
              <button onClick={confirmDelete} className="flex-1 py-3 rounded-xl font-bold text-white bg-red-500 hover:bg-red-600 shadow-lg shadow-red-200 transition">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* 2. EDIT POST MODAL */}
      {postToEdit && (
        <div className="fixed inset-0 z-150 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setPostToEdit(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-display font-bold text-gray-800 flex items-center gap-2">
                <Edit3 size={18} className="text-brand-blue" /> Edit Post
              </h3>
              <button onClick={() => setPostToEdit(null)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <textarea 
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full h-32 p-4 bg-gray-50 border border-gray-200 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition"
                placeholder="What's on your mind?"
              />
            </div>
            <div className="p-4 border-t border-gray-100 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setPostToEdit(null)} className="px-5 py-2.5 rounded-xl font-bold text-gray-500 hover:text-gray-700 transition">Cancel</button>
              <button onClick={saveEdit} className="px-5 py-2.5 rounded-xl font-bold text-white bg-brand-blue hover:bg-blue-600 shadow-md shadow-blue-200 transition">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* 3. ERROR POP-UP */}
      {errorMsg && (
        <div className="fixed inset-0 z-160 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm" onClick={() => setErrorMsg(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 text-center border-t-4 border-red-500" onClick={e => e.stopPropagation()}>
            <AlertTriangle className="mx-auto text-red-500 mb-3" size={32} />
            <h3 className="font-bold text-gray-800 mb-1">Oops!</h3>
            <p className="text-sm text-gray-600 mb-6">{errorMsg}</p>
            <button onClick={() => setErrorMsg(null)} className="w-full py-2.5 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition">Dismiss</button>
          </div>
        </div>
      )}

    </div>
  );
};

export default MyPosts;