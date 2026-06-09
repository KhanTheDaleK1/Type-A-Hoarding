import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, CameraOff, RefreshCw, Camera, Zap } from 'lucide-react';

interface ScannerProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
  status?: string;
}

const Scanner: React.FC<ScannerProps> = ({ onScan, onClose, status }) => {
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [cameras, setCameras] = useState<any[]>([]);
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);
  const html5QrCodeScanner = useRef<Html5Qrcode | null>(null);
  const scanLock = useRef<boolean>(false);

  const stopScanner = async () => {
    if (html5QrCodeScanner.current && html5QrCodeScanner.current.isScanning) {
      try {
        await html5QrCodeScanner.current.stop();
      } catch (e) {
        console.error("Stop failed", e);
      }
    }
  };

  const startScanner = async (cameraId?: string) => {
    try {
      setIsInitializing(true);
      setError(null);
      await stopScanner();

      if (!html5QrCodeScanner.current) {
        html5QrCodeScanner.current = new Html5Qrcode("reader");
      }

      const config = { 
        fps: 30, // Maximum frame rate for smoothness
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          // Optimized for 1D barcodes (Wide rectangle)
          const width = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.9);
          const height = Math.floor(width * 0.4);
          return { width, height };
        },
        aspectRatio: 1.0,
        // High-Quality Camera Constraints
        videoConstraints: {
          facingMode: "environment",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          focusMode: "continuous",
          whiteBalanceMode: "continuous"
        } as any,
        formatsToSupport: [ 
          Html5QrcodeSupportedFormats.EAN_13, 
          Html5QrcodeSupportedFormats.UPC_A, 
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.QR_CODE // Also support our Share QRs
        ]
      };

      const target = cameraId ? cameraId : { facingMode: "environment" };

      await html5QrCodeScanner.current.start(
        target,
        config,
        (decodedText) => {
          if (!scanLock.current) {
            // Haptic Feedback (Modern PWA requirement)
            if ('vibrate' in navigator) navigator.vibrate(100);
            
            scanLock.current = true;
            onScan(decodedText);
            // 3s lockout to show status message
            setTimeout(() => { scanLock.current = false; }, 3000);
          }
        },
        () => {} // Silent frame errors
      );
      
      setIsInitializing(false);
    } catch (err: any) {
      console.error("Scanner startup failed:", err);
      setIsInitializing(false);
      setError(err.message || "Could not access camera.");
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const devices = await Html5Qrcode.getCameras();
        setCameras(devices);
        await startScanner();
      } catch (e) {
        setError("No cameras found.");
        setIsInitializing(false);
      }
    };
    init();

    return () => {
      stopScanner().catch(console.error);
    };
  }, []);

  const switchCamera = () => {
    if (cameras.length < 2) return;
    const currentIndex = cameras.findIndex(c => c.id === activeCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    setActiveCameraId(cameras[nextIndex].id);
    startScanner(cameras[nextIndex].id);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center overflow-hidden font-sans">
      <div id="reader" className="w-full h-full object-cover"></div>

      {/* Viewfinder Spotlight Mask */}
      <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
        <div className="w-full h-full border-[rgba(0,0,0,0.6)] border-y-[25vh] border-x-[10vw] flex items-center justify-center">
           <div className="w-full h-full max-w-[80vw] max-h-[25vh] border-2 border-accent rounded-3xl relative shadow-[0_0_0_1000px_rgba(0,0,0,0.4)]">
              {/* Laser Animation */}
              <div className="absolute left-4 right-4 top-1/2 h-1 bg-accent/50 shadow-[0_0_15px_#aa3bff] animate-[scan_2s_ease-in-out_infinite]" />
           </div>
        </div>
      </div>

      {/* UI Overlays */}
      <div className="absolute inset-0 flex flex-col justify-between p-6 pointer-events-none">
        <div className="flex justify-between items-start pointer-events-auto">
          <div className="bg-black/40 backdrop-blur-xl rounded-2xl px-4 py-2 flex items-center gap-3 text-white border border-white/10 shadow-2xl">
            <Zap size={18} className="text-yellow-400" fill="currentColor" />
            <span className="text-xs font-black uppercase tracking-widest">Ultimate Scanner</span>
          </div>
          <button 
            onClick={onClose} 
            className="p-3 bg-black/40 backdrop-blur-xl rounded-2xl text-white border border-white/10 shadow-2xl pointer-events-auto active:scale-90 transition-all"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex flex-col items-center gap-6 mb-24 text-center">
          {status ? (
            <div className="bg-success text-white px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-[0_0_50px_rgba(16,185,129,0.5)] border border-white/20 animate-bounce">
              {status}
            </div>
          ) : (
            <div className="bg-black/20 backdrop-blur-md text-white/60 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.3em] border border-white/5">
              Align Code in Center
            </div>
          )}

          <div className="flex gap-4 pointer-events-auto mt-4">
             {cameras.length > 1 && (
               <button onClick={switchCamera} className="p-4 bg-white/10 backdrop-blur-md rounded-full text-white border border-white/20 active:scale-75 transition-all">
                 <RefreshCw size={24} />
               </button>
             )}
             <button onClick={() => startScanner(activeCameraId || undefined)} className="p-4 bg-white/10 backdrop-blur-md rounded-full text-white border border-white/20 active:scale-75 transition-all">
               <Camera size={24} />
             </button>
          </div>
        </div>
      </div>

      {(error || isInitializing) && (
        <div className="absolute inset-0 bg-gray-900/95 z-[201] flex flex-col items-center justify-center p-8 text-center text-white backdrop-blur-md">
           {isInitializing ? (
             <div className="flex flex-col items-center gap-4">
               <RefreshCw className="animate-spin text-accent" size={40} />
               <p className="text-xs font-black uppercase tracking-[0.2em] opacity-40">Waking Hardware...</p>
             </div>
           ) : (
             <div className="space-y-6 animate-in fade-in zoom-in-95">
               <CameraOff size={64} className="text-danger mx-auto opacity-50" />
               <div>
                  <h3 className="text-xl font-black mb-2">Camera Error</h3>
                  <p className="text-sm opacity-60 max-w-xs mx-auto leading-relaxed">{error}</p>
               </div>
               <div className="flex gap-3 justify-center">
                  <button onClick={() => startScanner()} className="px-8 py-3 bg-white text-black rounded-full font-black text-xs uppercase tracking-widest">Retry</button>
                  <button onClick={onClose} className="px-8 py-3 bg-white/10 text-white rounded-full font-black text-xs uppercase tracking-widest">Close</button>
               </div>
             </div>
           )}
        </div>
      )}

      <style>{`
        #reader { border: none !important; }
        #reader video { object-fit: cover !important; width: 100% !important; height: 100% !important; }
        #reader__scan_region { background: transparent !important; }
        #reader__scan_region > div { display: none !important; }
        @keyframes scan {
          0%, 100% { transform: translateY(-12vh); opacity: 0.1; }
          50% { transform: translateY(12vh); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default Scanner;
