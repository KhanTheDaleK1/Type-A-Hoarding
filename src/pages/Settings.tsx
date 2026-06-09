import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, Upload, Trash2 } from 'lucide-react';
import { db } from '../db/db';

const Settings: React.FC = () => {
  const exportData = async () => {
    const collections = await db.collections.toArray();
    const items = await db.items.toArray();
    const data = JSON.stringify({ collections, items }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `type-a-hoarding-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const clearAll = async () => {
    if (confirm('Are you sure you want to delete ALL your data? This cannot be undone.')) {
      await db.collections.clear();
      await db.items.clear();
      alert('All data cleared.');
    }
  };

  return (
    <div className="settings">
      <header className="view-header">
        <Link to="/" className="icon-button">
          <ArrowLeft size={24} />
        </Link>
        <h1>Settings</h1>
      </header>

      <div className="settings-content">
        <section>
          <h2>Data Management</h2>
          <div className="settings-list">
            <button className="settings-item" onClick={exportData}>
              <Download size={20} />
              <span>Export Entire Database (JSON)</span>
            </button>
            <button className="settings-item">
              <Upload size={20} />
              <span>Import Data (CSV/JSON)</span>
            </button>
            <button className="settings-item danger" onClick={clearAll}>
              <Trash2 size={20} />
              <span>Clear All Data</span>
            </button>
          </div>
        </section>

        <section>
          <h2>About</h2>
          <p>Type-A-Hoarding v0.1.0</p>
          <p>A local-first PWA for extreme collection management.</p>
        </section>
      </div>
    </div>
  );
};

export default Settings;
