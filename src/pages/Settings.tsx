import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, Download, Upload, Trash2, 
  Sun, Moon, Palette, Cloud, RefreshCw, CheckCircle2, AlertCircle
} from 'lucide-react';
import { db } from '../db/db';
import { syncService, type GitHubSyncConfig } from '../db/sync';

const Settings: React.FC = () => {
  const [theme, setTheme] = useState(() => localStorage.getItem('hoarding_theme') || 'light');
  const [accent, setAccent] = useState(() => localStorage.getItem('hoarding_accent') || 'purple');
  
  // GitHub Sync State
  const [ghConfig, setGhConfig] = useState<GitHubSyncConfig>(() => 
    syncService.getConfig() || { token: '', owner: '', repo: '', path: 'hoard_backup.json' }
  );
  const [syncStatus, setSyncStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error', msg?: string }>({ type: 'idle' });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('hoarding_theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-accent', accent);
    localStorage.setItem('hoarding_accent', accent);
  }, [accent]);

  const handleSaveConfig = () => {
    syncService.saveConfig(ghConfig);
    setSyncStatus({ type: 'success', msg: 'GitHub configuration saved locally.' });
    setTimeout(() => setSyncStatus({ type: 'idle' }), 3000);
  };

  const handlePush = async () => {
    setSyncStatus({ type: 'loading', msg: 'Pushing to GitHub...' });
    try {
      await syncService.push();
      setSyncStatus({ type: 'success', msg: 'Successfully backed up to GitHub!' });
    } catch (e: any) {
      setSyncStatus({ type: 'error', msg: e.message });
    }
  };

  const handlePull = async () => {
    if (!confirm('This will overwrite your local data with the GitHub backup. Continue?')) return;
    setSyncStatus({ type: 'loading', msg: 'Pulling from GitHub...' });
    try {
      await syncService.pull();
      setSyncStatus({ type: 'success', msg: 'Successfully restored from GitHub!' });
    } catch (e: any) {
      setSyncStatus({ type: 'error', msg: e.message });
    }
  };

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

  const importData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.collections && data.items) {
          if (confirm('This will append imported data to your current database. Continue?')) {
            await db.collections.bulkPut(data.collections);
            await db.items.bulkPut(data.items);
            alert('Data imported successfully!');
            window.location.reload();
          }
        } else {
          alert('Invalid file format. Must contain collections and items.');
        }
      } catch (err) {
        alert('Failed to parse file.');
      }
    };
    reader.readAsText(file);
  };

  const clearAll = async () => {
    if (confirm('Are you sure you want to delete ALL your data? This cannot be undone.')) {
      await db.collections.clear();
      await db.items.clear();
      alert('All data cleared.');
    }
  };

  const accentThemes = [
    { name: 'Classic', id: 'purple', color: '#aa3bff' },
    { name: 'Emerald', id: 'emerald', color: '#10b981' },
    { name: 'Rose', id: 'rose', color: '#f43f5e' },
    { name: 'Amber', id: 'amber', color: '#f59e0b' },
    { name: 'Indigo', id: 'indigo', color: '#6366f1' },
  ];

  return (
    <div className="settings pb-20">
      <header className="view-header">
        <Link to="/" className="icon-button">
          <ArrowLeft size={24} />
        </Link>
        <h1>Settings</h1>
      </header>

      <div className="settings-content space-y-8">
        {syncStatus.type !== 'idle' && (
          <div className={`p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 ${
            syncStatus.type === 'error' ? 'bg-danger/10 text-danger' : 
            syncStatus.type === 'success' ? 'bg-success/10 text-success' : 'bg-accent/10 text-accent'
          }`}>
            {syncStatus.type === 'loading' && <RefreshCw className="animate-spin" size={20} />}
            {syncStatus.type === 'success' && <CheckCircle2 size={20} />}
            {syncStatus.type === 'error' && <AlertCircle size={20} />}
            <span className="text-sm font-bold">{syncStatus.msg}</span>
          </div>
        )}

        <section>
          <h2 className="text-sm font-bold uppercase tracking-widest opacity-50 mb-4">Appearance</h2>
          <div className="settings-list">
            <div className="settings-item flex justify-between">
              <div className="flex items-center gap-4">
                {theme === 'light' ? <Sun size={20} /> : <Moon size={20} />}
                <span>Dark Mode</span>
              </div>
              <button 
                className={`w-12 h-6 rounded-full transition-colors relative ${theme === 'dark' ? 'bg-accent' : 'bg-border'}`}
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${theme === 'dark' ? 'left-7' : 'left-1'}`} />
              </button>
            </div>

            <div className="settings-item flex-col items-start gap-4">
              <div className="flex items-center gap-4">
                <Palette size={20} />
                <span>Accent Theme</span>
              </div>
              <div className="flex gap-3 w-full justify-between px-2">
                {accentThemes.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setAccent(t.id)}
                    className={`w-8 h-8 rounded-full border-4 transition-transform ${accent === t.id ? 'scale-125 border-white shadow-lg' : 'border-transparent opacity-60'}`}
                    style={{ backgroundColor: t.color }}
                    title={t.name}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-bold uppercase tracking-widest opacity-50 mb-4 flex items-center gap-2">
            <Cloud size={16} /> GitHub Sync (Private Storage)
          </h2>
          <div className="bg-bg-secondary p-4 rounded-xl border border-border space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase opacity-50 mb-1">Personal Access Token</label>
              <input 
                type="password" 
                placeholder="ghp_xxxxxxxxxxxx"
                className="w-full rounded-lg border border-border bg-bg p-2 text-sm outline-none"
                value={ghConfig.token}
                onChange={e => setGhConfig({ ...ghConfig, token: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase opacity-50 mb-1">Username/Owner</label>
                <input 
                  type="text" 
                  placeholder="GitHub Username"
                  className="w-full rounded-lg border border-border bg-bg p-2 text-sm outline-none"
                  value={ghConfig.owner}
                  onChange={e => setGhConfig({ ...ghConfig, owner: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase opacity-50 mb-1">Repository Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. hoard-data"
                  className="w-full rounded-lg border border-border bg-bg p-2 text-sm outline-none"
                  value={ghConfig.repo}
                  onChange={e => setGhConfig({ ...ghConfig, repo: e.target.value })}
                />
              </div>
            </div>
            <button 
              onClick={handleSaveConfig}
              className="w-full p-2 bg-border hover:bg-accent hover:text-white rounded-lg text-sm font-bold transition-all"
            >
              Save Configuration
            </button>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <button 
                onClick={handlePush}
                className="flex items-center justify-center gap-2 p-3 bg-accent text-white rounded-lg font-bold hover:opacity-90 transition-all"
              >
                <Upload size={18} /> Push
              </button>
              <button 
                onClick={handlePull}
                className="flex items-center justify-center gap-2 p-3 bg-bg border border-accent text-accent rounded-lg font-bold hover:bg-accent/5 transition-all"
              >
                <Download size={18} /> Pull
              </button>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-bold uppercase tracking-widest opacity-50 mb-4">Local Data</h2>
          <div className="settings-list">
            <button className="settings-item" onClick={exportData}>
              <Download size={20} />
              <span>Export Database (JSON)</span>
            </button>
            <label className="settings-item cursor-pointer">
              <Upload size={20} />
              <span>Import Database (JSON)</span>
              <input type="file" accept=".json" className="hidden" onChange={importData} />
            </label>
            <button className="settings-item danger" onClick={clearAll}>
              <Trash2 size={20} />
              <span>Clear All Local Data</span>
            </button>
          </div>
        </section>

        <section className="pt-8 text-center opacity-40">
          <p className="text-sm">Type-A-Hoarding v0.1.0</p>
          <p className="text-xs">Secure GitHub-Powered Personal Storage</p>
        </section>
      </div>
    </div>
  );
};

export default Settings;
