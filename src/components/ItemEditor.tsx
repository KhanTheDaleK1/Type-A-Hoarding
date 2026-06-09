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

  const handleScan = async (barcode: string) => {
    if (scanStatus) return; // Prevent double scans
    
    setScanStatus('Searching...');
    const metadata = await fetchMetadataByBarcode(barcode);
    
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
        loanedStatus: false,
        notes: metadata.description || `Fetched from ${metadata.source}`,
        customData: {
          author: metadata.author,
          publisher: metadata.publisher,
          year: metadata.year
        }
      };

      await db.items.add(newItem);
      
      // Success feedback
      setTimeout(() => {
        setScanStatus(undefined);
      }, 2000);
    } else {
      setScanStatus(`Not Found: ${barcode}. Try again?`);
      setTimeout(() => setScanStatus(undefined), 4000);
    }
  };

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

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold uppercase opacity-50 mb-1">Media Type</label>
                  <div className="flex flex-wrap gap-1">
                    {['DVD', 'VHS', 'Blu-ray', '4K', 'Digital'].map(type => (
                      <button 
                        key={type}
                        onClick={() => setFormData({ ...formData, mediaType: type })}
                        className={`px-2 py-1 text-[10px] font-bold rounded border ${formData.mediaType === type ? 'bg-accent text-white border-accent' : 'bg-bg-secondary border-border opacity-60'}`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

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
            <label className="block text-xs font-bold uppercase opacity-50 mb-1">Images ({formData.images?.length || 0}/4)</label>
            <div className="flex gap-2 mb-2 overflow-x-auto pb-2">
              {formData.images?.map((img, i) => (
                <div key={i} className="relative w-20 h-20 flex-shrink-0">
                  <img src={img} className="w-full h-full object-cover rounded-lg border border-border" alt="" />
                  <button 
                    onClick={() => setFormData({ ...formData, images: formData.images?.filter((_, idx) => idx !== i) })}
                    className="absolute -top-1 -right-1 bg-danger text-white rounded-full p-1 shadow-lg"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              {(formData.images?.length || 0) < 4 && (
                <>
                  <button 
                    onClick={() => setShowCamera(true)}
                    className="w-20 h-20 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-accent hover:bg-accent/5 transition-all"
                  >
                    <Camera size={20} />
                    <span className="text-[8px] font-black uppercase">Take Photo</span>
                  </button>
                  <label className="w-20 h-20 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-accent hover:bg-accent/5 transition-all">
                    <Plus size={20} />
                    <span className="text-[8px] font-black uppercase">Upload</span>
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
