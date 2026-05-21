import React, { useMemo } from 'react';
import { IconButton, Button } from '@mui/material';
import { Close as CloseIcon, Launch as LaunchIcon } from '@mui/icons-material';

interface TaskModalProps {
  show: boolean;
  onClose: () => void;
  taskId: number | null;
  question: string;
  answer: string;
  link: string;
  position: { x: number; y: number };
}

const TaskModal = ({ show, onClose, taskId, question, answer, link, position }: TaskModalProps) => {
  if (!show) return null;

  // Smart Positioning Math: Ensures the modal never flies off the edge of the screen!
  const modalStyle = useMemo(() => {
    const modalWidth = 340; // Fixed width for a beautiful card
    const modalHeight = 280; // Estimated height
    
    // We start with the exact X/Y of the planet you clicked
    let left = position.x;
    let top = position.y;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Prevent clipping on the right/left
    if (left + (modalWidth / 2) > viewportWidth) left = viewportWidth - (modalWidth / 2) - 20;
    if (left - (modalWidth / 2) < 0) left = (modalWidth / 2) + 20;

    // Prevent clipping on the top/bottom
    if (top + (modalHeight / 2) > viewportHeight) top = viewportHeight - (modalHeight / 2) - 20;
    if (top - (modalHeight / 2) < 0) top = (modalHeight / 2) + 20;

    return {
      left: `${left}px`,
      top: `${top}px`,
      transform: 'translate(-50%, -50%)',
      width: `${modalWidth}px`,
    };
  }, [position]);

  return (
    // 1. Frosted Glass Overlay
    <div 
      className="fixed inset-0 z-1000 bg-slate-900/40 backdrop-blur-sm transition-all duration-300"
      onClick={onClose}
    >
      {/* 2. The Modal Card */}
      <div 
        className="absolute bg-white rounded-3xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden animate-fade-in-up"
        style={modalStyle}
        onClick={(e) => e.stopPropagation()} // Prevents clicks inside the modal from closing the overlay
      >
        {/* Header Section */}
        <div className="bg-brand-blue px-6 py-4 flex justify-between items-center">
          <h2 className="text-white font-display font-bold text-lg tracking-wide">
            Level {taskId}
          </h2>
          <IconButton 
            onClick={onClose} 
            size="small" 
            sx={{ color: 'white', '&:hover': { backgroundColor: 'rgba(255,255,255,0.2)' } }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </div>

        {/* Content Section */}
        <div className="p-6 flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-bold text-brand-orange uppercase tracking-wider mb-1">
              Problem Faced
            </h3>
            <p className="text-gray-800 font-display font-bold text-lg leading-tight">
              {question}
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
              Solution Found
            </h3>
            <p className="text-gray-600 font-body text-sm leading-relaxed">
              {answer || "No additional details provided for this task."}
            </p>
          </div>

          {/* Action Button */}
          {link && (
            <div className="mt-2">
              <Button
                variant="outlined"
                fullWidth
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                endIcon={<LaunchIcon />}
                sx={{
                  color: '#1765a4',
                  borderColor: '#1765a4',
                  borderRadius: '12px',
                  textTransform: 'none',
                  fontWeight: 'bold',
                  padding: '8px 0',
                  '&:hover': {
                    backgroundColor: '#f0f7ff',
                    borderColor: '#124d7d',
                  }
                }}
              >
                Open Resource Link
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskModal;