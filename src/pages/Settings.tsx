import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, Download, Upload, Trash2, 
  Sun, Moon, Palette, Cloud, RefreshCw, CheckCircle2, AlertCircle,
  LogOut, FileUp, FileDown
} from 'lucide-react';
import { db } from '../db/db';
import { useAuth } from '../contexts/AuthContext';
import { syncService, type GitHubSyncConfig } from '../db/sync';
import { importGoodreadsCSV } from '../db/import';

const Settings: React.FC = () => {
  const { logout } = useAuth();
  const [theme, setTheme] = useState(() => localStorage.getItem('hoarding_theme') || 'light');
  const [accent, setAccent] = useState(() => localStorage.getItem('hoarding_accent') || 'purple');
  
  // GitHub Sync State
  const [ghConfig, setGhConfig] = useState<GitHubSyncConfig>(() => 
    syncService.getConfig() || { token: '', owner: '', repo: '', path: 'hoard_backup.json' }
  );
  const [syncStatus, setSyncStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error', msg?: string }>({ type: 'idle' });
  const [apiUrl, setApiUrl] = useState(() => localStorage.getItem('hoarding_api_url') || 'https://hoardbackend.beechem.site');

  const handleSaveApiUrl = () => {
    const cleanUrl = apiUrl.trim().replace(/\/$/, '');
    setApiUrl(cleanUrl);
    localStorage.setItem('hoarding_api_url', cleanUrl);
    setSyncStatus({ type: 'success', msg: 'Backend Server URL saved.' });
    setTimeout(() => setSyncStatus({ type: 'idle' }), 3000);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('hoarding_theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-accent', accent);
    localStorage.setItem('hoarding_accent', accent);
  }, [accent]);

  const [apiKeys, setApiKeys] = useState(() => {
    const saved = localStorage.getItem('hoarding_api_keys');
    return saved ? JSON.parse(saved) : { tmdb: '', omdb: '' };
  });

  useEffect(() => {
    localStorage.setItem('hoarding_api_keys', JSON.stringify(apiKeys));
  }, [apiKeys]);

  const [excludeImages, setExcludeImages] = useState(() => localStorage.getItem('hoarding_exclude_images_backup') === 'true');

  useEffect(() => {
    localStorage.setItem('hoarding_exclude_images_backup', excludeImages ? 'true' : 'false');
  }, [excludeImages]);

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

  const handleGoodreadsImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // First, find or create a 'Books' collection
    let booksCollection = await db.collections.where('type').equals('Books').first();
    if (!booksCollection) {
      const id = crypto.randomUUID();
      await db.collections.add({
        id,
        name: 'Goodreads Library',
        type: 'Books',
        createdAt: Date.now(),
        customFields: [
          { id: 'author', name: 'Author', type: 'text' },
          { id: 'isbn', name: 'ISBN', type: 'text' },
          { id: 'year', name: 'Year Published', type: 'number' }
        ]
      });
      booksCollection = await db.collections.get(id);
    }

    if (!booksCollection) return;

    setSyncStatus({ type: 'loading', msg: 'Importing Goodreads CSV...' });
    try {
      const count = await importGoodreadsCSV(file, booksCollection.id);
      setSyncStatus({ type: 'success', msg: `Successfully imported ${count} books!` });
    } catch (err) {
      setSyncStatus({ type: 'error', msg: 'Failed to import CSV.' });
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

  const handleDeduplicate = async () => {
    if (!confirm('This will find and merge duplicate collections with the same name and category, and remove duplicate items within each collection. Proceed?')) return;
    
    setSyncStatus({ type: 'loading', msg: 'Deduplicating database...' });
    try {
      const collections = await db.collections.toArray();
      const items = await db.items.toArray();

      let collectionsDeleted = 0;
      let itemsDeleted = 0;

      // 1. Deduplicate Collections
      const keptCollections: { [key: string]: string } = {}; // key -> id
      const collectionIdMap: { [oldId: string]: string } = {}; // oldId -> newId

      for (const c of collections) {
        const key = `${c.name.trim().toLowerCase()}|${c.type}`;
        if (!keptCollections[key]) {
          keptCollections[key] = c.id;
          collectionIdMap[c.id] = c.id;
        } else {
          collectionIdMap[c.id] = keptCollections[key];
          collectionsDeleted++;
          await db.collections.delete(c.id);
        }
      }

      // 2. Update item collectionIds if their collection was merged
      const updatedItems = [];
      for (const item of items) {
        const targetCollectionId = collectionIdMap[item.collectionId];
        if (targetCollectionId && targetCollectionId !== item.collectionId) {
          item.collectionId = targetCollectionId;
          await db.items.update(item.id, { collectionId: targetCollectionId });
        }
        updatedItems.push(item);
      }

      // 3. Deduplicate Items within each collection
      const seenItems = new Map<string, typeof items[0]>();
      const itemsToDelete = [];

      for (const item of updatedItems) {
        const title = (item.title || '').trim().toLowerCase();
        const author = (item.customData?.author || '').trim().toLowerCase();
        const isbn = (item.customData?.isbn || '').replace(/[^0-9]/g, '');

        const itemKey = `${item.collectionId}|${isbn ? `isbn:${isbn}` : `title:${title}|author:${author}`}`;

        if (!seenItems.has(itemKey)) {
          seenItems.set(itemKey, item);
        } else {
          const existing = seenItems.get(itemKey)!;
          const existingScore = (existing.images?.[0] ? 10 : 0) + 
                                (existing.notes ? 5 : 0) + 
                                (existing.personalRating ? 2 : 0) + 
                                (existing.storageLocation ? 1 : 0);
          const currentScore = (item.images?.[0] ? 10 : 0) + 
                               (item.notes ? 5 : 0) + 
                               (item.personalRating ? 2 : 0) + 
                               (item.storageLocation ? 1 : 0);

          if (currentScore > existingScore) {
            itemsToDelete.push(existing.id);
            seenItems.set(itemKey, item);
          } else {
            itemsToDelete.push(item.id);
          }
          itemsDeleted++;
        }
      }

      if (itemsToDelete.length > 0) {
        await db.items.bulkDelete(itemsToDelete);
      }

      // If GitHub sync is configured, push the cleaned database immediately
      const config = syncService.getConfig();
      let syncMsg = '';
      if (config && config.token && config.owner && config.repo) {
        setSyncStatus({ type: 'loading', msg: 'Deduplication complete! Syncing cleaned data to GitHub...' });
        try {
          await syncService.push();
          syncMsg = ' and synced to GitHub';
        } catch (pushErr: any) {
          console.error('Failed to push cleaned data to GitHub:', pushErr);
          setSyncStatus({ 
            type: 'error', 
            msg: `Deduplicated locally, but failed to upload to GitHub: ${pushErr.message || pushErr}. Reload/sync cancelled to prevent override.` 
          });
          return; // STOP! Do not reload or proceed.
        }
      }

      setSyncStatus({ 
        type: 'success', 
        msg: `Deduplication complete! Removed ${collectionsDeleted} duplicate collections and ${itemsDeleted} duplicate items${syncMsg}.` 
      });
      
      setTimeout(() => {
        setSyncStatus({ type: 'idle' });
      }, 5000);
      
    } catch (e: any) {
      setSyncStatus({ type: 'error', msg: `Deduplication failed: ${e.message}` });
    }
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
            <div className="settings-item flex justify-between py-4">
              <div className="flex items-center gap-4">
                {theme === 'light' ? <Sun size={24} /> : <Moon size={24} />}
                <span className="font-bold">Dark Mode</span>
              </div>
              <button 
                className={`w-14 h-8 rounded-full transition-colors relative shadow-inner ${theme === 'dark' ? 'bg-accent' : 'bg-border'}`}
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              >
                <div className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-all ${theme === 'dark' ? 'left-7' : 'left-1'}`} />
              </button>
            </div>

            <div className="settings-item flex-col items-start gap-6 py-6">
              <div className="flex items-center gap-4">
                <Palette size={24} />
                <span className="font-bold">Accent Theme</span>
              </div>
              <div className="flex gap-4 w-full justify-between px-2 overflow-x-auto pb-2">
                {accentThemes.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setAccent(t.id)}
                    className={`w-10 h-10 flex-shrink-0 rounded-full border-4 transition-all active:scale-110 ${accent === t.id ? 'scale-125 border-white shadow-xl ring-2 ring-accent' : 'border-transparent opacity-60'}`}
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
            <Cloud size={16} /> External Metadata APIs
          </h2>
          <div className="bg-bg-secondary p-4 rounded-xl border border-border space-y-4">
            <p className="text-[10px] opacity-60 leading-relaxed uppercase font-black">
              Enhance movie & game lookups by providing your own free developer keys.
            </p>
            <div>
              <label className="block text-xs font-bold uppercase opacity-50 mb-1">TMDb API Key (v3)</label>
              <input 
                type="password" 
                placeholder="TheMovieDB Key"
                className="w-full rounded-lg border border-border bg-bg p-2 text-sm outline-none"
                value={apiKeys.tmdb}
                onChange={e => setApiKeys({ ...apiKeys, tmdb: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase opacity-50 mb-1">OMDb API Key</label>
              <input 
                type="password" 
                placeholder="OpenMovieDB Key"
                className="w-full rounded-lg border border-border bg-bg p-2 text-sm outline-none"
                value={apiKeys.omdb}
                onChange={e => setApiKeys({ ...apiKeys, omdb: e.target.value })}
              />
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-bold uppercase tracking-widest opacity-50 mb-4 flex items-center gap-2">
            <RefreshCw size={16} /> Backend Server Connection
          </h2>
          <div className="bg-bg-secondary p-4 rounded-xl border border-border space-y-4">
            <p className="text-[10px] opacity-60 leading-relaxed uppercase font-black">
              Specify the URL of your hosted Express backend server (leave blank if running on the same domain or localhost).
            </p>
            <div>
              <label className="block text-xs font-bold uppercase opacity-50 mb-1">Backend API URL</label>
              <input 
                type="text" 
                placeholder="e.g. https://api.beechem.site"
                className="w-full rounded-lg border border-border bg-bg p-2 text-sm outline-none"
                value={apiUrl}
                onChange={e => setApiUrl(e.target.value)}
              />
            </div>
            <button 
              onClick={handleSaveApiUrl}
              className="w-full p-2 bg-border hover:bg-accent hover:text-white rounded-lg text-sm font-bold transition-all"
            >
              Save Server URL
            </button>
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
            <div className="flex items-center justify-between p-3 bg-bg rounded-xl border border-border">
              <div className="space-y-0.5">
                <span className="text-xs font-bold uppercase opacity-70">Include Images in Backup</span>
                <p className="text-[9px] opacity-40 uppercase font-black leading-tight">Disable if sync fails or for faster, tiny backups.</p>
              </div>
              <button 
                type="button"
                onClick={() => setExcludeImages(!excludeImages)}
                className={`w-12 h-6 rounded-full transition-all relative ${!excludeImages ? 'bg-success' : 'bg-border'}`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${!excludeImages ? 'left-7' : 'left-1'}`} />
              </button>
            </div>

            <div className="flex items-center gap-2 p-3 bg-accent/5 rounded-xl border border-accent/20">
              <RefreshCw size={14} className="text-accent animate-spin-slow" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-accent">Background Auto-Sync Active</span>
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
          <h2 className="text-sm font-bold uppercase tracking-widest opacity-50 mb-4">Data Management</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-bg-secondary p-6 rounded-3xl border border-border space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest opacity-40">Import & Export</h3>
              <div className="space-y-2">
                <button 
                  onClick={exportData}
                  className="w-full flex items-center gap-3 p-3 bg-bg hover:bg-accent/5 border border-border rounded-2xl transition-all group"
                >
                  <div className="p-2 bg-accent/10 rounded-xl text-accent group-hover:bg-accent group-hover:text-white transition-colors">
                    <FileUp size={18} />
                  </div>
                  <span className="text-sm font-bold">Export JSON</span>
                </button>
                
                <label className="w-full flex items-center gap-3 p-3 bg-bg hover:bg-accent/5 border border-border rounded-2xl transition-all group cursor-pointer">
                  <div className="p-2 bg-accent/10 rounded-xl text-accent group-hover:bg-accent group-hover:text-white transition-colors">
                    <FileDown size={18} />
                  </div>
                  <span className="text-sm font-bold">Import JSON</span>
                  <input type="file" accept=".json" className="hidden" onChange={importData} />
                </label>

                <label className="w-full flex items-center gap-3 p-3 bg-bg hover:bg-accent/5 border border-border rounded-2xl transition-all group cursor-pointer">
                  <div className="p-2 bg-accent/10 rounded-xl text-accent group-hover:bg-accent group-hover:text-white transition-colors">
                    <FileDown size={18} />
                  </div>
                  <span className="text-sm font-bold">Goodreads CSV</span>
                  <input type="file" accept=".csv" className="hidden" onChange={handleGoodreadsImport} />
                </label>

                <button 
                  onClick={handleDeduplicate}
                  className="w-full flex items-center gap-3 p-3 bg-bg hover:bg-accent/5 border border-border rounded-2xl transition-all group"
                >
                  <div className="p-2 bg-accent/10 rounded-xl text-accent group-hover:bg-accent group-hover:text-white transition-colors">
                    <RefreshCw size={18} />
                  </div>
                  <span className="text-sm font-bold">Remove Duplicates</span>
                </button>
              </div>
            </div>

            <div className="bg-bg-secondary p-6 rounded-3xl border border-border space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest opacity-40">Account & Safety</h3>
              <div className="space-y-2">
                <button 
                  onClick={logout}
                  className="w-full flex items-center gap-3 p-3 bg-bg hover:bg-bg-secondary border border-border rounded-2xl transition-all group"
                >
                  <div className="p-2 bg-gray-500/10 rounded-xl text-gray-500 group-hover:bg-gray-500 group-hover:text-white transition-colors">
                    <LogOut size={18} />
                  </div>
                  <span className="text-sm font-bold">Log Out</span>
                </button>

                <button 
                  onClick={clearAll}
                  className="w-full flex items-center gap-3 p-3 bg-bg hover:bg-danger/5 border border-border rounded-2xl transition-all group"
                >
                  <div className="p-2 bg-danger/10 rounded-xl text-danger group-hover:bg-danger group-hover:text-white transition-colors">
                    <Trash2 size={18} />
                  </div>
                  <span className="text-sm font-bold text-danger">Wipe Local Data</span>
                </button>
              </div>
            </div>
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
