import { useState, useMemo, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { 
  ArrowLeft, Plus, Search, Filter, X, 
  LayoutList, Grid, List, Shuffle, Share2
} from 'lucide-react';
import { initialFilters, filterItems } from '../hooks/useFilters';
import type { FilterOptions } from '../hooks/useFilters';
import type { Item } from '../types';
import ItemEditor from '../components/ItemEditor';
import MovieWheel from '../components/MovieWheel';
import ShareModal from '../components/ShareModal';

type ViewMode = 'compact' | 'grid' | 'detailed';

const CollectionView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [showFilters, setShowFilters] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showWheel, setShowWheel] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>(initialFilters);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem('hoarding_view_mode') as ViewMode) || 'detailed';
  });

  const collection = useLiveQuery(() => db.collections.get(id || ''));
  const rawItems = useLiveQuery(() => db.items.where('collectionId').equals(id || '').toArray(), [id]);

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
    await db.items.update(item.id, { 
      watched: true, 
      customData: { ...item.customData, dateWatched: new Date().toISOString().split('T')[0] } 
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
      <header className="view-header">
        <div className="flex items-center gap-4">
          <Link to="/" className="icon-button">
            <ArrowLeft size={24} />
          </Link>
          <div>
            <h1 className="text-xl font-bold">{collection.name}</h1>
            <p className="text-sm opacity-60">{filteredItems.length} items</p>
          </div>
        </div>
        
        <div className="header-actions">
          <button 
            className="icon-button"
            onClick={() => setShowShare(true)}
            title="Share Collection"
          >
            <Share2 size={20} />
          </button>
          <button 
            className={`icon-button ${showWheel ? 'accent' : ''}`}
            onClick={() => collection.type === 'Movies' ? setShowWheel(true) : pickRandomItem()}
            title="Random Pick"
          >
            <Shuffle size={20} />
          </button>
          <div className="flex bg-bg-secondary rounded-lg p-1">
            <button 
              className={`icon-button !min-w-[40px] !min-height-[40px] ${viewMode === 'compact' ? 'accent' : ''}`}
              onClick={() => setViewMode('compact')}
            >
              <List size={18} />
            </button>
            <button 
              className={`icon-button !min-w-[40px] !min-height-[40px] ${viewMode === 'grid' ? 'accent' : ''}`}
              onClick={() => setViewMode('grid')}
            >
              <Grid size={18} />
            </button>
            <button 
              className={`icon-button !min-w-[40px] !min-height-[40px] ${viewMode === 'detailed' ? 'accent' : ''}`}
              onClick={() => setViewMode('detailed')}
            >
              <LayoutList size={18} />
            </button>
          </div>
          <button 
            className={`icon-button ${showFilters ? 'accent' : ''}`} 
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={20} />
          </button>
          <button 
            className="icon-button accent shadow-xl"
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={28} />
          </button>
        </div>
      </header>

      {showFilters && (
        <div className="filter-bar bg-bg-secondary p-4 rounded-xl border border-border mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Filters</h3>
            <button onClick={() => setShowFilters(false)}><X size={20} /></button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="search-input relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search items..."
                className="w-full pl-10 pr-4 py-2 bg-bg border border-border rounded-lg"
                value={filters.search}
                onChange={e => setFilters({ ...filters, search: e.target.value })}
              />
            </div>

            <select 
              className="p-2 bg-bg border border-border rounded-lg"
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

      {/* Alphabet Index Bar */}
      {viewMode !== 'grid' && alphabet.length > 5 && (
        <div className="alphabet-bar">
          {alphabet.map(char => (
            <button key={char} onClick={() => scrollToLetter(char)}>{char}</button>
          ))}
        </div>
      )}

      <div className={`item-list ${viewMode}`}>
        {filteredItems.map((item, index) => {
          const firstLetter = item.sortTitle?.[0]?.toUpperCase() || '#';
          const prevLetter = index > 0 ? filteredItems[index - 1].sortTitle?.[0]?.toUpperCase() : null;
          const showAnchor = firstLetter !== prevLetter;

          return (
            <Link 
              key={item.id} 
              to={`/item/${item.id}`} 
              className={`item-row ${item.watched ? 'opacity-40 grayscale-[0.5]' : ''}`}
              id={showAnchor ? `letter-${firstLetter}` : undefined}
            >
              <div className="item-thumbnail">
                {item.images[0] ? <img src={item.images[0]} alt="" /> : <div className="placeholder" />}
              </div>
              <div className="item-info">
                <div className="flex justify-between items-start">
                  <h3 className="font-bold">{item.title}</h3>
                </div>
                <p className="text-sm opacity-70">
                  {item.customData.year || 'Unknown'} • {item.customData.contentRating || 'NR'}
                </p>
                {viewMode === 'detailed' && item.notes && (
                  <p className="mt-2 text-sm italic line-clamp-2">{item.notes}</p>
                )}
                {viewMode === 'detailed' && (item.mediaType || item.watched) && (
                  <div className="flex gap-2 mt-2">
                    {item.mediaType && (
                      <span className="inline-block text-[10px] font-bold uppercase tracking-wider bg-accent text-white px-2 py-0.5 rounded shadow-sm">
                        {item.mediaType}
                      </span>
                    )}
                    {item.watched && (
                      <span className="inline-block text-[10px] font-bold uppercase tracking-wider bg-gray-500 text-white px-2 py-0.5 rounded shadow-sm">
                        Watched
                      </span>
                    )}
                  </div>
                )}
              </div>
            </Link>
          );
        })}
        {filteredItems.length === 0 && (
          <p className="empty-state text-center py-12 text-gray-500">
            No items match your criteria.
          </p>
        )}
      </div>

      {showAddModal && (
        <ItemEditor 
          collection={collection} 
          onClose={() => setShowAddModal(false)} 
        />
      )}

      {showWheel && (
        <MovieWheel 
          items={rawItems || []} 
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
