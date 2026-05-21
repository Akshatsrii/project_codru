import React, { useState, useEffect, useRef, useMemo } from "react";
// We import them normally first...
import _Xarrow, { Xwrapper as _Xwrapper } from "react-xarrows";
import { motion } from "framer-motion"; 
import { Rocket } from "lucide-react";

// Child Components
import DraggableBox from "./DraggableBox";
import PlanetryAnimatedBackground from "./PlanetryAnimatedBackground";
import TaskModal from "./TaskModal";

// 🚨 THE CRASH FIX: Vite ESM Interop
// We manually unwrap the default exports so React doesn't crash on an object!
const Xarrow = (_Xarrow as any).default || _Xarrow;
const Xwrapper = (_Xwrapper as any)?.default || _Xwrapper || React.Fragment;
const MemoizedBackground = React.memo(PlanetryAnimatedBackground);

interface Task {
  week: number;
  question: string;
  answer: string;
  link: string;
}

interface Position {
  x: number;
  y: number;
}

const PlanetryPath = () => {
  const xIncrement = 220;
  const containerHeight = typeof window !== 'undefined' ? window.innerHeight - 200 : 800;

  const [positions, setPositions] = useState<Record<string, Position>>({});
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modalTaskId, setModalTaskId] = useState<number | null>(null);

  const [domReady, setDomReady] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [modalQuestion, setModalQuestion] = useState("");
  const [modalAnswer, setModalAnswer] = useState("");
  const [modalLink, setModalLink] = useState("");
  const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 });

  const containerWidth = Math.max(typeof window !== 'undefined' ? window.innerWidth : 1200, tasks.length * xIncrement + 400);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const token = localStorage.getItem("jwtoken");

  // Spaceship calculation
  const shipPosition = useMemo(() => {
    if (tasks.length === 0) return null;
    const lastTaskId = `task${tasks[tasks.length - 1].week}`;
    return positions[lastTaskId] || null;
  }, [tasks, positions]);

  const generateRandomYPosition = () => {
    const minY = 50;
    const maxY = containerHeight - 450;
    return Math.floor(Math.random() * (maxY - minY + 1)) + minY;
  };

  const fetchTasks = async () => {
    const response = await fetch(`${import.meta.env.VITE_API}get-tasks`, {
      method: "GET",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}` 
      },
    });
    return await response.json();
  };

  useEffect(() => {
    const loadTasks = async () => {
      if (!token) return;
      try {
        const fetchedTasks: Task[] = await fetchTasks();
        setTasks(fetchedTasks);
        const defaultPositions = fetchedTasks.reduce((acc, task, index) => {
          acc[`task${task.week}`] = { x: 50 + index * xIncrement, y: generateRandomYPosition() };
          return acc;
        }, {} as Record<string, Position>);
        setPositions(defaultPositions);
      } catch (err: any) { setError(err.message); }
    };
    loadTasks();
  }, [token]);

  useEffect(() => {
    if (tasks.length > 0 && Object.keys(positions).length > 0) {
      const timer = setTimeout(() => setDomReady(true), 150);
      return () => clearTimeout(timer);
    }
  }, [tasks, positions]);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    const handleWheel = (event: WheelEvent) => {
      if (scrollContainer) {
        event.preventDefault(); 
        scrollContainer.scrollLeft += event.deltaY;
      }
    };
    if (scrollContainer) {
      scrollContainer.addEventListener("wheel", handleWheel, { passive: false });
      return () => scrollContainer.removeEventListener("wheel", handleWheel);
    }
  }, []); 

  const handlePositionChange = (id: string, x: number, y: number) => {
    const newY = Math.min(Math.max(y, 50), containerHeight - 50);
    setPositions((prev) => ({ ...prev, [id]: { x, y: newY } }));
  };

  // 🚨 THE MOBILE TOUCH FIX 🚨
  const touchStartPos = useRef({ x: 0, y: 0 });

  const handleTouchStart = (e: React.TouchEvent | React.PointerEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.PointerEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.PointerEvent).clientY;
    touchStartPos.current = { x: clientX, y: clientY };
  };

  const handleTouchEnd = (taskId: string, e: React.TouchEvent | React.PointerEvent) => {
    const clientX = 'changedTouches' in e ? e.changedTouches[0].clientX : (e as React.PointerEvent).clientX;
    const clientY = 'changedTouches' in e ? e.changedTouches[0].clientY : (e as React.PointerEvent).clientY;
    
    const dx = Math.abs(clientX - touchStartPos.current.x);
    const dy = Math.abs(clientY - touchStartPos.current.y);
    
    // If the finger barely moved (less than 10 pixels), treat it as a tap/click!
    if (dx < 10 && dy < 10) {
      handleElementClick(taskId, e);
    }
  };

  const handleElementClick = (id: string, event: any) => {
    if (event.preventDefault) event.preventDefault();
    if (event.stopPropagation) event.stopPropagation();
    
    // Fallback to getElementById if currentTarget is swallowed by mobile touches
    const target = (event.currentTarget as HTMLElement) || document.getElementById(id);
    if (!target) return;

    const { x, y, width, height } = target.getBoundingClientRect();
    const modalX = x + window.scrollX + width / 2;
    const modalY = y + window.scrollY + height / 2;

    const clickedElementData = tasks.find((task) => `task${task.week}` === id);
    if (clickedElementData) {
      setModalTaskId(clickedElementData.week);
      setModalQuestion(clickedElementData.question);
      setModalAnswer(clickedElementData.answer);
      setModalLink(clickedElementData.link);
      setModalPosition({ x: modalX, y: modalY });
      setShowModal(true);
    }
  };

  if (error) return <div className="p-10 text-red-500">Error: {error}</div>;

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#090a0f]">
      
      {/* STICKY "i" BUTTON */}
      <div className="absolute top-6 right-6 z-100">
        <div className="group relative flex flex-col items-end">
          <button className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white font-display font-bold text-xl italic flex items-center justify-center transition-all duration-300 hover:scale-110 shadow-lg cursor-help">
             <span className="mb-0.5">i</span>
          </button>
          
          <div className="absolute top-14 right-0 w-72 p-5 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/50 text-slate-800 text-sm font-medium opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none transform origin-top-right scale-95 group-hover:scale-100 z-110">
            <p className="font-display font-bold text-brand-orange text-base mb-2">Your Unique Galaxy</p>
            <p className="leading-relaxed">
              Every star in the sky shines a little differently, and so do you! ✨
              <br /><br />
              You don't need to follow anyone else's footsteps. Let's create a universe that is entirely your own.
            </p>
          </div>
        </div>
      </div>

      <div className="planetry-scroll-container w-full h-full overflow-x-auto overflow-y-hidden absolute inset-0 custom-scrollbar" ref={scrollContainerRef}>
        <div className="planetry-scroll-content relative z-10 h-full" style={{ width: `${containerWidth}px` }}>
          <MemoizedBackground taskCount={tasks.length} />
          
          <Xwrapper>
            {/* THE PLANETS */}
            {tasks.map((task) => {
              const taskId = `task${task.week}`;
              return (
                <DraggableBox
                  key={taskId}
                  id={taskId}
                  onDrag={(x, y) => handlePositionChange(taskId, x, y)}
                  onClick={(e) => handleElementClick(taskId, e)}
                  // 🚨 Attaching the Mobile Handlers here
                  onTouchStart={handleTouchStart}
                  onTouchEnd={(e) => handleTouchEnd(taskId, e)}
                  style={{
                    left: positions[taskId]?.x || 0,
                    top: positions[taskId]?.y || 0,
                    position: 'absolute',
                    zIndex: 30,
                  }}
                />
              );
            })}

            {/* THE STAR TRAIL */}
            {domReady && tasks.slice(1).map((task, index) => {
              const startPos = positions[`task${tasks[index].week}`];
              const endPos = positions[`task${task.week}`];
              
              if (!startPos || !endPos) return null;

              return (
                <React.Fragment key={`trail-${task.week}`}>
                  <Xarrow
                    start={`task${tasks[index].week}`}
                    end={`task${task.week}`}
                    curveness={1.5}
                    color="rgba(255, 255, 255, 0.04)"
                    strokeWidth={18}
                    showHead={false}
                    zIndex={20}
                  />

                  <Xarrow
                    start={`task${tasks[index].week}`}
                    end={`task${task.week}`}
                    curveness={1.5}
                    color="white"
                    strokeWidth={1.8}
                    showHead={false}
                    dashness={{
                      animation: 0.4,
                      strokeLen: 1.2,
                      nonStrokeLen: 8
                    }}
                    zIndex={21}
                    passProps={{
                      style: { 
                        filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.9))',
                        opacity: 0.9 
                      }
                    }}
                  />
                </React.Fragment>
              );
            })}

            {/* THE VOYAGER SHIP */}
            {shipPosition && (
              <motion.div
                initial={false}
                animate={{ x: shipPosition.x + 20, y: shipPosition.y - 60 }}
                transition={{ type: "spring", stiffness: 40, damping: 12 }}
                className="absolute z-60 pointer-events-none"
                style={{ left: 0, top: 0 }}
              >
                <div className="flex flex-col items-center">
                  <Rocket className="text-brand-orange fill-brand-orange" size={36} />
                  <motion.div 
                    animate={{ height: [6, 12, 6], opacity: [0.3, 0.7, 0.3] }} 
                    transition={{ repeat: Infinity, duration: 0.4 }} 
                    className="w-1.5 bg-orange-500 rounded-full blur-[2px] mt-1" 
                  />
                </div>
              </motion.div>
            )}
          </Xwrapper>

          <TaskModal
            show={showModal}
            onClose={() => setShowModal(false)}
            taskId={modalTaskId}
            question={modalQuestion}
            answer={modalAnswer}
            link={modalLink}
            position={modalPosition}
          />
        </div>
      </div>
    </div>
  );
};

export default PlanetryPath;