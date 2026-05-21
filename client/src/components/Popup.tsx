import React, { useState } from 'react';
import { User, GraduationCap, Heart, Loader2, ArrowRight } from 'lucide-react'; // 🚨 Added Heart icon

interface PopupProps {
  isOpen: boolean;
  onRoleSelected: (role: 'Student' | 'Teacher' | 'Parent' | 'User') => void; // 🚨 Added 'Parent'
  onClose?: () => void; 
}

const Popup: React.FC<PopupProps> = ({ isOpen, onRoleSelected, onClose }) => {
  const [isUpdating, setIsUpdating] = useState(false);

  if (!isOpen) return null;

  // 🚨 Added 'Parent' to the accepted types here
  const handleRoleSelection = async (selectedRole: 'Student' | 'Teacher' | 'Parent' | 'User') => {
    setIsUpdating(true);
    
    try {
      const token = localStorage.getItem("jwtoken");
      
      const res = await fetch(`${import.meta.env.VITE_API}update-profile`, {
        method: "PUT",
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json" 
        },
        body: JSON.stringify({ role: selectedRole }) 
      });

      if (res.ok) {
        onRoleSelected(selectedRole);
      } else {
        throw new Error("Failed to update role");
      }
    } catch (error) {
      console.error("Error setting role:", error);
      alert("Failed to save your role. Please check your connection and try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="absolute inset-0" onClick={onClose}></div>
      
      {/* 🚨 Widened the max-w to fit 3 buttons comfortably */}
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden transform transition-all scale-100 relative z-10">
        
        {/* Header Section */}
        <div className="p-6 bg-brand-orange text-white text-center">
          <h2 className="text-3xl font-display font-bold">Welcome!</h2>
          <p className="font-body text-orange-100 mt-1">Choose how you want to use CuTe Learning.</p>
        </div>
        
        {/* Body Section */}
        <div className="p-8 relative">
          
          {/* Loading Overlay */}
          {isUpdating && (
            <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-b-3xl">
              <Loader2 className="w-10 h-10 animate-spin text-brand-orange mb-3" />
              <p className="font-bold text-gray-600 font-display tracking-wide animate-pulse">Updating your profile...</p>
            </div>
          )}

          <h3 className="text-center text-xl font-bold text-gray-800 mb-6 font-display">
            What is your primary goal?
          </h3>
          
          {/* 🚨 Updated Grid to handle 3 columns */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            {/* Student Button */}
            <button
              onClick={() => handleRoleSelection('Student')}
              disabled={isUpdating}
              className="flex flex-col items-center justify-center p-6 border-2 border-brand-blue/20 rounded-2xl hover:border-brand-blue hover:bg-blue-50 transition group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="bg-brand-blue/10 p-4 rounded-full mb-3 group-hover:bg-brand-blue group-hover:text-white transition-colors text-brand-blue shadow-sm">
                <User size={36} strokeWidth={2.5} />
              </div>
              <span className="font-display font-bold text-gray-800 group-hover:text-brand-blue transition-colors text-lg">Learn</span>
              <span className="text-xs text-gray-400 mt-1 font-medium">As a Student</span>
            </button>

            {/* Teacher Button */}
            <button
              onClick={() => handleRoleSelection('Teacher')}
              disabled={isUpdating}
              className="flex flex-col items-center justify-center p-6 border-2 border-brand-orange/20 rounded-2xl hover:border-brand-orange hover:bg-orange-50 transition group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="bg-brand-orange/10 p-4 rounded-full mb-3 group-hover:bg-brand-orange group-hover:text-white transition-colors text-brand-orange shadow-sm">
                <GraduationCap size={36} strokeWidth={2.5} />
              </div>
              <span className="font-display font-bold text-gray-800 group-hover:text-brand-orange transition-colors text-lg">Teach</span>
              <span className="text-xs text-gray-400 mt-1 font-medium">As an Educator</span>
            </button>

            {/* 🚨 NEW: Parent Button */}
            <button
              onClick={() => handleRoleSelection('Parent')}
              disabled={isUpdating}
              // Using a nice green/emerald tint to separate it from the academic roles
              className="flex flex-col items-center justify-center p-6 border-2 border-emerald-500/20 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50 transition group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="bg-emerald-500/10 p-4 rounded-full mb-3 group-hover:bg-emerald-500 group-hover:text-white transition-colors text-emerald-500 shadow-sm">
                <Heart size={36} strokeWidth={2.5} />
              </div>
              <span className="font-display font-bold text-gray-800 group-hover:text-emerald-500 transition-colors text-lg">Guide</span>
              <span className="text-xs text-gray-400 mt-1 font-medium">As a Parent</span>
            </button>
            
          </div>
          
          {/* Skip Button */}
          <div className="mt-8 text-center border-t border-gray-100 pt-6">
            <button 
              onClick={() => handleRoleSelection('User')}
              disabled={isUpdating}
              className="text-sm font-bold text-gray-400 hover:text-brand-blue transition flex items-center justify-center gap-1 mx-auto group"
            >
              Skip for now, I just want to explore 
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Popup;