import { useState } from "react";
import { Heart, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Link } from "react-router-dom";

const CommentItem = ({ comment, postId, currentUserId, onVote, onReply, onDelete, level = 0, isSubmitting }: any) => {
  const [isReplying, setIsReplying] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [replyText, setReplyText] = useState("");

  const replyCount = comment.replies?.length || 0;
  const isOwner = comment.user?._id === currentUserId;
  
  // Strict check: Is this the main comment?
  const isTopLevel = level === 0; 

  return (
    <div className={`mt-4 ${!isTopLevel ? "ml-10 border-l-2 border-brand-orange/20 pl-4" : ""}`}>
      <div className="flex gap-3">
        {/* Avatar */}
        <Link to={`/profile/${comment.user?.username}`}>
        <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-gray-100 bg-brand-orange text-white flex items-center justify-center text-[10px] font-bold shadow-sm">
          {comment.user?.photo ? (
            <img src={comment.user.photo} alt="" className="w-full h-full object-cover" />
          ) : (
             comment.user?.name?.charAt(0).toUpperCase() || "U"
          )}
        </div>
        </Link>

        <div className="flex-1">
          {/* Chat Bubble */}
          <div className="bg-white px-3 py-2 rounded-2xl rounded-tl-none shadow-sm border border-gray-100 inline-block max-w-full">
            <Link 
                to={`/profile/${comment.user?.username}`} 
                className="text-[11px] font-bold text-gray-800 hover:text-brand-orange hover:underline"
            >
                @{comment.user?.username || "explorer"}
            </Link>
            <p className="text-sm text-gray-600 mt-0.5 leading-relaxed">{comment.text}</p>
          </div>

          {/* Action Row */}
          <div className="flex items-center gap-4 mt-1.5 ml-1">
            
            {/* 1. ONLY THE LIKE BUTTON (Dislike is gone!) */}
            {/* Inside CommentItem.tsx */}
            <button 
                onClick={() => onVote(postId, comment._id)} // Removed the 'like' string here!
                className={`flex items-center gap-1 text-[10px] font-bold transition-all ${
                    comment.likedBy?.includes(currentUserId) ? 'text-brand-orange' : 'text-gray-400 hover:text-brand-orange'
                }`}
                >
                <Heart className={`w-3.5 h-3.5 ${comment.likedBy?.includes(currentUserId) ? 'fill-current' : ''}`} />
                <span>{comment.likedBy?.length || 0}</span>
            </button>

            {/* 2. REPLY BUTTON (Strictly Top-Level Only) */}
            {isTopLevel && (
              <button 
                onClick={() => setIsReplying(!isReplying)}
                className="text-[10px] font-bold text-gray-400 hover:text-brand-blue uppercase tracking-tighter"
              >
                Reply
              </button>
            )}

            {/* 3. DELETE BUTTON */}
            {isOwner && (
              <button 
                onClick={() => onDelete(postId, comment._id)}
                className="text-gray-300 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* REPLY COUNT & TOGGLE (Strictly Top-Level Only) */}
          {isTopLevel && replyCount > 0 && (
            <button 
              onClick={() => setShowReplies(!showReplies)}
              className="mt-2 flex items-center gap-1 text-[10px] font-bold text-brand-blue hover:text-brand-orange transition-colors"
            >
              {showReplies ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {showReplies ? "Hide replies" : `View ${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`}
            </button>
          )}

          {/* REPLY INPUT FIELD (Strictly Top-Level Only) */}
          {isReplying && isTopLevel && (
            <div className="mt-3 flex gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <input 
                autoFocus
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                // 🚨 Added isSubmitting check to prevent double Enter press
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && replyText.trim() && !isSubmitting[comment._id]) {
                    onReply(postId, comment._id, replyText);
                    setReplyText("");
                    setIsReplying(false);
                    setShowReplies(true);
                  }
                }}
                disabled={isSubmitting[comment._id]} // 🚨 Lock Input visually
                className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-brand-blue/20 disabled:opacity-50"
                placeholder={`Reply to @${comment.user?.username}...`}
              />
              <button 
                onClick={() => { 
                  // Ensure we don't proceed if it's already submitting!
                  if(isSubmitting[comment._id]) return;
                  onReply(postId, comment._id, replyText); 
                  setIsReplying(false); 
                  setReplyText(""); 
                  setShowReplies(true); 
                }}
                // 🚨 Added isSubmitting[comment._id] to the disabled condition
                disabled={!replyText.trim() || isSubmitting[comment._id]} 
                className="touch-manipulation bg-brand-blue text-white px-3 py-1.5 rounded-xl text-[10px] font-bold disabled:opacity-50"
              >
                {isSubmitting[comment._id] ? "..." : "Post"}
              </button>
            </div>
          )}

          {/* RENDER REPLIES (Will only render 1 level deep) */}
          {showReplies && comment.replies?.map((reply: any) => (
            <CommentItem 
              key={reply._id} 
              comment={reply} 
              postId={postId}
              currentUserId={currentUserId}
              onVote={onVote}
              onReply={onReply}
              onDelete={onDelete}
              level={level + 1} // CRITICAL: This is what tells the next comment it is NOT top-level!
              isSubmitting={isSubmitting}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default CommentItem; // (Or just leave it inline if it's in CuteFeed.tsx)