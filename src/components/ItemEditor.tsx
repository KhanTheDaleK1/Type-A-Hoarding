import React, { useState } from 'react';
import type { Collection, Item } from '../types';
import { db } from '../db/db';
import { X, Camera, Save, Plus } from 'lucide-react';
import Scanner from './Scanner';
import CameraCapture from './CameraCapture';
import { fetchMetadataByBarcode } from '../db/metadata';

interface ItemEditorProps {
  collection: Collection;
  item?: Item; // If provided, we are editing
  onClose: () => void;
}

const ItemEditor: React.FC<ItemEditorProps> = ({ collection, item, onClose }) => {
  const [showScanner, setShowScanner] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
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

  const handleScan = async (code: string) => {
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
    }

    setScanStatus('Searching Databases...');
    const metadata = await fetchMetadataByBarcode(code);
    
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

      await db.items.add(newItem);
      setTimeout(() => setScanStatus(undefined), 2000);
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
            <button 
              onClick={() => setShowScanner(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent p-4 text-white font-bold hover:bg-accent-hover transition-all"
            >
              <Camera size={20} />
              Scan Barcode to Auto-Fill
            </button>
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
              </div>

          <div>
            <label className="block text-xs font-bold uppercase opacity-50 mb-1">General Notes</label>
            <textarea 
              className="w-full rounded-lg border border-border bg-bg-secondary p-2 text-sm h-32 outline-none"
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
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

      {showScanner && (
        <Scanner 
          onScan={handleScan} 
          onClose={() => setShowScanner(false)} 
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
