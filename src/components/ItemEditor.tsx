import React, { useState } from 'react';
import type { Collection, Item } from '../types';
import { db } from '../db/db';
import { X, Camera, Save } from 'lucide-react';
import Scanner from './Scanner';
import { fetchMetadataByBarcode } from '../db/metadata';

interface ItemEditorProps {
  collection: Collection;
  onClose: () => void;
}

const ItemEditor: React.FC<ItemEditorProps> = ({ collection, onClose }) => {
  const [showScanner, setShowScanner] = useState(false);
  const [formData, setFormData] = useState<Partial<Item>>({
    collectionId: collection.id,
    title: '',
    mediaType: '',
    storageLocation: '',
    personalRating: 5,
    loanedStatus: false,
    notes: '',
    customData: {},
    images: []
  });

  const handleScan = async (barcode: string) => {
    setShowScanner(false);
    const metadata = await fetchMetadataByBarcode(barcode);
    if (metadata) {
      setFormData(prev => ({
        ...prev,
        title: metadata.title,
        images: metadata.thumbnail ? [metadata.thumbnail] : prev.images,
        notes: metadata.author ? `Author: ${metadata.author}` : prev.notes
      }));
    }
  };

  const handleSave = async () => {
    if (!formData.title) return alert('Title is required');
    
    const newItem: Item = {
      id: crypto.randomUUID(),
      collectionId: collection.id,
      title: formData.title!,
      sortTitle: formData.title!.replace(/^(The|A|An)\s+/i, '') + ', ' + (formData.title!.match(/^(The|A|An)\s+/i)?.[0].trim() || ''),
      mediaType: formData.mediaType,
      images: formData.images || [],
      loanedStatus: formData.loanedStatus || false,
      dateAdded: Date.now(),
      personalRating: formData.personalRating || 5,
      storageLocation: formData.storageLocation,
      notes: formData.notes,
      customData: formData.customData || {}
    };

    await db.items.add(newItem);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-bg p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
        <header className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Add to {collection.name}</h2>
          <button onClick={onClose} className="icon-button"><X size={24} /></button>
        </header>

        <div className="space-y-4">
          <button 
            onClick={() => setShowScanner(true)}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent p-3 text-white font-semibold hover:bg-accent-hover"
          >
            <Camera size={20} />
            Scan Barcode
          </button>

          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input 
              type="text" 
              className="w-full rounded-lg border border-border bg-bg p-2"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Media Type</label>
              <input 
                type="text" 
                placeholder="e.g. DVD, VHS, Digital"
                className="w-full rounded-lg border border-border bg-bg p-2"
                value={formData.mediaType}
                onChange={e => setFormData({ ...formData, mediaType: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Location</label>
              <input 
                type="text" 
                className="w-full rounded-lg border border-border bg-bg p-2"
                value={formData.storageLocation}
                onChange={e => setFormData({ ...formData, storageLocation: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Rating</label>
            <input 
              type="range" min="1" max="5" step="1"
              className="w-full"
              value={formData.personalRating}
              onChange={e => setFormData({ ...formData, personalRating: parseInt(e.target.value) })}
            />
            <div className="text-center font-bold">{formData.personalRating} / 5</div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea 
              className="w-full rounded-lg border border-border bg-bg p-2 h-24"
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
            ></textarea>
          </div>

          <button 
            onClick={handleSave}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-success p-3 text-white font-semibold hover:opacity-90"
          >
            <Save size={20} />
            Save Item
          </button>
        </div>
      </div>

      {showScanner && <Scanner onScan={handleScan} onClose={() => setShowScanner(false)} />}
    </div>
  );
};

export default ItemEditor;
