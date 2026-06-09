import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Share2, Copy, CheckCircle2 } from 'lucide-react';
import type { Collection } from '../types';

interface ShareModalProps {
  collection: Collection;
  syncToken?: string; 
  onClose: () => void;
}

const ShareModal: React.FC<ShareModalProps> = ({ collection, syncToken, onClose }) => {
  const [copied, setCopied] = React.useState(false);

  // The share payload
  const shareData = {
    type: 'HOARDING_SHARE_V1',
    collectionId: collection.id,
    name: collection.name,
    collectionType: collection.type,
    syncToken: syncToken || null,
    // Add GitHub info if we want live sync
    ghInfo: syncToken ? {
      owner: localStorage.getItem('hoarding_github_owner'),
      repo: localStorage.getItem('hoarding_github_repo'),
    } : null
  };

  const shareString = JSON.stringify(shareData);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-6">
      <div className="w-full max-w-sm bg-bg rounded-3xl p-8 border border-border shadow-2xl space-y-8 text-center animate-in zoom-in-95">
        <header className="flex justify-between items-center">
          <div className="p-3 bg-accent/10 rounded-2xl text-accent">
            <Share2 size={24} />
          </div>
          <button onClick={onClose} className="p-2 hover:bg-bg-secondary rounded-full">
            <X size={24} />
          </button>
        </header>

        <div className="space-y-2">
          <h2 className="text-2xl font-black tracking-tight">Share Collection</h2>
          <p className="text-sm opacity-50 font-bold uppercase tracking-widest">{collection.name}</p>
        </div>

        <div className="bg-white p-6 rounded-3xl inline-block shadow-inner mx-auto border-4 border-bg-secondary">
          <QRCodeSVG 
            value={shareString}
            size={200}
            level="H"
            includeMargin={true}
          />
        </div>

        <div className="space-y-4">
          <p className="text-xs opacity-60 font-medium px-4 leading-relaxed">
            Scan this with another Type-A Hoarding app to instantly import this collection. 
            {syncToken ? ' ✨ Live sync enabled!' : ''}
          </p>

          <button 
            onClick={copyToClipboard}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-black uppercase text-xs tracking-widest transition-all ${copied ? 'bg-success text-white' : 'bg-bg-secondary hover:bg-border'}`}
          >
            {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
            {copied ? 'Copied Link' : 'Copy Share Code'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
