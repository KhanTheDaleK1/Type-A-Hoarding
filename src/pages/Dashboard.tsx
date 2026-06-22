import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { syncService } from '../db/sync';
import { Plus, Settings as SettingsIcon, Package, Edit2, Search, Camera, RefreshCw, Pin, Star, MapPin } from 'lucide-react';
import CollectionEditor from '../components/CollectionEditor';
import Scanner from '../components/Scanner';
import type { Collection } from '../types';

const Dashboard: React.FC = () => {
  const [editingCollection, setEditingCollection] = useState<Collection | 'new' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [scanStatus, setScanStatus] = useState<string | undefined>();
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  const collections = useLiveQuery(() => db.collections.toArray());
  const items = useLiveQuery(() => db.items.toArray());

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await syncService.pull();
    } catch (e) {
      console.error("Manual sync failed", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleScan = async (code: string) => {
    if (scanStatus) return;

    if (code.includes('HOARDING_SHARE_V1')) {
      try {
        const shared = JSON.parse(code);
        if (confirm(`Import shared collection "${shared.name}"?`)) {
          setScanStatus('Importing...');
          const newId = crypto.randomUUID();
          await db.collections.add({
            id: newId,
            name: shared.name,
            type: shared.collectionType,
            createdAt: Date.now(),
            customFields: []
          });
          setScanStatus(`Imported: ${shared.name}!`);
          setTimeout(() => {
            setShowScanner(false);
            setScanStatus(undefined);
          }, 2000);
          return;
        }
      } catch (e) {
        setScanStatus('Invalid Share Code');
      }
    } else {
      setScanStatus('Not a Collection QR Code');
      setTimeout(() => setScanStatus(undefined), 2000);
    }
  };

  const filteredCollections = collections?.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    items?.some(i => i.collectionId === c.id && i.title.toLowerCase().includes(searchQuery.toLowerCase()))
  ).sort((a, b) => {
    // 1. Pinned collections first
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    // 2. Favorite collections next
    if (!!a.favorite !== !!b.favorite) return a.favorite ? -1 : 1;
    // 3. Alphabetical fallback
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
  });

  const totalValue = items?.reduce((sum, item) => sum + (item.estimatedValue || 0), 0) || 0;

  return (
    <div className="dashboard pb-20">
      <header className="view-header flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div className="space-y-1">
          {selectedCategory ? (
            <div className="flex items-center gap-4">
              <button onClick={() => setSelectedCategory(null)} className="icon-button bg-bg-secondary hover:bg-accent hover:text-white border border-border">
                ←
              </button>
              <h1 className="text-4xl font-black tracking-tight">{selectedCategory}</h1>
            </div>
          ) : (
            <h1 className="text-4xl font-black tracking-tight">Your Hoard</h1>
          )}
          <p className="text-sm opacity-50 font-bold uppercase tracking-widest">
            {collections?.length || 0} Collections • {items?.length || 0} Items • ${totalValue.toLocaleString()}
          </p>
        </div>
        
        <div className="flex gap-2">
          <div className="relative group flex-grow md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-accent transition-colors" size={18} />
            <input 
              type="text"
              placeholder="Global Search..."
              className="w-full pl-10 pr-4 py-3 bg-bg-secondary border border-border rounded-2xl outline-none focus:border-accent transition-all text-sm font-medium"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <button 
            onClick={() => setShowScanner(true)}
            className="icon-button bg-bg-secondary border border-border"
            title="Scan Collection QR"
          >
            <Camera size={24} />
          </button>
          <button 
            onClick={handleManualSync}
            disabled={isSyncing}
            className={`icon-button bg-bg-secondary border border-border ${isSyncing ? 'text-accent' : ''}`}
            title="Sync Data"
          >
            <RefreshCw size={24} className={isSyncing ? "animate-spin" : ""} />
          </button>
          <Link to="/locations" className="icon-button bg-bg-secondary border border-border" title="Locations Manager">
            <MapPin size={24} />
          </Link>
          <Link to="/settings" className="icon-button bg-bg-secondary border border-border" title="Settings">
            <SettingsIcon size={24} />
          </Link>
          <button 
            onClick={() => setEditingCollection('new')}
            className="icon-button accent shadow-lg"
          >
            <Plus size={24} />
          </button>
        </div>
      </header>

      {selectedCategory === null && !searchQuery ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from(new Set(filteredCollections?.map(c => c.type))).sort().map(type => {
            const typeCollections = filteredCollections?.filter(c => c.type === type) || [];
            const typeItems = items?.filter(i => typeCollections.some(c => c.id === i.collectionId)) || [];
            const typeValue = typeItems.reduce((sum, i) => sum + (i.estimatedValue || 0), 0);
            
            return (
              <div 
                key={type} 
                onClick={() => setSelectedCategory(type)}
                className="cursor-pointer block p-6 bg-bg-secondary rounded-3xl border border-border hover:border-accent transition-all shadow-sm hover:shadow-xl"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-accent/10 rounded-2xl text-accent">
                    <Package size={24} />
                  </div>
                </div>
                <h2 className="text-2xl font-black mb-1">{type}</h2>
                <p className="text-sm opacity-50 font-bold uppercase tracking-wider mb-4">{typeCollections.length} Collections</p>
                <div className="flex justify-between items-center pt-4 border-t border-border/50">
                  <span className="text-xs font-black opacity-40">{typeItems.length} items</span>
                  <span className="text-xs font-black text-accent">${typeValue.toLocaleString()}</span>
                </div>
              </div>
            );
          })}
          
          {(!filteredCollections || filteredCollections.length === 0) && (
            <div className="col-span-full py-20 text-center space-y-4">
              <div className="w-20 h-20 bg-bg-secondary rounded-full flex items-center justify-center mx-auto text-gray-300">
                <Package size={40} />
              </div>
              <p className="text-gray-400 font-bold">Start your first collection to begin hoarding.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCollections?.filter(c => !selectedCategory || c.type === selectedCategory).map(collection => {
            const collectionItems = items?.filter(i => i.collectionId === collection.id) || [];
            const value = collectionItems.reduce((sum, i) => sum + (i.estimatedValue || 0), 0);
            
            return (
              <div key={collection.id} className="relative group">
                <Link 
                  to={`/collection/${collection.id}`}
                  className="block p-6 bg-bg-secondary rounded-3xl border border-border hover:border-accent transition-all shadow-sm hover:shadow-xl"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-accent/10 rounded-2xl text-accent">
                      <Package size={24} />
                    </div>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          await db.collections.update(collection.id, { pinned: !collection.pinned });
                        }}
                        className={`p-2 rounded-lg hover:bg-accent/10 transition-all ${collection.pinned ? 'text-accent opacity-100' : 'opacity-40 lg:opacity-0 lg:group-hover:opacity-40 hover:opacity-100'}`}
                        title={collection.pinned ? "Unpin Collection" : "Pin to Top"}
                      >
                        <Pin size={16} className={collection.pinned ? 'fill-accent' : ''} />
                      </button>
                      <button 
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          await db.collections.update(collection.id, { favorite: !collection.favorite });
                        }}
                        className={`p-2 rounded-lg hover:bg-danger/10 transition-all ${collection.favorite ? 'text-danger opacity-100' : 'opacity-40 lg:opacity-0 lg:group-hover:opacity-45 hover:opacity-100'}`}
                        title={collection.favorite ? "Remove Favorite" : "Mark as Favorite"}
                      >
                        <Star size={16} className={collection.favorite ? 'fill-danger text-danger' : ''} />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setEditingCollection(collection);
                        }}
                        className="opacity-60 lg:opacity-0 lg:group-hover:opacity-100 p-2 hover:bg-accent/10 rounded-lg transition-all"
                        title="Edit Collection"
                      >
                        <Edit2 size={16} className="text-accent" />
                      </button>
                    </div>
                  </div>
                  <h2 className="text-xl font-black mb-1">{collection.name}</h2>
                  <p className="text-sm opacity-50 font-bold uppercase tracking-wider mb-4">{collection.type}</p>
                  <div className="flex justify-between items-center pt-4 border-t border-border/50">
                    <span className="text-xs font-black opacity-40">{collectionItems.length} items</span>
                    <span className="text-xs font-black text-accent">${value.toLocaleString()}</span>
                  </div>
                </Link>
              </div>
            );
          })}
          
          {(!filteredCollections?.filter(c => !selectedCategory || c.type === selectedCategory).length) && (
            <div className="col-span-full py-20 text-center space-y-4">
              <p className="text-gray-400 font-bold">No collections match your search.</p>
            </div>
          )}
        </div>
      )}

      {editingCollection && (
        <CollectionEditor 
          collection={editingCollection === 'new' ? undefined : editingCollection}
          onClose={() => setEditingCollection(null)}
        />
      )}

      {showScanner && (
        <Scanner 
          onScan={handleScan}
          onClose={() => setShowScanner(false)}
          status={scanStatus}
        />
      )}
    </div>
  );
};

export default Dashboard;
