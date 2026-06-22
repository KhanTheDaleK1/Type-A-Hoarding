import { useState, useMemo, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { 
  ArrowLeft, Plus, Search, Filter, X, 
  LayoutList, Grid, List, Shuffle, Share2, Menu, Wand2, CheckCircle2, Lightbulb, Sparkles
} from 'lucide-react';
import { initialFilters, filterItems } from '../hooks/useFilters';
import type { FilterOptions } from '../hooks/useFilters';
import type { Item } from '../types';
import ItemEditor from '../components/ItemEditor';
import MovieWheel from '../components/MovieWheel';
import ShareModal from '../components/ShareModal';
import BatchScanModal from '../components/BatchScanModal';
import { fetchMetadataInBackground } from '../db/import';
import { useSeriesDetector } from '../hooks/useSeriesDetector';

type ViewMode = 'compact' | 'grid' | 'detailed';

const CollectionView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [showFilters, setShowFilters] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBatchScan, setShowBatchScan] = useState(false);
  const [showWheel, setShowWheel] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>(initialFilters);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem('hoarding_view_mode') as ViewMode) || 'detailed';
  });

  const collection = useLiveQuery(() => db.collections.get(id || ''));
  const rawItems = useLiveQuery(() => db.items.where('collectionId').equals(id || '').toArray(), [id]);
  
  const seriesSuggestions = useSeriesDetector(rawItems || [], collection);

  const handleApplySeries = async (suggestion: { seriesName: string; items: Item[] }) => {
    if (!collection) return;
    
    // Ensure collection has 'series' field
    const hasSeriesField = collection.customFields?.some(f => f.id === 'series');
    if (!hasSeriesField) {
      await db.collections.update(collection.id, {
        customFields: [...(collection.customFields || []), { id: 'series', name: 'Series Name', type: 'text' }]
      });
    }

    // Update items
    const itemsToUpdate = suggestion.items.map(i => ({
      ...i,
      customData: {
        ...i.customData,
        series: suggestion.seriesName
      }
    }));
    await db.items.bulkPut(itemsToUpdate);
  };

  const handleRepair = async () => {
    if (!rawItems || rawItems.length === 0) return;
    setIsRepairing(true);
    try {
      // Test if backend is reachable
      const base = localStorage.getItem('hoarding_api_url') || 'https://hoardbackend.beechem.site';
      const testRes = await fetch(`${base}/api/github/config`).catch(() => null);
      if (!testRes || !testRes.ok) {
        alert('Cannot connect to the backend server. Please verify your "Backend API URL" in Settings and ensure the server is running!');
        setIsRepairing(false);
        return;
      }

      await fetchMetadataInBackground(rawItems, id);
      alert('Metadata repair complete! Missing art and info have been fetched where possible.');
    } catch (e) {
      console.error('Repair failed:', e);
      alert('Metadata repair encountered an error.');
    } finally {
      setIsRepairing(false);
    }
  };

  useEffect(() => {
    localStorage.setItem('hoarding_view_mode', viewMode);
  }, [viewMode]);

  // Shake detection (DeviceMotion API)
  useEffect(() => {
    let lastX: number | null = null;
    let lastY: number | null = null;
    let lastZ: number | null = null;
    let threshold = 15;

    const handleMotion = (event: DeviceMotionEvent) => {
      const acc = event.accelerationIncludingGravity;
      if (!acc) return;

      const { x, y, z } = acc;
      if (lastX !== null && lastY !== null && lastZ !== null) {
        const deltaX = Math.abs(x! - lastX);
        const deltaY = Math.abs(y! - lastY);
        const deltaZ = Math.abs(z! - lastZ);

        if ((deltaX > threshold && deltaY > threshold) || (deltaX > threshold && deltaZ > threshold) || (deltaY > threshold && deltaZ > threshold)) {
          if (collection?.type === 'Movies') {
            setShowWheel(true);
          } else {
            pickRandomItem();
          }
        }
      }

      lastX = x; lastY = y; lastZ = z;
    };

    window.addEventListener('devicemotion', handleMotion);
    return () => window.removeEventListener('devicemotion', handleMotion);
  }, [rawItems, collection]);

  const pickRandomItem = () => {
    const itemsToPickFrom = (rawItems || []).filter(i => !i.watched);
    if (!itemsToPickFrom.length) return;
    const randomIndex = Math.floor(Math.random() * itemsToPickFrom.length);
    const item = itemsToPickFrom[randomIndex];
    window.location.hash = `/item/${item.id}`;
  };

  const handleMarkWatched = async (item: Item) => {
    const dateField = collection?.type === 'Books' ? 'dateRead' : 'dateWatched';
    await db.items.update(item.id, { 
      watched: true, 
      customData: { ...item.customData, [dateField]: new Date().toISOString().split('T')[0] } 
    });
    setShowWheel(false);
  };

  const filteredItems = useMemo(() => {
    return rawItems ? filterItems(rawItems, filters) : [];
  }, [rawItems, filters]);

  const alphabet = useMemo(() => {
    const chars = new Set(filteredItems.map(i => i.sortTitle?.[0]?.toUpperCase() || '#'));
    return Array.from(chars).sort();
  }, [filteredItems]);

  const scrollToLetter = (letter: string) => {
    const element = document.getElementById(`letter-${letter}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  if (!collection) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="collection-view pb-20">
      <header className="view-header sticky top-0 bg-bg/80 backdrop-blur-md z-[60] border-b border-border py-4 px-4 mb-6">
        <div className="flex items-center gap-3">
          <Link to="/" className="icon-button">
            <ArrowLeft size={24} />
          </Link>
          <div className="overflow-hidden">
            <h1 className="text-lg font-black truncate">{collection.name}</h1>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-40">{filteredItems.length} items</p>
          </div>
        </div>
        
        <div className="header-actions flex gap-2">
          <button 
            className="icon-button bg-accent/10 text-accent border border-accent/20 shadow-xl"
            onClick={() => setShowBatchScan(true)}
            title="Batch AI Scan"
          >
            <Sparkles size={24} />
          </button>
          <button 
            className="icon-button accent shadow-xl"
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={28} />
          </button>
          <button 
            className={`icon-button ${showMenu ? 'bg-bg-secondary shadow-inner' : ''}`}
            onClick={() => setShowMenu(!showMenu)}
          >
            <Menu size={24} />
          </button>
        </div>
      </header>

      {/* Hamburger Menu Overlay */}
      {showMenu && (
        <div className="fixed inset-0 z-[100] animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowMenu(false)} />
          <div className="absolute top-20 right-4 w-64 bg-bg border border-border rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-top-4 zoom-in-95 duration-200">
             <div className="p-2 space-y-1">
                <button 
                  className="w-full flex items-center gap-4 px-4 py-4 hover:bg-bg-secondary rounded-2xl transition-colors font-bold text-sm"
                  onClick={() => { setShowFilters(!showFilters); setShowMenu(false); }}
                >
                  <Filter size={20} className={showFilters ? 'text-accent' : ''} />
                  <span>{showFilters ? 'Hide Filters' : 'Show Filters'}</span>
                </button>

                <button 
                  className="w-full flex items-center gap-4 px-4 py-4 hover:bg-bg-secondary rounded-2xl transition-colors font-bold text-sm"
                  onClick={() => { setShowShare(true); setShowMenu(false); }}
                >
                  <Share2 size={20} />
                  <span>Share Collection</span>
                </button>

                <button
                  className="w-full flex items-center gap-4 px-4 py-4 hover:bg-bg-secondary rounded-2xl transition-colors font-bold text-sm"
                  onClick={() => {
                    if (collection.type === 'Movies' || collection.type === 'Books') setShowWheel(true);
                    else pickRandomItem();
                    setShowMenu(false);
                  }}
                >
                  <Shuffle size={20} />
                  <span>{collection.type === 'Movies' ? 'Movie Roulette' : collection.type === 'Books' ? 'Book Roulette' : 'Random Pick'}</span>
                </button>

                <button
                  className="w-full flex items-center gap-4 px-4 py-4 hover:bg-bg-secondary rounded-2xl transition-colors font-bold text-sm text-accent"
                  onClick={() => { handleRepair(); setShowMenu(false); }}
                  disabled={isRepairing}
                >
                  <Wand2 size={20} className={isRepairing ? "animate-pulse" : ""} />
                  <span>{isRepairing ? 'Repairing...' : 'Repair Metadata'}</span>
                </button>

                <div className="h-px bg-border my-2 mx-4" />
                <div className="px-4 py-2">
                   <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-3">View Mode</p>
                   <div className="grid grid-cols-3 gap-2 bg-bg-secondary p-1 rounded-2xl">
                      {[
                        { id: 'compact', icon: List },
                        { id: 'grid', icon: Grid },
                        { id: 'detailed', icon: LayoutList }
                      ].map((mode) => (
                        <button
                          key={mode.id}
                          onClick={() => setViewMode(mode.id as ViewMode)}
                          className={`flex items-center justify-center py-2 rounded-xl transition-all ${viewMode === mode.id ? 'bg-bg shadow-sm text-accent scale-105' : 'opacity-40 hover:opacity-100'}`}
                        >
                          <mode.icon size={18} />
                        </button>
                      ))}
                   </div>
                </div>
             </div>
          </div>
        </div>
      )}

      {showFilters && (
        <div className="filter-bar bg-bg-secondary p-4 rounded-xl border border-border mx-4 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Filters</h3>
            <button onClick={() => setShowFilters(false)} className="p-2"><X size={20} /></button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="search-input relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search items..."
                className="w-full pl-10 pr-4 py-2 bg-bg border border-border rounded-lg outline-none focus:border-accent"
                value={filters.search}
                onChange={e => setFilters({ ...filters, search: e.target.value })}
              />
            </div>

            <select 
              className="p-2 bg-bg border border-border rounded-lg outline-none"
              value={filters.readStatus}
              onChange={e => setFilters({ ...filters, readStatus: e.target.value as any })}
            >
              <option value="all">All Statuses</option>
              <option value="unread">TBR / Unwatched</option>
              <option value="read">Already Read / Watched</option>
            </select>

            <select 
              className="p-2 bg-bg border border-border rounded-lg outline-none"
              value={filters.sortBy}
              onChange={e => setFilters({ ...filters, sortBy: e.target.value as any })}
            >
              <option value="title">Sort by Title</option>
              <option value="dateAdded">Sort by Date Added</option>
              <option value="rating">Sort by Rating</option>
              <option value="value">Sort by Value</option>
            </select>
          </div>
        </div>
      )}

      {/* Series Insights Banner */}
      {seriesSuggestions.length > 0 && (
        <div className="mx-4 mb-6 animate-in fade-in slide-in-from-top-4">
          {seriesSuggestions.map((sug, i) => (
            <div key={i} className="bg-accent/10 border border-accent/20 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 mb-2 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="bg-accent text-white p-2 rounded-full shadow-md">
                  <Lightbulb size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-accent">Smart Detection</h4>
                  <p className="text-xs opacity-80">
                    We noticed {sug.items.length} books that look like they belong to the <strong>"{sug.seriesName}"</strong> series.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => handleApplySeries(sug)}
                className="whitespace-nowrap px-4 py-2 bg-accent text-white text-xs font-bold rounded-lg shadow-md hover:bg-accent-hover transition-all active:scale-95"
              >
                Group as Series
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Alphabet Index Bar */}
      {viewMode !== 'grid' && alphabet.length > 5 && (
        <div className="alphabet-bar">
          {alphabet.map(char => (
            <button key={char} onClick={() => scrollToLetter(char)}>{char}</button>
          ))}
        </div>
      )}

      <div className={`item-list ${viewMode} px-4`}>
        {filteredItems.map((item, index) => {
          const firstLetter = item.sortTitle?.[0]?.toUpperCase() || '#';
          const prevLetter = index > 0 ? filteredItems[index - 1].sortTitle?.[0]?.toUpperCase() : null;
          const showAnchor = firstLetter !== prevLetter;

          return (
            <Link 
              key={item.id} 
              to={`/item/${item.id}`} 
              className={`item-row group ${item.watched ? 'opacity-40 grayscale-[0.5]' : ''}`}
              id={showAnchor ? `letter-${firstLetter}` : undefined}
            >
              <div className="item-thumbnail relative">
                {item.images[0] ? <img src={item.images[0]} alt="" /> : <div className="placeholder" />}
                
                {/* Detailed & Grid overlay checkmark */}
                {viewMode !== 'compact' && (
                  <button
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const dateField = collection.type === 'Books' ? 'dateRead' : 'dateWatched';
                      await db.items.update(item.id, { 
                        watched: !item.watched, 
                        customData: { 
                          ...item.customData, 
                          [dateField]: !item.watched ? new Date().toISOString().split('T')[0] : '' 
                        } 
                      });
                    }}
                    className={`absolute bottom-2 right-2 p-2 rounded-full border shadow-xl backdrop-blur-md transition-all active:scale-75 pointer-events-auto z-20 ${
                      item.watched 
                        ? 'bg-success text-white border-success' 
                        : 'bg-black/60 text-white/60 border-white/10 hover:bg-black/80 hover:text-white lg:opacity-0 lg:group-hover:opacity-100'
                    }`}
                    title={item.watched ? `Mark as Un${collection.type === 'Books' ? 'read' : 'watched'}` : `Mark as ${collection.type === 'Books' ? 'Read' : 'Watched'}`}
                  >
                    <CheckCircle2 size={16} className={item.watched ? 'fill-white/20' : ''} />
                  </button>
                )}
              </div>
              
              <div className="item-info flex-grow">
                <div className="flex justify-between items-start">
                  <h3 className="font-bold">{item.title}</h3>
                </div>
                <p className="text-sm opacity-70">
                  {collection.type === 'Books' ? (
                    <>{item.customData.author || 'Unknown Author'} • {item.customData.year || 'Unknown'}</>
                  ) : (
                    <>{item.customData.year || 'Unknown'} • {item.customData.contentRating || 'Unknown'}</>
                  )}
                </p>
                {viewMode === 'detailed' && item.notes && (
                  <p className="mt-2 text-sm italic line-clamp-2">{item.notes}</p>
                )}
                {viewMode === 'detailed' && (item.mediaType || item.watched || item.customData?.series) && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {item.customData?.series && (
                      <span className="inline-block text-[10px] font-bold uppercase tracking-wider bg-indigo-500 text-white px-2 py-0.5 rounded shadow-sm">
                        Series: {item.customData.series}
                      </span>
                    )}
                    {item.mediaType && (
                      <span className="inline-block text-[10px] font-bold uppercase tracking-wider bg-accent text-white px-2 py-0.5 rounded shadow-sm">
                        {item.mediaType}
                      </span>
                    )}
                    {item.watched && (
                      <span className="inline-block text-[10px] font-bold uppercase tracking-wider bg-gray-500 text-white px-2 py-0.5 rounded shadow-sm">
                        {collection.type === 'Books' ? 'Read' : 'Watched'}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Compact view inline checkmark on the right */}
              {viewMode === 'compact' && (
                <button
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const dateField = collection.type === 'Books' ? 'dateRead' : 'dateWatched';
                    await db.items.update(item.id, { 
                      watched: !item.watched, 
                      customData: { 
                        ...item.customData, 
                        [dateField]: !item.watched ? new Date().toISOString().split('T')[0] : '' 
                      } 
                    });
                  }}
                  className={`p-2 rounded-xl transition-all ml-auto pointer-events-auto z-20 ${
                    item.watched 
                      ? 'text-success hover:bg-success/10' 
                      : 'text-gray-400 hover:bg-accent/10 hover:text-accent'
                  }`}
                  title={item.watched ? `Mark as Un${collection.type === 'Books' ? 'read' : 'watched'}` : `Mark as ${collection.type === 'Books' ? 'Read' : 'Watched'}`}
                >
                  <CheckCircle2 size={20} className={item.watched ? 'fill-success/20' : ''} />
                </button>
              )}
            </Link>
          );
        })}
        {filteredItems.length === 0 && (
          <p className="empty-state text-center py-12 text-gray-500 font-bold uppercase text-xs tracking-widest">
            {filters.search ? 'No matches found.' : 'Your collection is empty.'}
          </p>
        )}
      </div>

      {showAddModal && (
        <ItemEditor 
          collection={collection} 
          onClose={() => setShowAddModal(false)} 
        />
      )}

      {showBatchScan && (
        <BatchScanModal 
          collection={collection}
          onClose={() => setShowBatchScan(false)}
        />
      )}

      {showWheel && (
        <MovieWheel 
          items={rawItems || []} 
          collectionType={collection?.type}
          onClose={() => setShowWheel(false)} 
          onWatched={handleMarkWatched}
        />
      )}

      {showShare && (
        <ShareModal 
          collection={collection}
          syncToken={JSON.parse(localStorage.getItem('hoarding_github_config') || '{}').token}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
};

export default CollectionView;
