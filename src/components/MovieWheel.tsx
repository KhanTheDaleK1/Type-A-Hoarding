import React, { useState, useEffect, useRef } from 'react';
import type { Item } from '../types';
import { X, Play, RefreshCw, CheckCircle, Sparkles } from 'lucide-react';

interface MovieWheelProps {
  items: Item[];
  collectionType?: string;
  onClose: () => void;
  onWatched: (item: Item) => void;
}

const MovieWheel: React.FC<MovieWheelProps> = ({ items, collectionType, onClose, onWatched }) => {
  const [spinning, setSpinning] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [wheelItems, setWheelItems] = useState<Item[]>([]);

  const wheelRef = useRef<SVGSVGElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animationRef = useRef<number | null>(null);
  const currentRotationRef = useRef<number>(0);

  // Available items (previously filtered for unwatched)
  const availableItems = items;

  // Initialize and select a random subset of up to 10 items for the wheel
  const selectWheelItems = () => {
    if (items.length === 0) {
      setWheelItems([]);
      return;
    }
    // Shuffle and pick up to 10
    const shuffled = [...items].sort(() => 0.5 - Math.random());
    setWheelItems(shuffled.slice(0, 10));
  };

  useEffect(() => {
    selectWheelItems();
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(console.error);
      }
    };
  }, [items]);

  const initAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };

  const playTickSound = (audioCtx: AudioContext, frequency = 600, duration = 0.05) => {
    try {
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc.type = 'triangle'; // Clicky yet soft
      osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
      
      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
      
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      console.warn('Audio play error', e);
    }
  };

  const spin = () => {
    if (wheelItems.length === 0 || spinning) return;

    initAudio();
    const audioCtx = audioCtxRef.current;
    if (!audioCtx) return;

    setSpinning(true);
    setSelectedItem(null);

    // Pick a winning index
    const winIndex = Math.floor(Math.random() * wheelItems.length);
    const winningItem = wheelItems[winIndex];

    const N = wheelItems.length;
    const sliceAngle = 360 / N;
    
    // Middle of the winning slice
    const winAngle = (winIndex + 0.5) * sliceAngle;
    
    // Add small random offset so it doesn't land exactly in the center
    const offset = (Math.random() - 0.5) * (sliceAngle * 0.7);
    
    // Target rotation to align the slice center with the top pointer (at -90 deg standard coordinates)
    const baseSpins = 360 * 5; // 5 full rotations
    const currentMod = currentRotationRef.current % 360;
    const targetMod = (270 - winAngle + offset + 360) % 360;
    
    let delta = targetMod - currentMod;
    if (delta <= 0) delta += 360;

    const totalRotation = currentRotationRef.current + baseSpins + delta;

    // Physics parameters
    const friction = 0.985;
    const startRotation = currentRotationRef.current;
    const distance = totalRotation - startRotation;
    let velocity = distance * (1 - friction);
    let currentRotation = startRotation;

    let lastSlice = Math.floor(currentRotation / sliceAngle);

    const animate = () => {
      currentRotation += velocity;
      velocity *= friction;

      if (wheelRef.current) {
        wheelRef.current.style.transform = `rotate(${currentRotation}deg)`;
      }

      // Check boundary crossings for audio feedback
      const currentSlice = Math.floor(currentRotation / sliceAngle);
      if (currentSlice !== lastSlice) {
        const speedRatio = Math.min(velocity, 40);
        // Play click sound with pitch and duration scaled by speed
        const freq = 350 + speedRatio * 15;
        const dur = 0.01 + Math.max(0, 0.04 - velocity * 0.001);
        playTickSound(audioCtx, freq, dur);
        lastSlice = currentSlice;
      }

      if (velocity > 0.03) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        // Snap to final rotation
        currentRotation = totalRotation;
        if (wheelRef.current) {
          wheelRef.current.style.transform = `rotate(${currentRotation}deg)`;
        }
        currentRotationRef.current = totalRotation;
        
        // Haptic feedback if supported
        if ('vibrate' in navigator) navigator.vibrate([150, 50, 150]);
        
        setSelectedItem(winningItem);
        setSpinning(false);
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  };

  // Helper to construct the path of each wheel slice
  const getSlicePath = (index: number, total: number) => {
    const angleStart = (index * 360) / total;
    const angleEnd = ((index + 1) * 360) / total;
    
    // Offset by -90 deg so slice 0 starts at the top
    const radStart = ((angleStart - 90) * Math.PI) / 180;
    const radEnd = ((angleEnd - 90) * Math.PI) / 180;
    
    const R = 190;
    const CX = 200;
    const CY = 200;
    
    const x1 = CX + R * Math.cos(radStart);
    const y1 = CY + R * Math.sin(radStart);
    const x2 = CX + R * Math.cos(radEnd);
    const y2 = CY + R * Math.sin(radEnd);
    
    return `M ${CX} ${CY} L ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2} Z`;
  };

  const handleRespin = () => {
    selectWheelItems();
    setSelectedItem(null);
    // Small delay to let React update the wheel items before spinning
    setTimeout(() => {
      spin();
    }, 100);
  };

  const N = wheelItems.length;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 overflow-hidden text-white">
      <button 
        onClick={onClose}
        className="absolute top-6 right-6 icon-button bg-white/10 hover:bg-white/20 transition-all z-[151]"
      >
        <X size={28} />
      </button>

      <div className="w-full max-w-lg flex flex-col items-center gap-10">
        <header className="text-center space-y-2">
          <h2 className="text-4xl font-black text-white tracking-tight bg-gradient-to-r from-accent to-purple-400 bg-clip-text text-transparent">
            {collectionType === 'Books' ? 'Book' : 'Movie'} Roulette
          </h2>
          <p className="text-white/40 font-bold uppercase tracking-widest text-xs">
            {availableItems.length} options remaining
          </p>
        </header>

        {/* The Wheel Container */}
        {N > 0 ? (
          <div className="relative flex items-center justify-center p-4">
            {/* Pointer */}
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-8 bg-accent rotate-45 rounded-sm shadow-[0_0_20px_#aa3bff] z-10 border-2 border-white pointer-events-none" />
            
            {/* Outer Glow Ring */}
            <div className="absolute w-[296px] h-[296px] md:w-[396px] md:h-[396px] rounded-full border border-white/5 bg-gradient-to-tr from-accent/10 to-purple-600/10 blur-xl -z-10 pointer-events-none" />

            <svg 
              ref={wheelRef}
              viewBox="0 0 400 400"
              className="w-72 h-72 md:w-96 md:h-96 rounded-full border-8 border-white/10 shadow-[0_0_35px_rgba(0,0,0,0.6)] select-none pointer-events-none"
              style={{ transform: `rotate(${currentRotationRef.current}deg)`, transformOrigin: 'center center' }}
            >
              <defs>
                {wheelItems.map((_, i) => {
                  const hueStart = (i * 360) / N;
                  const hueEnd = ((i + 0.6) * 360) / N;
                  return (
                    <linearGradient id={`slice-grad-${i}`} key={i} x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={`hsl(${hueStart}, 85%, 55%)`} />
                      <stop offset="100%" stopColor={`hsl(${hueEnd}, 90%, 35%)`} />
                    </linearGradient>
                  );
                })}
              </defs>

              {/* Slices */}
              {wheelItems.map((item, i) => {
                const angleStart = (i * 360) / N;
                const angleEnd = ((i + 1) * 360) / N;
                // Calculate mid-angle in degrees, offset by -90 so index 0 starts at the top
                const midAngle = angleStart + (angleEnd - angleStart) / 2 - 90;
                
                const displayTitle = item.title.length > 20 
                  ? item.title.substring(0, 18) + '...' 
                  : item.title;

                return (
                  <g key={item.id}>
                    <path 
                      d={getSlicePath(i, N)} 
                      fill={`url(#slice-grad-${i})`}
                      stroke="rgba(255,255,255,0.15)"
                      strokeWidth="2.5"
                    />
                    <g transform={`rotate(${midAngle}, 200, 200)`}>
                      <text
                        x={365}
                        y={200}
                        textAnchor="end"
                        dominantBaseline="middle"
                        fill="#ffffff"
                        className="font-black text-[9px] md:text-[11px] uppercase tracking-wider select-none"
                        style={{ 
                          textShadow: '0 2px 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.6)'
                        }}
                      >
                        {displayTitle}
                      </text>
                    </g>
                  </g>
                );
              })}

              {/* Center Hub */}
              <circle cx="200" cy="200" r="32" fill="#15151a" stroke="rgba(255,255,255,0.15)" strokeWidth="4" />
              <circle cx="200" cy="200" r="14" fill="#aa3bff" className="animate-pulse" />
            </svg>
          </div>
        ) : (
          <div className="py-12 text-center text-white/50 font-bold uppercase tracking-wider">
            No items available
          </div>
        )}

        {selectedItem ? (
          <div className="flex flex-col items-center gap-6 animate-in fade-in duration-300 text-center px-4 w-full">
            <div className="space-y-3">
              <div className="flex justify-center items-center gap-2">
                <Sparkles className="text-yellow-400 animate-bounce" size={24} />
                <span className="text-[11px] font-black uppercase tracking-[0.3em] text-accent">Tonight's Selection</span>
              </div>
              <h3 className="text-3xl font-black text-white leading-tight max-w-sm mx-auto drop-shadow-lg">{selectedItem.title}</h3>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs sm:max-w-md mt-2">
              <button 
                onClick={() => onWatched(selectedItem)}
                className="flex items-center justify-center gap-2 px-6 py-4 bg-success text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:opacity-90 active:scale-95 transition-all w-full"
              >
                <CheckCircle size={18} /> Mark as {collectionType === 'Books' ? 'Read' : 'Watched'}
              </button>
              <button 
                onClick={handleRespin}
                className="flex items-center justify-center gap-2 px-6 py-4 bg-white/10 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-white/20 active:scale-95 transition-all w-full"
              >
                <RefreshCw size={18} /> Respin
              </button>
            </div>
          </div>
        ) : (
          <button 
            onClick={spin}
            disabled={spinning || N === 0}
            className={`group relative flex flex-col items-center gap-4 transition-all duration-300 ${spinning ? 'opacity-40 scale-95 pointer-events-none' : 'hover:scale-105 active:scale-95'}`}
          >
            <div className="w-24 h-24 rounded-full bg-accent flex items-center justify-center text-white shadow-[0_0_40px_rgba(170,59,255,0.4)] group-hover:shadow-[0_0_60px_rgba(170,59,255,0.7)] transition-all">
              {spinning ? <RefreshCw size={36} className="animate-spin" /> : <Play size={36} className="ml-1" fill="currentColor" />}
            </div>
            <span className="font-black uppercase tracking-[0.4em] text-white/70 text-[10px]">
              {spinning ? 'Choosing...' : 'Tap to Spin'}
            </span>
          </button>
        )}

        {availableItems.length === 0 && (
          <p className="text-danger font-black uppercase text-xs tracking-widest bg-danger/10 px-6 py-3 rounded-2xl border border-danger/20">
            No options left!
          </p>
        )}
      </div>
    </div>
  );
};

export default MovieWheel;
