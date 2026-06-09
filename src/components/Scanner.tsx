import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Zap, CameraOff } from 'lucide-react';

interface ScannerProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
  status?: string;
}

const Scanner: React.FC<ScannerProps> = ({ onScan, onClose, status }) => {
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const html5QrCodeScanner = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    const startScanner = async () => {
      try {
        setIsInitializing(true);
        setError(null);

        // Check for secure context
        if (!window.isSecureContext && window.location.hostname !== 'localhost') {
          throw new Error('Camera access requires an HTTPS connection. Please use a secure URL.');
        }

        html5QrCodeScanner.current = new Html5Qrcode("reader");
        
        const config = { 
          fps: 20, 
          qrbox: { width: 280, height: 180 },
          aspectRatio: 1.0,
        };

        // Try to start with back camera by default
        await html5QrCodeScanner.current.start(
          { facingMode: "environment" },
          config,
          (decodedText) => {
            onScan(decodedText);
          },
          () => {
            // Error callback for every frame, ignored
          }
        );
        
        setIsInitializing(false);
      } catch (err: any) {
        console.error("Scanner startup failed:", err);
        setIsInitializing(false);
        if (err.message?.includes("Permission denied")) {
          setError("Camera permission denied. Please enable it in your browser settings.");
        } else if (err.message?.includes("not found")) {
          setError("No camera found on this device.");
        } else {
          setError(err.message || "Failed to start camera.");
        }
      }
    };

    startScanner();

    return () => {
      if (html5QrCodeScanner.current && html5QrCodeScanner.current.isScanning) {
        html5QrCodeScanner.current.stop().catch(e => console.error("Failed to stop scanner", e));
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black">
      {/* Scanner Viewport */}
      <div id="reader" className="w-full h-full max-h-screen overflow-hidden"></div>

      {/* Error / Loading State */}
      {(error || isInitializing) && (
        <div className="absolute inset-0 z-[101] flex flex-col items-center justify-center bg-gray-900/90 p-8 text-center text-white backdrop-blur-sm">
          {isInitializing ? (
            <div className="flex flex-col items-center gap-4">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-accent border-t-transparent"></div>
              <p className="font-bold tracking-tight">Initializing Camera...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-6 animate-fade-in">
              <div className="bg-danger/20 p-4 rounded-full">
                <CameraOff size={48} className="text-danger" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold">Camera Error</h3>
                <p className="text-sm opacity-70 max-w-xs mx-auto">{error}</p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => window.location.reload()}
                  className="px-6 py-2 bg-white text-black rounded-full font-bold text-sm hover:bg-gray-200"
                >
                  Retry
                </button>
                <button 
                  onClick={onClose}
                  className="px-6 py-2 bg-gray-700 text-white rounded-full font-bold text-sm hover:bg-gray-600"
                >
                  Go Back
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Overlay UI */}
      <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6">
        <div className="flex justify-between items-start pointer-events-auto">
          <div className="bg-black/50 backdrop-blur-md rounded-full px-4 py-2 flex items-center gap-2 text-white border border-white/10">
            <Zap size={18} className="text-yellow-400" fill="currentColor" />
            <span className="text-sm font-bold tracking-tight">Active Scanner</span>
          </div>
          <button 
            onClick={onClose}
            className="p-3 bg-black/50 backdrop-blur-md rounded-full text-white border border-white/10 pointer-events-auto"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex flex-col items-center gap-4 mb-20">
          {status ? (
            <div className="bg-accent text-white px-6 py-3 rounded-2xl font-bold animate-pulse shadow-2xl border border-white/20">
              {status}
            </div>
          ) : (
            <div className="bg-black/40 backdrop-blur-sm text-white/70 px-4 py-2 rounded-full text-xs uppercase tracking-[0.2em] font-black border border-white/5">
              Align Barcode in Center
            </div>
          )}
          
          <div className="w-64 h-1 bg-white/10 rounded-full overflow-hidden relative">
            <div className="absolute inset-0 bg-accent animate-[scan_2s_ease-in-out_infinite]"></div>
          </div>
        </div>
      </div>

      <style>{`
        #reader { border: none !important; }
        #reader video { object-fit: cover !important; width: 100% !important; height: 100% !important; }
        @keyframes scan {
          0%, 100% { transform: translateX(-100%); }
          50% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};

export default Scanner;
