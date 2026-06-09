import React from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Plus, Settings as SettingsIcon, Package } from 'lucide-react';

const Dashboard: React.FC = () => {
  const collections = useLiveQuery(() => db.collections.toArray());

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>My Collections</h1>
        <div className="header-actions">
          <Link to="/settings" className="icon-button">
            <SettingsIcon size={24} />
          </Link>
        </div>
      </header>

      <div className="collection-grid">
        {collections?.map((collection) => (
          <Link 
            key={collection.id} 
            to={`/collection/${collection.id}`} 
            className="collection-card"
          >
            <div className="card-icon">
              <Package size={32} />
            </div>
            <div className="card-content">
              <h2>{collection.name}</h2>
              <p>{collection.type}</p>
            </div>
          </Link>
        ))}

        <button className="collection-card add-card" onClick={() => {/* TODO: Add collection modal */}}>
          <div className="card-icon">
            <Plus size={32} />
          </div>
          <div className="card-content">
            <h2>Add New</h2>
            <p>Create a collection</p>
          </div>
        </button>
      </div>
    </div>
  );
};

export default Dashboard;
