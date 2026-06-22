import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { ArrowLeft, Printer, Plus, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Link } from 'react-router-dom';

const LocationsView: React.FC = () => {
  const locations = useLiveQuery(() => db.locations.toArray());
  const [showPrintModal, setShowPrintModal] = useState<string | null>(null);

  const printLocation = locations?.find(l => l.id === showPrintModal);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="pb-20">
      <header className="sticky top-0 bg-bg/80 backdrop-blur-md z-40 border-b border-border py-4 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="icon-button"><ArrowLeft size={24} /></Link>
          <h1 className="text-xl font-black">Locations Manager</h1>
        </div>
        <button className="icon-button accent shadow-xl">
          <Plus size={24} />
        </button>
      </header>

      <div className="p-4 space-y-4">
        {locations?.map(loc => (
          <div key={loc.id} className="bg-bg-secondary border border-border p-4 rounded-xl flex items-center justify-between">
            <div>
              <h3 className="font-bold text-lg">{loc.name}</h3>
              <p className="text-xs opacity-60 font-mono mt-1">{loc.id}</p>
              <p className="text-sm opacity-80 mt-1">{loc.description}</p>
            </div>
            <button 
              onClick={() => setShowPrintModal(loc.id)}
              className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-lg font-bold shadow-md hover:bg-accent-hover transition-all"
            >
              <Printer size={18} />
              Print Label
            </button>
          </div>
        ))}
      </div>

      {showPrintModal && printLocation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white text-black p-8 rounded-2xl w-full max-w-sm flex flex-col items-center shadow-2xl relative print-modal">
            <button 
              onClick={() => setShowPrintModal(null)}
              className="absolute top-2 right-2 p-2 hover:bg-gray-100 rounded-full no-print"
            >
              <X size={24} />
            </button>
            
            <h2 className="text-2xl font-black mb-1 text-center">{printLocation.name}</h2>
            <p className="text-sm text-gray-500 mb-6 uppercase tracking-widest font-bold">Hoard Location Tag</p>
            
            <div className="bg-white p-4 rounded-xl border-4 border-black">
              <QRCodeSVG 
                value={printLocation.id} 
                size={200}
                level="H"
              />
            </div>
            
            <p className="mt-4 font-mono text-lg tracking-widest font-bold">{printLocation.id}</p>

            <button 
              onClick={handlePrint}
              className="mt-8 w-full flex items-center justify-center gap-2 bg-black text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-800 transition-all no-print"
            >
              <Printer size={20} />
              Send to Printer
            </button>

            <style>{`
              @media print {
                body * { visibility: hidden; }
                .print-modal * { visibility: visible; }
                .print-modal {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                  height: 100%;
                  box-shadow: none !important;
                  border-radius: 0 !important;
                  margin: 0 !important;
                  padding: 20px !important;
                }
                .no-print { display: none !important; }
              }
            `}</style>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationsView;
