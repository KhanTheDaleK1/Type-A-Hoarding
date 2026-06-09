import React, { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X, Zap } from 'lucide-react';

interface ScannerProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
  status?: string;
}

const Scanner: React.FC<ScannerProps> = ({ onScan, onClose, status }) => {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    // Optimized for Barcodes
    scannerRef.current = new Html5QrcodeScanner(
      "reader",
      { 
        fps: 20, 
        qrbox: { width: 280, height: 180 },
        aspectRatio: 1.0,
        showTorchButtonIfSupported: true,
      },
      /* verbose= */ false
    );

    scannerRef.current.render(
      (decodedText) => {
        onScan(decodedText);
      },
      (_error) => {
        // Ignored for performance
      }
    );

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(e => console.error("Failed to clear scanner", e));
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black">
      {/* Scanner Viewport */}
      <div id="reader" className="w-full h-full max-h-screen overflow-hidden"></div>

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
        #reader video { object-fit: cover !important; }
        #reader__dashboard { display: none !important; }
        #reader__status_span { display: none !important; }
        #reader__camera_selection { 
          position: absolute; 
          bottom: 2rem; 
          left: 50%; 
          transform: translateX(-50%);
          background: rgba(0,0,0,0.5);
          color: white;
          padding: 8px;
          border-radius: 8px;
          z-index: 101;
          pointer-events: auto;
        }
        @keyframes scan {
          0%, 100% { transform: translateX(-100%); }
          50% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};

export default Scanner;
