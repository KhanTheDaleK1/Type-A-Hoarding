import React, { useEffect, useRef, useState } from 'react';
// Scanner component using html5-qrcode for barcode detection
import { Html5Qrcode } from 'html5-qrcode';
import { X, CameraOff, RefreshCw, Camera } from 'lucide-react';

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
      await html5QrCodeScanner.current.stop();
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
        fps: 15, 
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const size = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.8);
          return { width: size, height: Math.floor(size * 0.5) };
        },
        aspectRatio: 1.0,
      };

      const target = cameraId ? cameraId : { facingMode: "environment" };

      await html5QrCodeScanner.current.start(
        target,
        config,
        (decodedText) => {
          if (!scanLock.current) {
            scanLock.current = true;
            onScan(decodedText);
            setTimeout(() => { scanLock.current = false; }, 3000);
          }
        },
        () => {}
      );
      
      setIsInitializing(false);
    } catch (err: any) {
      console.error("Scanner: Startup FAILED:", err);
      setIsInitializing(false);
      setError(err.message || "Failed to start camera.");
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const devices = await Html5Qrcode.getCameras();
        setCameras(devices);
        await startScanner();
      } catch (e) {
        setError("Could not find any cameras.");
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
    const nextCam = cameras[nextIndex];
    setActiveCameraId(nextCam.id);
    startScanner(nextCam.id);
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black font-sans">
      <div id="reader" className="w-full h-full min-h-screen overflow-hidden bg-black"></div>

      {/* Manual Controls */}
      <div className="absolute bottom-8 left-0 right-0 z-[102] flex justify-center gap-6 pointer-events-none">
        {cameras.length > 1 && (
          <button 
            onClick={switchCamera}
            className="p-4 bg-white/10 backdrop-blur-md rounded-full text-white border border-white/20 pointer-events-auto hover:bg-white/20 transition-all"
          >
            <RefreshCw size={24} />
          </button>
        )}
        <button 
          onClick={() => startScanner(activeCameraId || undefined)}
          className="p-4 bg-white/10 backdrop-blur-md rounded-full text-white border border-white/20 pointer-events-auto hover:bg-white/20 transition-all"
        >
          <Camera size={24} />
        </button>
      </div>

      {(error || (isInitializing && !error)) && (
        <div className="absolute inset-0 z-[101] flex flex-col items-center justify-center bg-gray-900/95 p-8 text-center text-white backdrop-blur-md">
          {isInitializing ? (
            <div className="flex flex-col items-center gap-4">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent"></div>
              <p className="font-bold text-sm tracking-widest uppercase opacity-50">Opening Lens...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-6 animate-fade-in">
              <CameraOff size={48} className="text-danger opacity-50" />
              <p className="text-sm font-medium max-w-xs">{error}</p>
              <button onClick={() => startScanner()} className="px-8 py-3 bg-accent text-white rounded-full font-bold shadow-lg">Retry Camera</button>
            </div>
          )}
        </div>
      )}

      <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6">
        <div className="flex justify-between items-start pointer-events-auto">
          <div className="bg-black/40 backdrop-blur-xl rounded-2xl px-4 py-2 flex items-center gap-3 text-white border border-white/10 shadow-2xl">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse"></div>
            <span className="text-xs font-black uppercase tracking-widest">Scanner Live</span>
          </div>
          <button onClick={onClose} className="p-3 bg-black/40 backdrop-blur-xl rounded-2xl text-white border border-white/10 shadow-2xl pointer-events-auto">
            <X size={24} />
          </button>
        </div>

        <div className="flex flex-col items-center gap-6 mb-32">
          {status ? (
            <div className="bg-success text-white px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-[0_0_50px_rgba(16,185,129,0.5)] border border-white/20 animate-bounce">
              {status}
            </div>
          ) : (
            <div className="bg-black/20 backdrop-blur-md text-white/40 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.3em] border border-white/5">
              Focus Barcode
            </div>
          )}
        </div>
      </div>

      <style>{`
        #reader { border: none !important; position: relative; }
        #reader video { object-fit: cover !important; width: 100% !important; height: 100% !important; }
        #reader__scan_region { background: transparent !important; }
        #reader__scan_region > div { 
          border: 2px solid #aa3bff !important; 
          border-radius: 24px !important;
          box-shadow: 0 0 0 4000px rgba(0,0,0,0.5) !important;
        }
      `}</style>
    </div>
  );
};

export default Scanner;
