import React, { useState, useEffect } from 'react';
import { Gamepad2, RotateCcw } from 'lucide-react';

const TicTacToe: React.FC = () => {
  const [board, setBoard] = useState<(string | null)[]>(Array(9).fill(null));
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [winner, setWinner] = useState<string | null>(null);

  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];

  const checkWinner = (squares: (string | null)[]) => {
    for (let [a, b, c] of lines) {
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) return squares[a];
    }
    return squares.includes(null) ? null : 'Draw';
  };

  // 🧠 Unbeatable Minimax Algorithm (Kept from the upgrade)
  const minimax = (squares: (string | null)[], depth: number, isMaximizing: boolean): number => {
    const result = checkWinner(squares);
    if (result === 'O') return 10 - depth;
    if (result === 'X') return depth - 10;
    if (result === 'Draw') return 0;

    if (isMaximizing) {
      let bestScore = -Infinity;
      for (let i = 0; i < 9; i++) {
        if (!squares[i]) {
          squares[i] = 'O';
          let score = minimax(squares, depth + 1, false);
          squares[i] = null;
          bestScore = Math.max(score, bestScore);
        }
      }
      return bestScore;
    } else {
      let bestScore = Infinity;
      for (let i = 0; i < 9; i++) {
        if (!squares[i]) {
          squares[i] = 'X';
          let score = minimax(squares, depth + 1, true);
          squares[i] = null;
          bestScore = Math.min(score, bestScore);
        }
      }
      return bestScore;
    }
  };

  const getBestMove = (currentBoard: (string | null)[]) => {
    let bestScore = -Infinity;
    let move;
    for (let i = 0; i < 9; i++) {
      if (!currentBoard[i]) {
        currentBoard[i] = 'O';
        let score = minimax(currentBoard, 0, false);
        currentBoard[i] = null;
        if (score > bestScore) {
          bestScore = score;
          move = i;
        }
      }
    }
    return move;
  };

  const handleClick = (index: number) => {
    if (board[index] || winner || !isPlayerTurn) return;
    const newBoard = [...board];
    newBoard[index] = 'X';
    setBoard(newBoard);
    setIsPlayerTurn(false);
  };

  useEffect(() => {
    const currentWinner = checkWinner(board);
    if (currentWinner) return setWinner(currentWinner);

    if (!isPlayerTurn && !winner) {
      const timer = setTimeout(() => {
        const move = getBestMove([...board]);
        if (move !== undefined) {
          const newBoard = [...board];
          newBoard[move] = 'O';
          setBoard(newBoard);
          setIsPlayerTurn(true);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isPlayerTurn, board, winner]);

  // 🎨 Restored Original UI
  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center w-full h-full max-w-sm mx-auto">
      <h3 className="font-display font-bold text-lg text-gray-800 mb-4 flex items-center gap-2 w-full">
        <Gamepad2 className="text-brand-blue" /> Tic-Tac-Toe
      </h3>
      
      <div className="grid grid-cols-3 gap-2 mb-4 bg-gray-100 p-2 rounded-2xl w-full flex-1">
        {board.map((cell, idx) => (
          <button
            key={idx}
            onClick={() => handleClick(idx)}
            disabled={cell !== null || !isPlayerTurn || !!winner}
            className={`w-full h-full min-h-16 sm:min-h-20 bg-white rounded-xl text-3xl font-black transition-all ${
              !cell && isPlayerTurn && !winner ? 'hover:bg-blue-50 cursor-pointer active:scale-95' : 'cursor-default'
            } ${cell === 'X' ? 'text-brand-blue' : 'text-brand-orange'}`}
          >
            {cell}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between w-full mt-auto pt-2">
        <span className="text-sm font-bold text-gray-500">
          {winner === 'Draw' ? "Draw!" : winner === 'X' ? '🎉 You Won!' : winner === 'O' ? '🤖 AI Won!' : isPlayerTurn ? 'Your Turn' : 'Thinking...'}
        </span>
        <button 
          onClick={() => { setBoard(Array(9).fill(null)); setIsPlayerTurn(true); setWinner(null); }} 
          className="p-2 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-200 transition"
        >
          <RotateCcw size={16} />
        </button>
      </div>
    </div>
  );
};

export default TicTacToe;