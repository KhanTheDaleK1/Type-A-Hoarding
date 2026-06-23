import React, { useState, useRef } from 'react';
import type { Collection, Item } from '../types';
import { db } from '../db/db';
import { X, Camera, Save, Plus, Sparkles } from 'lucide-react';
import Scanner from './Scanner';
import CameraCapture from './CameraCapture';
import { fetchMetadataByBarcode } from '../db/metadata';

interface ItemEditorProps {
  collection: Collection;
  item?: Item; // If provided, we are editing
  onClose: () => void;
}

const ItemEditor: React.FC<ItemEditorProps> = ({ collection, item, onClose }) => {
  const [scannerMode, setScannerMode] = useState<'item' | 'location' | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isIdentifying, setIsIdentifying] = useState(false);

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

  const triggerAiScan = () => {
    fileInputRef.current?.click();
  };

  const handleAiScan = async (file: File) => {
    setIsIdentifying(true);
    try {
      // 1. Read file as Data URL
      const base64Raw = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // 2. Compress the image to speed up upload & respect API limits
      const compressedImage = await compressImage(base64Raw);

      // 3. Get API credentials
      const savedKeys = localStorage.getItem('hoarding_api_keys');
      const keys = savedKeys ? JSON.parse(savedKeys) : {};
      const geminiKey = keys.gemini || '';

      if (!geminiKey) {
        alert('Gemini API Key is missing. Please go to Settings and enter your Google AI Studio Gemini Key.');
        setIsIdentifying(false);
        return;
      }

      // Query latest models list dynamically to auto-update
      let resolvedModel = 'gemini-3.5-flash';
      try {
        const modelsRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`);
        if (modelsRes.ok) {
          const modelsData = await modelsRes.json();
          const flashModels = modelsData.models
            ?.map((m: any) => m.name.replace('models/', ''))
            .filter((name: string) => 
              name.includes('flash') && 
              !name.includes('tuning') && 
              !name.includes('experimental') && 
              !name.includes('exp')
            );
          if (flashModels && flashModels.length > 0) {
            const getVersion = (name: string) => {
              const match = name.match(/gemini-(\d+(?:\.\d+)?)-flash/);
              return match ? parseFloat(match[1]) : 0;
            };
            flashModels.sort((a: string, b: string) => getVersion(b) - getVersion(a));
            resolvedModel = flashModels[0];
          }
        }
      } catch (err) {
        console.warn('Failed to dynamically fetch Gemini models, using default:', err);
      }

      const apiUrl = localStorage.getItem('hoarding_api_url') || 'https://hoardbackend.beechem.site';

      // 4. Send to backend
      const response = await fetch(`${apiUrl}/api/identify`, {
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
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to identify image.');
      }

      const data = await response.json();
      if (data && data.success && data.result) {
        const itemResult = data.result;
        
        // Match custom fields
        const newCustomData: Record<string, any> = {};
        if (itemResult.customData) {
          // Put the Gemini output custom fields directly
          for (const key of Object.keys(itemResult.customData)) {
            newCustomData[key] = itemResult.customData[key];
          }
        }

        // Apply back to form
        setFormData(prev => ({
          ...prev,
          title: itemResult.title || prev.title,
          notes: itemResult.description || prev.notes,
          mediaType: itemResult.mediaType || prev.mediaType,
          images: [compressedImage, ...(prev.images || [])].slice(0, 4), // Add the captured photo to images!
          customData: {
            ...prev.customData,
            ...newCustomData
          }
        }));

        alert(`Successfully identified: "${itemResult.title}"!`);
      } else {
        alert('Failed to recognize the item in the image. Please try again with a clearer shot.');
      }
    } catch (e: any) {
      console.error('Image identification failed:', e);
      let errMsg = e.message || e;
      try {
        const parsedErr = JSON.parse(errMsg);
        errMsg = parsedErr.error || errMsg;
      } catch (err) {}
      alert(`AI Scan Failed: ${errMsg}`);
    } finally {
      setIsIdentifying(false);
    }
  };

  const [formData, setFormData] = useState<Partial<Item>>(item || {
    collectionId: collection.id,
    title: '',
    mediaType: '',
    storageLocation: '',
    personalRating: 5,
    loanedStatus: false,
    notes: '',
    estimatedValue: 0,
    customData: {},
    images: []
  });

  const [scanStatus, setScanStatus] = useState<string | undefined>();

  const handleScan = async (code: string, isBatch?: boolean) => {
    if (scanStatus) return; // Prevent double scans

    if (scannerMode === 'location') {
      const locMatch = code.match(/LOC-[\w-]+/);
      if (locMatch) {
        setScanStatus(`Location: ${locMatch[0]}`);
        setFormData(prev => ({ ...prev, storageLocation: locMatch[0] }));
        setTimeout(() => setScannerMode(null), 1000);
      } else {
        setScanStatus('Not a Location Code');
        setTimeout(() => setScanStatus(undefined), 2000);
      }
      return;
    }
    if (scanStatus) return; // Prevent double scans
    
    // Check for Shared Collection QR Code
    if (code.includes('HOARDING_SHARE_V1')) {
      try {
        const shared = JSON.parse(code);
        setScanStatus(`Collection: ${shared.name}`);
        if (confirm(`Import shared collection "${shared.name}"?`)) {
          const newId = crypto.randomUUID();
          await db.collections.add({
            id: newId,
            name: shared.name,
            type: shared.collectionType,
            createdAt: Date.now(),
            customFields: []
          });
          setScanStatus(`Success! Imported.`);
          setTimeout(() => onClose(), 2000);
          return;
        }
      } catch (e) {
        setScanStatus('Invalid Share Code');
      }
      return;
    }

    const isVhsItem = collection.name.toLowerCase().includes('vhs') || collection.type.toLowerCase().includes('vhs') || (formData.mediaType?.toLowerCase() === 'vhs');
    setScanStatus('Searching Databases...');
    const metadata = await fetchMetadataByBarcode(code, isVhsItem);
    
    if (metadata) {
      setScanStatus(`Found: ${metadata.title}`);
      
      const newItem: Item = {
        id: crypto.randomUUID(),
        collectionId: collection.id,
        title: metadata.title,
        sortTitle: metadata.title.replace(/^(The|A|An)\s+/i, '') + ', ' + (metadata.title.match(/^(The|A|An)\s+/i)?.[0].trim() || ''),
        mediaType: metadata.mediaType || collection.type,
        images: metadata.thumbnail ? [metadata.thumbnail] : [],
        dateAdded: Date.now(),
        personalRating: 5,
        watched: false,
        loanedStatus: false,
        notes: metadata.description || `Metadata from ${metadata.source}`,
        customData: {
          author: metadata.author,
          publisher: metadata.publisher,
          year: metadata.year,
          genre: metadata.genre,
          dateRead: collection.type === 'Books' ? '' : undefined,
          dateWatched: collection.type === 'Movies' ? '' : undefined
        }
      };

      if (isBatch) {
        // Batch Mode: Immediately insert to IndexedDB
        await db.items.add(newItem);
        setTimeout(() => setScanStatus(undefined), 1500);
      } else {
        // Normal Mode: Populate form and close scanner so user can verify/edit
        setFormData(prev => ({
          ...prev,
          title: newItem.title,
          mediaType: newItem.mediaType,
          images: newItem.images,
          notes: newItem.notes,
          customData: {
            ...prev.customData,
            ...newItem.customData
          }
        }));
        setTimeout(() => {
          setScanStatus(undefined);
          setScannerMode(null);
        }, 1500);
      }
    } else {
      setScanStatus(`Not Found: ${code}`);
      setTimeout(() => setScanStatus(undefined), 4000);
    }
  };

  const MEDIA_TYPES_BY_COLLECTION: Record<string, string[]> = {
    'Movies': ['DVD', 'VHS', 'Blu-ray', '4K', 'Digital'],
    'Books': ['Hardcover', 'Paperback', 'Kindle', 'Audiobook', 'Mass Market'],
    'Music': ['CD', 'Vinyl', 'Digital', 'Cassette'],
    'Video Games': ['Physical', 'Digital']
  };

  const BOOK_GENRES = [
    'Fantasy', 'Sci-Fi', 'Mystery', 'Thriller', 'Romance', 
    'Horror', 'Historical', 'Biography', 'Self-Help', 'Cooking'
  ];

  const handleSave = async () => {
    if (!formData.title) return alert('Title is required');
    
    const itemData: Item = {
      id: item?.id || crypto.randomUUID(),
      collectionId: collection.id,
      title: formData.title!,
      sortTitle: formData.title!.replace(/^(The|A|An)\s+/i, '') + ', ' + (formData.title!.match(/^(The|A|An)\s+/i)?.[0].trim() || ''),
      mediaType: formData.mediaType,
      images: formData.images || [],
      loanedStatus: formData.loanedStatus || false,
      loanedTo: formData.loanedTo,
      dateAdded: item?.dateAdded || Date.now(),
      personalRating: formData.personalRating || 5,
      storageLocation: formData.storageLocation,
      notes: formData.notes,
      estimatedValue: formData.estimatedValue || 0,
      purchasePrice: formData.purchasePrice,
      purchaseDate: formData.purchaseDate,
      customData: formData.customData || {}
    };

    if (item) {
      await db.items.put(itemData);
    } else {
      await db.items.add(itemData);
    }
    onClose();
  };

  const updateCustomData = (fieldId: string, value: any) => {
    setFormData({
      ...formData,
      customData: { ...formData.customData, [fieldId]: value }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-bg p-6 shadow-2xl overflow-y-auto max-h-[90vh] border border-border">
        <header className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">{item ? 'Edit' : 'Add'} Item</h2>
          <button onClick={onClose} className="icon-button"><X size={24} /></button>
        </header>

        <div className="space-y-6">
          {!item && (
            <div className="flex flex-col sm:flex-row gap-3">
              <button 
                type="button"
                onClick={() => setScannerMode('item')}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-accent p-4 text-white font-bold hover:bg-accent-hover transition-all shadow-md"
              >
                <Camera size={20} />
                Scan Barcode
              </button>
              <button 
                type="button"
                onClick={triggerAiScan}
                disabled={isIdentifying}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-accent/20 border border-accent/30 text-accent p-4 font-bold hover:bg-accent/30 transition-all shadow-sm disabled:opacity-50"
              >
                <Sparkles size={20} className={isIdentifying ? "animate-pulse" : ""} />
                {isIdentifying ? 'Analyzing Photo...' : 'Photo AI Scan'}
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                accept="image/*" 
                capture="environment" 
                className="hidden" 
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    await handleAiScan(file);
                  }
                  e.target.value = ''; // Reset
                }}
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase opacity-50 mb-1">Title</label>
                <input 
                  type="text" 
                  className="w-full rounded-lg border border-border bg-bg-secondary p-2 outline-none focus:border-accent"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                />
              </div>\n\n<div>
                <label className="block text-xs font-bold uppercase opacity-50 mb-1">Storage Location</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    className="flex-grow rounded-lg border border-border bg-bg-secondary p-2 outline-none focus:border-accent font-mono text-sm"
                    value={formData.storageLocation || ''}
                    onChange={e => setFormData({ ...formData, storageLocation: e.target.value })}
                    placeholder="e.g. LOC-1001"
                  />
                  <button 
                    type="button"
                    onClick={() => setScannerMode('location')}
                    className="p-2 bg-accent/20 text-accent rounded-lg hover:bg-accent hover:text-white transition-all flex items-center justify-center border border-accent/20"
                    title="Scan Location QR"
                  >
                    <Camera size={20} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <div>
                  <label className="block text-xs font-bold uppercase opacity-50 mb-2">
                    {collection.type === 'Books' ? 'Format' : 'Media Type'}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(MEDIA_TYPES_BY_COLLECTION[collection.type] || ['Physical', 'Digital']).map(type => (
                      <button 
                        key={type}
                        type="button"
                        onClick={() => setFormData({ ...formData, mediaType: type })}
                        className={`px-4 py-3 text-xs font-black rounded-xl border transition-all ${formData.mediaType === type ? 'bg-accent text-white border-accent shadow-md scale-105' : 'bg-bg-secondary border-border opacity-70'}`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {collection.type === 'Books' && (
                <div>
                  <label className="block text-xs font-bold uppercase opacity-50 mb-2">Quick Genre</label>
                  <div className="flex flex-wrap gap-2">
                    {BOOK_GENRES.map(genre => (
                      <button 
                        key={genre}
                        type="button"
                        onClick={() => updateCustomData('genre', genre)}
                        className={`px-3 py-2 text-[10px] font-black rounded-lg border transition-all ${formData.customData?.genre === genre ? 'bg-accent text-white border-accent' : 'bg-bg-secondary border-border opacity-60'}`}
                      >
                        {genre}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold uppercase opacity-50 mb-1">Purchase Price</label>
                  <input 
                    type="number" 
                    className="w-full rounded-lg border border-border bg-bg-secondary p-2 text-sm outline-none"
                    value={formData.purchasePrice || ''}
                    onChange={e => setFormData({ ...formData, purchasePrice: parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase opacity-50 mb-1">Est. Value</label>
                  <input 
                    type="number" 
                    className="w-full rounded-lg border border-border bg-bg-secondary p-2 text-sm outline-none"
                    value={formData.estimatedValue || ''}
                    onChange={e => setFormData({ ...formData, estimatedValue: parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase opacity-50 mb-1">Personal Rating (Stars)</label>
                  <input 
                    type="number" 
                    min="1" max="5"
                    className="w-full rounded-lg border border-border bg-bg-secondary p-2 text-sm outline-none"
                    value={formData.personalRating || 5}
                    onChange={e => setFormData({ ...formData, personalRating: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <div className="p-4 bg-bg-secondary rounded-2xl border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-widest opacity-50">
                    {collection.type === 'Books' ? 'Finished Reading' : 'Watched'}
                  </span>
                  <button 
                    type="button"
                    onClick={() => setFormData({ ...formData, watched: !formData.watched })}
                    className={`w-12 h-6 rounded-full transition-all relative ${formData.watched ? 'bg-success' : 'bg-border'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${formData.watched ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
                {formData.watched && (
                  <div className="animate-in fade-in slide-in-from-top-2">
                    <label className="block text-[10px] font-black uppercase opacity-40 mb-1">Date {collection.type === 'Books' ? 'Read' : 'Watched'}</label>
                    <input 
                      type="date" 
                      className="w-full bg-bg border border-border rounded-xl p-2 text-xs outline-none"
                      value={formData.customData?.[collection.type === 'Books' ? 'dateRead' : 'dateWatched'] || ''}
                      onChange={e => updateCustomData(collection.type === 'Books' ? 'dateRead' : 'dateWatched', e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-widest opacity-50 border-b border-border pb-1">
                Custom Fields ({collection.type})
              </h3>
              
              <div className="space-y-3">
                {collection.customFields.map(field => (
                  <div key={field.id}>
                    <label className="block text-xs font-bold opacity-70 mb-1">{field.name}</label>
                    {field.type === 'text' && (
                      <input 
                        type="text" 
                        className="w-full rounded-lg border border-border bg-bg-secondary p-2 text-sm outline-none"
                        value={formData.customData?.[field.id] || ''}
                        onChange={e => updateCustomData(field.id, e.target.value)}
                      />
                    )}
                    {field.type === 'number' && (
                      <input 
                        type="number" 
                        className="w-full rounded-lg border border-border bg-bg-secondary p-2 text-sm outline-none"
                        value={formData.customData?.[field.id] || ''}
                        onChange={e => updateCustomData(field.id, parseFloat(e.target.value))}
                      />
                    )}
                    {field.type === 'boolean' && (
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 accent-accent"
                        checked={formData.customData?.[field.id] || false}
                        onChange={e => updateCustomData(field.id, e.target.checked)}
                      />
                    )}
                    {field.type === 'select' && (
                      <select 
                        className="w-full rounded-lg border border-border bg-bg-secondary p-2 text-sm outline-none"
                        value={formData.customData?.[field.id] || ''}
                        onChange={e => updateCustomData(field.id, e.target.value)}
                      >
                        <option value="">Select...</option>
                        {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    )}
                    {field.type === 'date' && (
                      <input 
                        type="date" 
                        className="w-full rounded-lg border border-border bg-bg-secondary p-2 text-sm outline-none"
                        value={formData.customData?.[field.id] || ''}
                        onChange={e => updateCustomData(field.id, e.target.value)}
                      />
                    )}
                  </div>
                ))}
                {collection.customFields.length === 0 && (
                  <p className="text-xs opacity-40 italic">No custom fields defined for this collection.</p>
                )}

                {Object.keys(formData.customData || {}).filter(key => 
                  !collection.customFields.find(cf => cf.id === key) && 
                  !['reviewText', 'dateRead', 'dateWatched', 'genre', 'rating'].includes(key)
                ).map(key => (
                  <div key={key}>
                    <label className="block text-xs font-bold opacity-70 mb-1 capitalize text-accent flex items-center gap-1">
                      <Sparkles size={12} /> {key.replace(/([A-Z])/g, ' $1').trim()} (AI Extracted)
                    </label>
                    <input 
                      type="text" 
                      className="w-full rounded-lg border border-accent/30 bg-bg-secondary p-2 text-sm outline-none focus:border-accent"
                      value={formData.customData?.[key] || ''}
                      onChange={e => updateCustomData(key, e.target.value)}
                    />
                  </div>
                ))}
              </div>

          <div>
            <label className="block text-xs font-bold uppercase opacity-50 mb-1">Synopsis</label>
            <textarea 
              className="w-full rounded-lg border border-border bg-bg-secondary p-2 text-sm h-32 outline-none"
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
            ></textarea>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase opacity-50 mb-1">Review</label>
            <textarea 
              className="w-full rounded-lg border border-border bg-bg-secondary p-2 text-sm h-24 outline-none"
              value={formData.customData?.reviewText || ''}
              onChange={e => updateCustomData('reviewText', e.target.value)}
            ></textarea>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase opacity-50 mb-2">Images ({formData.images?.length || 0}/4)</label>
            <div className="flex gap-3 mb-2 overflow-x-auto pb-4">
              {formData.images?.map((img, i) => (
                <div key={i} className="relative w-24 h-24 flex-shrink-0">
                  <img src={img} className="w-full h-full object-cover rounded-xl border border-border shadow-sm" alt="" />
                  <button 
                    onClick={() => setFormData({ ...formData, images: formData.images?.filter((_, idx) => idx !== i) })}
                    className="absolute -top-2 -right-2 bg-danger text-white rounded-full p-2 shadow-xl active:scale-75 transition-all"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              {(formData.images?.length || 0) < 4 && (
                <>
                  <button 
                    onClick={() => setShowCamera(true)}
                    className="w-24 h-24 border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-accent hover:bg-accent/5 transition-all active:scale-95"
                  >
                    <Camera size={24} className="text-accent" />
                    <span className="text-[9px] font-black uppercase tracking-tighter">Photo</span>
                  </button>
                  <label className="w-24 h-24 border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-accent hover:bg-accent/5 transition-all active:scale-95">
                    <Plus size={24} className="text-accent" />
                    <span className="text-[9px] font-black uppercase tracking-tighter">Upload</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setFormData({ ...formData, images: [...(formData.images || []), reader.result as string].slice(0, 4) });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </>
              )}
            </div>
          </div>
            </div>
          </div>

          <button 
            onClick={handleSave}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-success p-4 text-white font-bold hover:opacity-90 transition-all shadow-lg"
          >
            <Save size={20} />
            Save Item to Collection
          </button>
        </div>
      </div>

      {scannerMode !== null && (
        <Scanner 
          onScan={handleScan} 
          onClose={() => setScannerMode(null)} 
          status={scanStatus}
        />
      )}

      {showCamera && (
        <CameraCapture 
          onCapture={(img) => {
            setFormData(prev => ({ ...prev, images: [...(prev.images || []), img].slice(0, 4) }));
            setShowCamera(false);
          }}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  );
};

export default ItemEditor;
