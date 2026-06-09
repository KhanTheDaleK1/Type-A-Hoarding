import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Plus, Settings as SettingsIcon, Package, Edit2 } from 'lucide-react';
import CollectionEditor from '../components/CollectionEditor';
import type { Collection } from '../types';

const Dashboard: React.FC = () => {
  const collections = useLiveQuery(() => db.collections.toArray());
  const [editingCollection, setEditingCollection] = useState<Collection | null | 'new'>(null);

  const stats = useLiveQuery(async () => {
    const items = await db.items.toArray();
    return {
      totalItems: items.length,
      totalValue: items.reduce((sum, item) => sum + (item.estimatedValue || 0), 0)
    };
  });

  return (
    <div className="dashboard pb-20">
      <header className="dashboard-header flex items-center justify-between py-6">
        <div>
          <h1 className="text-3xl font-bold">Collections</h1>
          <p className="text-sm opacity-60">
            {stats?.totalItems || 0} items • ${stats?.totalValue?.toLocaleString() || 0} total value
          </p>
        </div>
        <div className="header-actions">
          <Link to="/settings" className="icon-button">
            <SettingsIcon size={24} />
          </Link>
        </div>
      </header>

      <div className="collection-grid">
        {collections?.map((collection) => (
          <div key={collection.id} className="group relative">
            <Link 
              to={`/collection/${collection.id}`} 
              className="collection-card"
            >
              <div className="card-icon">
                <Package size={32} />
              </div>
              <div className="card-content">
                <h2 className="font-bold text-lg">{collection.name}</h2>
                <p className="text-xs opacity-50 uppercase tracking-widest">{collection.type}</p>
              </div>
            </Link>
            <button 
              onClick={() => setEditingCollection(collection)}
              className="absolute top-2 right-2 p-2 bg-bg border border-border rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:text-accent"
            >
              <Edit2 size={14} />
            </button>
          </div>
        ))}

        <button 
          className="collection-card add-card" 
          onClick={() => setEditingCollection('new')}
        >
          <div className="card-icon">
            <Plus size={32} />
          </div>
          <div className="card-content">
            <h2 className="font-bold">Add Collection</h2>
            <p className="text-sm opacity-50">Create a new schema</p>
          </div>
        </button>
      </div>

      {editingCollection && (
        <CollectionEditor 
          collection={editingCollection === 'new' ? undefined : editingCollection}
          onClose={() => setEditingCollection(null)}
        />
      )}
    </div>
  );
};

export default Dashboard;
