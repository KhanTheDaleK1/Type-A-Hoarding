import React, { useState } from 'react';
import type { Collection, CollectionType, FieldDefinition } from '../types';
import { db } from '../db/db';
import { X, Plus, Trash2, Save, Package } from 'lucide-react';

interface CollectionEditorProps {
  collection?: Collection; // If provided, we are editing
  onClose: () => void;
}

const COLLECTION_TYPES: CollectionType[] = [
  'Movies', 'Books', 'Video Games', 'Comics', 'Music', 
  'Toy Cars', 'LEGO', 'Wine', 'Coins', 'Art', 
  'Action Figures', 'Currency', 'Board Games', 'Magazines', 'Trading Cards', 'Custom'
];

const FIELD_TYPES: FieldDefinition['type'][] = [
  'text', 'number', 'date', 'boolean', 'rating', 'select'
];

const CollectionEditor: React.FC<CollectionEditorProps> = ({ collection, onClose }) => {
  const [name, setName] = useState(collection?.name || '');
  const [type, setType] = useState<CollectionType>(collection?.type || 'Custom');
  const [fields, setFields] = useState<FieldDefinition[]>(collection?.customFields || []);
  const [favorite, setFavorite] = useState(collection?.favorite || false);
  const [pinned, setPinned] = useState(collection?.pinned || false);

  const addField = () => {
    const newField: FieldDefinition = {
      id: crypto.randomUUID(),
      name: '',
      type: 'text'
    };
    setFields([...fields, newField]);
  };

  const updateField = (id: string, updates: Partial<FieldDefinition>) => {
    setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const removeField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
  };

  const handleSave = async () => {
    if (!name) return alert('Collection name is required');

    const collectionData: Collection = {
      id: collection?.id || crypto.randomUUID(),
      name,
      type,
      customFields: fields,
      createdAt: collection?.createdAt || Date.now(),
      favorite,
      pinned
    };

    if (collection) {
      await db.collections.put(collectionData);
    } else {
      await db.collections.add(collectionData);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl rounded-2xl bg-bg p-6 shadow-2xl overflow-y-auto max-h-[90vh] border border-border">
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent/10 rounded-lg text-accent">
              <Package size={24} />
            </div>
            <h2 className="text-2xl font-bold">{collection ? 'Edit' : 'New'} Collection</h2>
          </div>
          <button onClick={onClose} className="icon-button"><X size={24} /></button>
        </header>

        <div className="space-y-6">
          <div className={`grid grid-cols-1 ${!collection ? "md:grid-cols-2" : ""} gap-4`}>
            <div>
              <label className="block text-sm font-bold mb-1 opacity-70">Name</label>
              <input 
                type="text" 
                placeholder="e.g. My Criterion Collection"
                className="w-full rounded-lg border border-border bg-bg-secondary p-3 focus:border-accent outline-none"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
            {!collection && (
              <div>
                <label className="block text-sm font-bold mb-1 opacity-70">Category</label>
                <select 
                  className="w-full rounded-lg border border-border bg-bg-secondary p-3 focus:border-accent outline-none"
                  value={type}
                  onChange={e => {
                    const newType = e.target.value as CollectionType;
                    setType(newType);
                    // Auto-populate default fields if it's a new collection and fields are currently empty
                    if (fields.length === 0) {
                      if (newType === 'Trading Cards') {
                        setFields([
                          { id: 'cardNumber', name: 'Card Number', type: 'text' },
                          { id: 'set', name: 'Set Name', type: 'text' },
                          { id: 'rarity', name: 'Rarity', type: 'text' }
                        ]);
                      } else if (newType === 'Books') {
                        setFields([
                          { id: 'author', name: 'Author', type: 'text' },
                          { id: 'publisher', name: 'Publisher', type: 'text' },
                          { id: 'year', name: 'Year Published', type: 'number' },
                          { id: 'isbn', name: 'ISBN', type: 'text' }
                        ]);
                      } else if (newType === 'Video Games') {
                        setFields([
                          { id: 'platform', name: 'Platform / Console', type: 'select', options: ['Nintendo Switch', 'Wii', 'Wii U', 'PlayStation 5', 'PlayStation 4', 'Xbox Series X', 'PC', 'Other'] },
                          { id: 'publisher', name: 'Publisher / Studio', type: 'text' },
                          { id: 'year', name: 'Release Year', type: 'number' }
                        ]);
                      }
                    }
                  }}
                >
                  {COLLECTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="flex gap-6 border-b border-border/50 pb-4">
            <label className="flex items-center gap-2 cursor-pointer text-sm font-bold select-none">
              <input 
                type="checkbox"
                checked={pinned}
                onChange={e => setPinned(e.target.checked)}
                className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
              />
              <span>📌 Pin to Top</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm font-bold select-none">
              <input 
                type="checkbox"
                checked={favorite}
                onChange={e => setFavorite(e.target.checked)}
                className="w-4 h-4 rounded border-border text-danger focus:ring-danger"
              />
              <span>⭐ Favorite Collection</span>
            </label>
          </div>

          <div className="border-t border-border pt-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">Custom Fields</h3>
              <button 
                onClick={addField}
                className="flex items-center gap-2 text-sm font-bold text-accent hover:opacity-80"
              >
                <Plus size={16} /> Add Field
              </button>
            </div>

            <div className="space-y-3">
              {fields.map(field => (
                <div key={field.id} className="flex gap-2 items-start bg-bg-secondary p-3 rounded-lg border border-border">
                  <div className="flex-grow space-y-2">
                    <input 
                      type="text"
                      placeholder="Field Name (e.g. Director)"
                      className="w-full bg-transparent border-b border-border p-1 text-sm outline-none focus:border-accent"
                      value={field.name}
                      onChange={e => updateField(field.id, { name: e.target.value })}
                    />
                    <div className="flex gap-2">
                      <select 
                        className="text-xs bg-bg border border-border rounded px-2 py-1 outline-none"
                        value={field.type}
                        onChange={e => updateField(field.id, { type: e.target.value as any })}
                      >
                        {FIELD_TYPES.map(ft => <option key={ft} value={ft}>{ft}</option>)}
                      </select>
                      {field.type === 'select' && (
                        <input 
                          type="text"
                          placeholder="Options (comma separated)"
                          className="flex-grow text-xs bg-bg border border-border rounded px-2 py-1 outline-none"
                          value={field.options?.join(', ') || ''}
                          onChange={e => updateField(field.id, { options: e.target.value.split(',').map(s => s.trim()) })}
                        />
                      )}
                    </div>
                  </div>
                  <button 
                    onClick={() => removeField(field.id)}
                    className="p-2 text-danger hover:bg-danger/10 rounded"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
              {fields.length === 0 && (
                <p className="text-center py-4 text-sm opacity-50 italic">
                  No custom fields defined yet.
                </p>
              )}
            </div>
          </div>

          <button 
            onClick={handleSave}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent p-4 text-white font-bold hover:bg-accent-hover transition-all shadow-lg shadow-accent/20"
          >
            <Save size={20} />
            {collection ? 'Update' : 'Create'} Collection
          </button>
        </div>
      </div>
    </div>
  );
};

export default CollectionEditor;
