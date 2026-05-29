import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Heart, Image as ImageIcon, Plus, X, Loader2, ExternalLink, CornerDownRight } from 'lucide-react';

const PostWidget = () => {
  const navigate = useNavigate();
  const [latestPost, setLatestPost] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fullPost, setFullPost] = useState<any | null>(null);
  const [isFetchingFull, setIsFetchingFull] = useState(false);

  useEffect(() => {
    const fetchMyLatestPost = async () => {
      try {
        const token = localStorage.getItem("jwtoken");
        // 🚨 FIX: Now fetches from your specific "my-posts" route!
        const res = await fetch(`${import.meta.env.VITE_API}my-posts`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
          const myPosts = await res.json();
          // Grab the very first (newest) post you created
          if (myPosts && myPosts.length > 0) {
            setLatestPost(myPosts[0]);
          }
        }
      } catch (error) {
        console.error("Failed to load latest post:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMyLatestPost();
  }, []);

  // Open Modal & Fetch Single Post Route
  const handleOpenPost = async () => {
    if (!latestPost) return;
    setIsModalOpen(true);
    setIsFetchingFull(true);

    try {
      const res = await fetch(`${import.meta.env.VITE_API}posts/single/${latestPost._id}`);
      if (res.ok) {
        const data = await res.json();
        setFullPost(data);
      }
    } catch (error) {
      console.error("Failed to fetch full post", error);
    } finally {
      setIsFetchingFull(false);
    }
  };

  // Flattens comments & replies to get the 3 most recent
  const getRecentComments = (comments: any[]) => {
    if (!comments || comments.length === 0) return [];
    
    let allInteractions: any[] = [];
    
    comments.forEach(c => {
        allInteractions.push({
            id: c._id,
            userName: c.user?.name || 'Unknown',
            text: c.text,
            isReply: false
        });
        
        if (c.replies && c.replies.length > 0) {
            c.replies.forEach((r: any) => {
                allInteractions.push({
                    id: r._id,
                    userName: r.user?.name || 'Unknown',
                    text: r.text,
                    isReply: true,
                    parentText: c.text 
                });
            });
        }
    });

    return allInteractions.reverse().slice(0, 3);
  };

  return (
    <>
      {/* WIDGET HEADER */}
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-brand-blue shadow-[0_0_8px_rgba(0,100,255,0.5)]" />
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">My Latest Post</h3>
        </div>
        {latestPost && (
            <button onClick={() => navigate('/')} className="text-[10px] font-bold text-brand-blue hover:underline flex items-center gap-1">
                View Feed <ExternalLink size={10} />
            </button>
        )}
      </div>

      {/* WIDGET CONTENT */}
      <div className="flex-1 flex flex-col relative z-10 overflow-hidden">
        {isLoading ? (
            <div className="h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-brand-blue animate-spin" />
            </div>
        ) : latestPost ? (
            <div 
                onClick={handleOpenPost}
                className="flex flex-col h-full bg-slate-50 hover:bg-blue-50/50 rounded-2xl border border-slate-100 hover:border-brand-blue/30 transition-all cursor-pointer p-4 group"
            >
                {/* Author & Stats Row */}
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                        {latestPost.userId?.photo ? (
                            <img src={latestPost.userId.photo} className="w-8 h-8 rounded-full object-cover border border-slate-200 shadow-sm" />
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-brand-blue/10 text-brand-blue flex items-center justify-center font-bold text-xs">
                                {(latestPost.userId?.name || "U").charAt(0).toUpperCase()}
                            </div>
                        )}
                        <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-800 leading-tight">You</span>
                            <span className="text-[9px] font-medium text-slate-400">
                                {new Date(latestPost.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </span>
                        </div>
                    </div>
                    
                    {/* Small Image Thumbnail if exists */}
                    {latestPost.imageUrl && (
                        <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 shrink-0 shadow-sm ml-2">
                            <img src={latestPost.imageUrl} className="w-full h-full object-cover" />
                        </div>
                    )}
                </div>

                {/* Post Content Snippet */}
                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-3">
                    {latestPost.content || "Shared an image"}
                </p>

                {/* Mini Stats Bar */}
                <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 mb-3 border-b border-slate-200/60 pb-3">
                    <span className="flex items-center gap-1.5 group-hover:text-rose-500 transition-colors"><Heart size={12} className={latestPost.likes > 0 ? "fill-rose-500 text-rose-500" : ""} /> {latestPost.likes || 0} Likes</span>
                    <span className="flex items-center gap-1.5 group-hover:text-brand-blue transition-colors"><MessageSquare size={12} /> {latestPost.comments?.length || 0} Comments</span>
                </div>

                {/* LATEST COMMENTS PREVIEW (Up to 3) */}
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                    {getRecentComments(latestPost.comments).length > 0 ? (
                        getRecentComments(latestPost.comments).map((c: any, idx: number) => (
                            <div key={idx} className="bg-white p-2 rounded-xl border border-slate-100 shadow-sm">
                                {c.isReply && (
                                    <div className="flex items-start gap-1 mb-1 opacity-60">
                                        <CornerDownRight size={8} className="mt-0.5 text-brand-blue shrink-0" />
                                        <span className="text-[8px] font-medium text-slate-400 truncate">Replying to: "{c.parentText}"</span>
                                    </div>
                                )}
                                <span className="text-[10px] font-bold text-slate-800">{c.userName.split(' ')[0]}: </span>
                                <span className="text-[10px] text-slate-600 truncate inline-block w-[calc(100%-40px)] align-bottom">{c.text}</span>
                            </div>
                        ))
                    ) : (
                        <div className="text-[10px] font-medium text-slate-400 italic text-center py-2">No comments yet.</div>
                    )}
                </div>
            </div>
        ) : (
            // 🚨 EMPTY STATE: NO POSTS FOUND
            <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200 py-6 px-4">
                <ImageIcon size={32} className="opacity-20 mb-3" />
                <h4 className="text-xs font-bold text-slate-700 mb-1">No posts yet</h4>
                <p className="text-[10px] text-slate-500 text-center mb-4">You haven't shared anything with the community.</p>
                <button 
                    onClick={() => navigate('/')} 
                    className="flex items-center gap-2 bg-brand-blue text-white px-4 py-2 rounded-xl text-[10px] font-bold hover:bg-blue-600 transition shadow-sm"
                >
                    <Plus size={12} strokeWidth={3} /> Create New Post
                </button>
            </div>
        )}
      </div>

      {/* 🚨 FULL POST POPUP MODAL */}
      {isModalOpen && (
          <div className="fixed inset-0 z-10000 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-200" onMouseDown={() => setIsModalOpen(false)}>
              <div 
                  className="bg-white rounded-3xl md:rounded-4xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden"
                  onMouseDown={e => e.stopPropagation()}
              >
                  {/* Modal Header */}
                  <div className="p-4 md:p-5 border-b border-gray-100 flex justify-between items-center bg-slate-50">
                      <div className="flex items-center gap-3">
                          {latestPost.userId?.photo ? (
                              <img src={latestPost.userId.photo} className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                          ) : (
                              <div className="w-10 h-10 rounded-full bg-brand-blue text-white flex items-center justify-center font-bold">
                                  {(latestPost.userId?.name || "U").charAt(0).toUpperCase()}
                              </div>
                          )}
                          <div className="flex flex-col">
                              <span className="text-sm font-bold text-slate-800">{latestPost.userId?.name}</span>
                              <span className="text-[10px] font-bold text-slate-400">@{latestPost.userId?.username}</span>
                          </div>
                      </div>
                      <button onClick={() => setIsModalOpen(false)} className="hover:bg-slate-200 text-slate-500 p-2 rounded-full transition shrink-0"><X size={20}/></button>
                  </div>
                  
                  {/* Modal Body */}
                  <div className="p-0 overflow-y-auto custom-scrollbar flex-1 bg-white">
                      {isFetchingFull ? (
                          <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 text-brand-blue animate-spin" /></div>
                      ) : fullPost ? (
                          <div className="flex flex-col">
                              {/* Full Post Content */}
                              <div className="p-6">
                                <p className="text-sm md:text-base text-slate-700 leading-relaxed whitespace-pre-wrap mb-4">
                                    {fullPost.content}
                                </p>
                                {fullPost.imageUrl && (
                                    <div className="w-full rounded-2xl overflow-hidden border border-slate-100 shadow-sm bg-slate-50">
                                        <img src={fullPost.imageUrl} className="w-full h-auto max-h-100 object-contain" />
                                    </div>
                                )}
                              </div>

                              {/* Action Bar */}
                              <div className="px-6 py-4 border-y border-slate-100 flex items-center gap-6 bg-slate-50/50">
                                  <span className="flex items-center gap-2 text-xs font-bold text-slate-500"><Heart size={16} className={fullPost.likes > 0 ? "fill-rose-500 text-rose-500" : ""} /> {fullPost.likes} Likes</span>
                                  <span className="flex items-center gap-2 text-xs font-bold text-slate-500"><MessageSquare size={16} /> {fullPost.comments?.length || 0} Comments</span>
                              </div>

                              {/* Full Comments List */}
                              <div className="p-6 bg-slate-50 flex-1">
                                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">All Comments</h4>
                                  <div className="space-y-4">
                                      {fullPost.comments && fullPost.comments.length > 0 ? (
                                          fullPost.comments.map((comment: any) => (
                                              <div key={comment._id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                                  <div className="flex items-center gap-2 mb-2">
                                                      <span className="text-xs font-bold text-slate-800">{comment.user?.name}</span>
                                                  </div>
                                                  <p className="text-xs text-slate-600">{comment.text}</p>
                                                  
                                                  {/* Render nested replies if they exist */}
                                                  {comment.replies && comment.replies.length > 0 && (
                                                      <div className="mt-3 pl-3 border-l-2 border-slate-100 space-y-2">
                                                          {comment.replies.map((reply: any) => (
                                                              <div key={reply._id} className="bg-slate-50 p-3 rounded-xl">
                                                                  <span className="text-[10px] font-bold text-slate-800 block mb-1">{reply.user?.name}</span>
                                                                  <p className="text-[10px] text-slate-600">{reply.text}</p>
                                                              </div>
                                                          ))}
                                                      </div>
                                                  )}
                                              </div>
                                          ))
                                      ) : (
                                          <p className="text-xs text-slate-400 italic">No comments to display.</p>
                                      )}
                                  </div>
                              </div>
                          </div>
                      ) : (
                          <div className="py-20 text-center text-slate-400 text-sm font-bold">Failed to load post details.</div>
                      )}
                  </div>
              </div>
          </div>
      )}
    </>
  );
};

export default PostWidget;