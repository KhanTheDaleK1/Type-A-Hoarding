import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { ArrowLeft, Plus, Search, Filter, X } from 'lucide-react';
import { initialFilters, filterItems } from '../hooks/useFilters';
import type { FilterOptions } from '../hooks/useFilters';
import ItemEditor from '../components/ItemEditor';

const CollectionView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [showFilters, setShowFilters] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>(initialFilters);

  const collection = useLiveQuery(() => db.collections.get(id || ''));
  const rawItems = useLiveQuery(() => db.items.where('collectionId').equals(id || '').toArray(), [id]);

  const filteredItems = useMemo(() => {
    return rawItems ? filterItems(rawItems, filters) : [];
  }, [rawItems, filters]);

  const locations = useMemo(() => {
    if (!rawItems) return [];
    const locs = new Set(rawItems.map(i => i.storageLocation).filter(Boolean));
    return Array.from(locs) as string[];
  }, [rawItems]);

  const mediaTypes = useMemo(() => {
    if (!rawItems) return [];
    const types = new Set(rawItems.map(i => i.mediaType).filter(Boolean));
    return Array.from(types) as string[];
  }, [rawItems]);

  if (!collection) return <div>Loading...</div>;

  return (
    <div className="collection-view">
      <header className="view-header">
        <Link to="/" className="icon-button">
          <ArrowLeft size={24} />
        </Link>
        <h1>{collection.name}</h1>
        <div className="header-actions">
          <button 
            className={`icon-button ${showFilters ? 'accent' : ''}`} 
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={24} />
          </button>
          <button 
            className="icon-button accent"
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={24} />
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
              value={filters.location}
              onChange={e => setFilters({ ...filters, location: e.target.value })}
            >
              <option value="all">All Locations</option>
              {locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
            </select>

            <select 
              className="p-2 bg-bg border border-border rounded-lg"
              value={filters.mediaType}
              onChange={e => setFilters({ ...filters, mediaType: e.target.value })}
            >
              <option value="all">All Media Types</option>
              {mediaTypes.map(type => <option key={type} value={type}>{type}</option>)}
            </select>

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

          <div className="flex gap-4 mt-4">
            <label className="flex items-center gap-2">
              <input 
                type="checkbox" 
                checked={filters.loanedOnly}
                onChange={e => setFilters({ ...filters, loanedOnly: e.target.checked })}
              />
              <span>Loaned Only</span>
            </label>
          </div>
        </div>
      )}

      <div className="item-list">
        {filteredItems.map(item => (
          <Link key={item.id} to={`/item/${item.id}`} className="item-row">
            <div className="item-thumbnail">
              {item.images[0] ? <img src={item.images[0]} alt="" /> : <div className="placeholder" />}
            </div>
            <div className="item-info">
              <h3>{item.title}</h3>
              <p>{item.storageLocation || 'No location'} • ⭐ {item.personalRating}</p>
              {item.mediaType && <p className="text-sm opacity-70">{item.mediaType}</p>}
            </div>
            {item.loanedStatus && <span className="loaned-badge">Loaned</span>}
          </Link>
        ))}
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
    </div>
  );
};

export default CollectionView;
