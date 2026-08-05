import React, { useState, useRef } from 'react';
import type { Collection, Item } from '../types';
import { db } from '../db/db';
import { X, Camera, Plus, Sparkles, Loader2 } from 'lucide-react';
import CameraCapture from './CameraCapture';
import { fetchMetadataByTitle } from '../db/metadata';

interface BatchScanModalProps {
  collection: Collection;
  onClose: () => void;
}

const BatchScanModal: React.FC<BatchScanModalProps> = ({ collection, onClose }) => {
  const [showCamera, setShowCamera] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [addedItems, setAddedItems] = useState<Item[]>([]);

  const compressImage = (base64Str: string, maxWidth = 1024, maxHeight = 1024): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
    });
  };

  const handleAiScan = async (file: File | string) => {
    setIsScanning(true);
    setStatusText('Processing Image...');
    try {
      let base64Raw = '';
      if (typeof file === 'string') {
         base64Raw = file; // already base64 from camera
      } else {
         base64Raw = await new Promise<string>((resolve, reject) => {
           const reader = new FileReader();
           reader.onload = () => resolve(reader.result as string);
           reader.onerror = reject;
           reader.readAsDataURL(file);
         });
      }

      const compressedImage = await compressImage(base64Raw);

      const savedKeys = localStorage.getItem('hoarding_api_keys');
      const keys = savedKeys ? JSON.parse(savedKeys) : {};
      const geminiKey = keys.gemini || '';

      if (!geminiKey) {
        alert('Gemini API Key is missing. Please add it in Settings.');
        setIsScanning(false);
        return;
      }

      let resolvedModel = 'gemini-1.5-flash';

      const apiUrl = localStorage.getItem('hoarding_api_url') || 'https://hoardbackend.beechem.site';

      setStatusText('Identifying Multiple Items...');
      const response = await fetch(`${apiUrl}/api/identify-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GEMINI-API-KEY': geminiKey,
          'X-GEMINI-MODEL': resolvedModel
        },
        body: JSON.stringify({
          image: compressedImage,
          collectionType: collection.type,
          collectionName: collection.name,
          customFields: collection.customFields
        })
      });

      if (!response.ok) {
        throw new Error('Failed to identify items.');
      }

      const data = await response.json();
      if (data && data.success && data.results && data.results.length > 0) {
        setStatusText(`Found ${data.results.length} items. Fetching metadata...`);
        const newItems: Item[] = [];

        for (let i = 0; i < data.results.length; i++) {
          const itemResult = data.results[i];
          setStatusText(`Fetching metadata for: ${itemResult.title} (${i+1}/${data.results.length})`);
          
          let thumbnail = '';
          let fetchedAuthor = itemResult.creator || '';
          let fetchedYear = itemResult.year || '';
          let fetchedTracks = itemResult.tracks || [];
          
          // Fetch metadata using title only for supported database types
          const supportedTypes = ['Movies', 'Books', 'Music', 'Video Games', 'TV Shows', 'Trading Cards'];
          if (supportedTypes.includes(collection.type)) {
            try {
               const meta = await fetchMetadataByTitle(itemResult.title, collection.type);
               if (meta) {
                 thumbnail = meta.thumbnail || '';
                 if (!fetchedAuthor) fetchedAuthor = meta.author || '';
                 if (!fetchedYear) fetchedYear = meta.year || '';
                 if (meta.tracks) fetchedTracks = meta.tracks;
                 if (meta.description && !itemResult.description) {
                   itemResult.description = meta.description;
                 }
               }
            } catch (e) {
               console.warn('Failed to fetch metadata for', itemResult.title);
            }
          }

          const newItem: Item = {
            id: crypto.randomUUID(),
            collectionId: collection.id,
            title: itemResult.title,
            sortTitle: itemResult.title.replace(/^(The|A|An)\s+/i, '') + ', ' + (itemResult.title.match(/^(The|A|An)\s+/i)?.[0].trim() || ''),
            mediaType: itemResult.mediaType || '',
            images: thumbnail ? [thumbnail] : [],
            dateAdded: Date.now(),
            personalRating: 5,
            watched: false,
            loanedStatus: false,
            notes: itemResult.description || '',
            customData: {
              ...(itemResult.customData || {}),
              author: fetchedAuthor,
              year: fetchedYear,
              tracks: fetchedTracks.length > 0 ? fetchedTracks : undefined
            }
          };

          newItems.push(newItem);
        }

        setStatusText('Saving items to collection...');
        await db.items.bulkPut(newItems);
        setAddedItems(newItems);
        setStatusText('Done!');
        setTimeout(() => onClose(), 2500);

      } else {
        alert('No items detected in the image.');
      }
    } catch (e: any) {
      console.error('Batch scan failed:', e);
      alert('Batch scan failed.');
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-md rounded-2xl bg-bg p-6 shadow-2xl overflow-y-auto max-h-[90vh] border border-border">
        <header className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="text-accent" /> Batch AI Scan
          </h2>
          {!isScanning && (
            <button onClick={onClose} className="icon-button"><X size={24} /></button>
          )}
        </header>

        {!isScanning && addedItems.length === 0 ? (
          <div className="space-y-4">
            <p className="text-sm opacity-80 mb-4">
              Take a picture of a Hoarding Area. The AI will detect every item, fetch metadata, and add them individually to your collection.
            </p>
            <div className="flex flex-col gap-3">
              <button 
                type="button"
                onClick={() => setShowCamera(true)}
                className="flex items-center justify-center gap-2 rounded-xl bg-accent p-4 text-white font-bold hover:bg-accent-hover transition-all shadow-md"
              >
                <Camera size={20} />
                Open Camera
              </button>
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-2 rounded-xl bg-bg-secondary border border-border p-4 font-bold transition-all shadow-sm"
              >
                <Plus size={20} />
                Upload Photo
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                accept="image/*" 
                className="hidden" 
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    await handleAiScan(file);
                  }
                  e.target.value = '';
                }}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
             {isScanning ? (
                <>
                  <Loader2 size={48} className="text-accent animate-spin" />
                  <p className="text-sm font-bold text-center animate-pulse">{statusText}</p>
                </>
             ) : (
                <>
                  <div className="w-16 h-16 bg-success text-white rounded-full flex items-center justify-center mb-2 shadow-xl">
                    <Sparkles size={32} />
                  </div>
                  <h3 className="text-lg font-black text-center">Successfully Added {addedItems.length} Items!</h3>
                </>
             )}
          </div>
        )}
      </div>

      {showCamera && (
        <CameraCapture 
          onCapture={(img) => {
            setShowCamera(false);
            handleAiScan(img);
          }}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  );
};

export default BatchScanModal;
