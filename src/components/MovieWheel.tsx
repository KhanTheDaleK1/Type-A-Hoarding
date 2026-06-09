import React, { useState } from 'react';
import type { Item } from '../types';
import { X, Play, RefreshCw, CheckCircle } from 'lucide-react';

interface MovieWheelProps {
  items: Item[];
  onClose: () => void;
  onWatched: (item: Item) => void;
}

const MovieWheel: React.FC<MovieWheelProps> = ({ items, onClose, onWatched }) => {
  const [spinning, setSpinning] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [rotation, setRotation] = useState(0);

  // Only include items that haven't been watched
  const unwatchedItems = items.filter(i => !i.watched);

  const spin = () => {
    if (unwatchedItems.length === 0 || spinning) return;

    setSpinning(true);
    setSelectedItem(null);

    // Calculate a random rotation (at least 5 full spins + extra)
    const extraDegrees = Math.floor(Math.random() * 360);
    const totalRotation = rotation + (360 * 5) + extraDegrees;
    setRotation(totalRotation);

    // Simulate the spin time
    setTimeout(() => {
      const finalIndex = Math.floor(Math.random() * unwatchedItems.length);
      setSelectedItem(unwatchedItems[finalIndex]);
      setSpinning(false);
    }, 3000);
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 overflow-hidden">
      <button 
        onClick={onClose}
        className="absolute top-6 right-6 p-3 bg-white/10 rounded-full text-white hover:bg-white/20 transition-all z-[151]"
      >
        <X size={28} />
      </button>

      <div className="w-full max-w-lg flex flex-col items-center gap-12">
        <header className="text-center space-y-2">
          <h2 className="text-4xl font-black text-white tracking-tight">Movie Roulette</h2>
          <p className="text-white/40 font-bold uppercase tracking-widest text-xs">
            {unwatchedItems.length} options remaining
          </p>
        </header>

        {/* The Wheel Visual */}
        <div className="relative group">
          <div 
            className="w-72 h-72 md:w-96 md:h-96 rounded-full border-8 border-white/10 relative overflow-hidden transition-transform duration-[3000ms] cubic-bezier(0.15, 0, 0.15, 1)"
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            {/* Slices or just a pattern */}
            <div className="absolute inset-0 bg-gradient-to-tr from-accent to-purple-600 opacity-20"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-4 h-4 bg-white rounded-full shadow-[0_0_20px_white]"></div>
            </div>
            {/* Spinning decorative elements */}
            {[...Array(12)].map((_, i) => (
              <div 
                key={i} 
                className="absolute top-1/2 left-1/2 w-1 h-1/2 bg-white/20 origin-top -translate-x-1/2"
                style={{ transform: `rotate(${i * 30}deg)` }}
              ></div>
            ))}
          </div>
          
          {/* Pointer */}
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 bg-white rotate-45 rounded-sm shadow-2xl z-10"></div>
        </div>

        {selectedItem ? (
          <div className="flex flex-col items-center gap-6 animate-fade-in text-center">
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-accent">Tonight's Pick</span>
              <h3 className="text-3xl font-black text-white px-4">{selectedItem.title}</h3>
            </div>
            
            <div className="flex gap-4">
              <button 
                onClick={() => onWatched(selectedItem)}
                className="flex items-center gap-2 px-8 py-3 bg-success text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:opacity-90 transition-all"
              >
                <CheckCircle size={18} /> Mark as Watched
              </button>
              <button 
                onClick={spin}
                className="flex items-center gap-2 px-8 py-3 bg-white/10 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-white/20 transition-all"
              >
                <RefreshCw size={18} /> Respin
              </button>
            </div>
          </div>
        ) : (
          <button 
            onClick={spin}
            disabled={spinning || unwatchedItems.length === 0}
            className={`group relative flex flex-col items-center gap-4 ${spinning ? 'opacity-50' : ''}`}
          >
            <div className="w-24 h-24 rounded-full bg-accent flex items-center justify-center text-white shadow-[0_0_50px_rgba(170,59,255,0.5)] group-hover:scale-110 transition-transform">
              {spinning ? <RefreshCw size={40} className="animate-spin" /> : <Play size={40} fill="currentColor" />}
            </div>
            <span className="font-black uppercase tracking-[0.4em] text-white text-[10px]">
              {spinning ? 'Choosing...' : 'Tap to Spin'}
            </span>
          </button>
        )}

        {unwatchedItems.length === 0 && (
          <p className="text-danger font-black uppercase text-xs tracking-widest bg-danger/10 px-4 py-2 rounded-full">
            No unwatched movies left!
          </p>
        )}
      </div>
    </div>
  );
};

export default MovieWheel;
