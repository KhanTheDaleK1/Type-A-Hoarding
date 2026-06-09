import React, { useRef, useState, useEffect } from 'react';
import { X, Camera, RefreshCw } from 'lucide-react';

interface CameraCaptureProps {
  onCapture: (image: string) => void;
  onClose: () => void;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const startCamera = async () => {
      try {
        setIsInitializing(true);
        const s = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'environment',
            width: { ideal: 4096 }, // Try for 4K
            height: { ideal: 2160 },
            focusMode: "continuous",
            whiteBalanceMode: "continuous"
          } as any, 
          audio: false 
        });
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
        setIsInitializing(false);
      } catch (err) {
        console.error("Camera capture start failed:", err);
        setError('Camera access denied or not available.');
        setIsInitializing(false);
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Track state cleanup fix
  const stopStream = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Target a maximum of 1200px on the longest side for storage efficiency
      const MAX_DIM = 1200;
      let width = video.videoWidth;
      let height = video.videoHeight;

      if (width > height) {
        if (width > MAX_DIM) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        }
      } else {
        if (height > MAX_DIM) {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }
      }

      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8); // Reasonable quality
        onCapture(dataUrl);
        stopStream();
      }
    }
  };

  const handleClose = () => {
    stopStream();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center overflow-hidden">
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        className="w-full h-full object-cover"
      />
      <canvas ref={canvasRef} className="hidden" />
      
      <div className="absolute inset-0 flex flex-col justify-between p-6 pointer-events-none">
        <div className="flex justify-between items-start pointer-events-auto">
          <div className="bg-black/40 backdrop-blur-xl rounded-2xl px-4 py-2 flex items-center gap-3 text-white border border-white/10 shadow-2xl">
            <Camera size={18} className="text-accent" />
            <span className="text-xs font-black uppercase tracking-widest">Photo Mode</span>
          </div>
          <button 
            onClick={handleClose} 
            className="p-3 bg-black/40 backdrop-blur-xl rounded-2xl text-white border border-white/10 shadow-2xl pointer-events-auto active:scale-90 transition-all"
          >
            <X size={24} />
          </button>
        </div>
        
        <div className="flex flex-col items-center gap-4 mb-12 pointer-events-auto">
          <button 
            onClick={takePhoto}
            className="w-20 h-20 bg-white rounded-full border-8 border-white/20 shadow-[0_0_50px_rgba(0,0,0,0.5)] flex items-center justify-center active:scale-75 transition-all group"
          >
            <div className="w-14 h-14 rounded-full border-2 border-black/10 bg-white group-active:bg-gray-200 transition-colors" />
          </button>
          <span className="text-white text-[10px] font-black uppercase tracking-[0.4em] drop-shadow-lg">Capture</span>
        </div>
      </div>
      
      {isInitializing && (
        <div className="absolute inset-0 bg-black flex flex-col items-center justify-center gap-4 text-white">
          <RefreshCw className="animate-spin text-accent" size={40} />
          <p className="text-xs font-black uppercase tracking-widest opacity-50">Lining up shots...</p>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 bg-gray-900 flex flex-col items-center justify-center gap-6 text-white p-8 text-center">
          <div className="w-16 h-16 bg-danger/20 rounded-full flex items-center justify-center">
            <X className="text-danger" size={32} />
          </div>
          <p className="font-bold text-sm">{error}</p>
          <button onClick={handleClose} className="px-8 py-3 bg-white text-black rounded-full font-bold text-sm">Go Back</button>
        </div>
      )}
    </div>
  );
};

export default CameraCapture;
