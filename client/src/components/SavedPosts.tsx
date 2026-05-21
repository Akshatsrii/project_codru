import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bookmark, Heart, MessageCircle, Loader2 } from "lucide-react";

const SavedPosts = () => {
  const [savedPosts, setSavedPosts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSavedPosts = async () => {
      try {
        const token = localStorage.getItem("jwtoken");
        const res = await fetch(`${import.meta.env.VITE_API}saved-posts`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          // Filter out any nulls just in case a saved post was deleted by its author
          setSavedPosts(data.filter((p: any) => p !== null)); 
        }
      } catch (error) {
        console.error("Failed to load saved posts", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSavedPosts();
  }, []);

  if (isLoading) return <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin text-brand-orange" /></div>;

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-6">
        <Bookmark className="w-6 h-6 text-brand-orange fill-current" />
        <h2 className="text-2xl font-bold text-gray-800">Saved Posts</h2>
      </div>
      
      {savedPosts.length === 0 ? (
        <div className="text-center bg-white rounded-3xl p-10 border border-gray-100 shadow-sm">
          <p className="text-gray-500">You haven't saved any posts yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {savedPosts.map((post) => (
            <div 
              key={post._id} 
              onClick={() => navigate(`/post/${post._id}`)}
              className="group cursor-pointer bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-all h-64 relative flex flex-col"
            >
              {post.imageUrl ? (
                <div className="flex-1 relative overflow-hidden bg-gray-100">
                  <img src={post.imageUrl} alt="post" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-md text-white text-xs font-bold px-2 py-1 rounded-full">
                    @{post.userId?.username}
                  </div>
                </div>
              ) : (
                <div className="flex-1 p-5 flex flex-col items-center justify-center bg-linear-to-br from-slate-50 to-gray-100 text-center relative group-hover:bg-gray-100 transition-colors">
                  <div className="absolute top-3 text-xs font-bold text-brand-blue">@{post.userId?.username}</div>
                  <p className="text-gray-700 font-medium line-clamp-4 mt-4">{post.content}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SavedPosts;