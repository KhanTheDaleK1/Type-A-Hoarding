import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { ArrowLeft, Edit2, Trash2, Calendar, Tag, ShieldCheck, PlayCircle, Star } from 'lucide-react';
import ItemEditor from '../components/ItemEditor';

const ItemDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showEditModal, setShowEditModal] = useState(false);
  
  const item = useLiveQuery(() => db.items.get(id || ''));
  const collection = useLiveQuery(() => item ? db.collections.get(item.collectionId) : undefined, [item]);

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      await db.items.delete(id!);
      navigate(`/collection/${item?.collectionId}`);
    }
  };

  const [isLoaded, setIsLoaded] = useState(false);
  
  React.useEffect(() => {
    // If Dexie returns undefined, give it 500ms to load. If still undefined, it's not found.
    const timer = setTimeout(() => setIsLoaded(true), 500);
    return () => clearTimeout(timer);
  }, []);

  if (!item) {
    if (!isLoaded) return <div className="p-8 text-center animate-pulse mt-20">Loading item...</div>;
    return (
      <div className="p-8 text-center mt-20">
        <h2 className="text-2xl font-black mb-4">Item Not Found</h2>
        <p className="opacity-50 mb-8">This item does not exist in your local database. If you just scanned this from your native camera, you are likely in a Safari browser window that hasn't synced with your main app yet!</p>
        <button onClick={() => navigate('/')} className="px-6 py-3 bg-accent text-white font-bold rounded-xl">Go to Dashboard</button>
      </div>
    );
  }

  return (
    <div className="item-detail max-w-4xl mx-auto">
      <header className="view-header sticky top-0 bg-bg/80 backdrop-blur-md z-10 py-4 mb-8 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to={`/collection/${item.collectionId}`} className="icon-button">
            <ArrowLeft size={24} />
          </Link>
          <h1 className="text-xl font-black tracking-tight">{item.title}</h1>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowEditModal(true)}
            className="flex items-center gap-2 px-5 py-3 bg-bg-secondary hover:bg-border rounded-2xl font-bold text-sm transition-all shadow-sm"
          >
            <Edit2 size={16} /> Edit
          </button>
          <button 
            onClick={handleDelete}
            className="flex items-center gap-2 px-5 py-3 bg-danger/10 hover:bg-danger text-danger hover:text-white rounded-2xl font-bold text-sm transition-all shadow-sm"
          >
            <Trash2 size={16} /> Delete
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-4">
        <div className="space-y-4">
          <div className="aspect-[2/3] w-full rounded-2xl overflow-hidden bg-bg-secondary border border-border shadow-xl group relative">
            {item.images[0] ? (
              <img src={item.images[0]} className="w-full h-full object-cover" alt={item.title} />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 gap-4">
                <PlayCircle size={64} className="opacity-20" />
                <span className="text-xs font-bold uppercase tracking-widest opacity-40">No Cover Art</span>
              </div>
            )}
            {item.mediaType && (
              <div className="absolute bottom-4 left-4 px-3 py-1 bg-accent text-white rounded-lg font-black text-xs uppercase shadow-lg">
                {item.mediaType}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-8">
          <section className="space-y-4">
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-accent opacity-80 border-b border-border pb-2">
              {collection?.type === 'Books' ? 'Book' : collection?.type === 'Music' ? 'Album' : 'Movie'} Details
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-bg-secondary p-4 rounded-2xl border border-border">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <Calendar size={14} />
                  <span className="text-[10px] font-black uppercase tracking-wider">Year</span>
                </div>
                <div className="text-lg font-black">{item.customData.year || 'Unknown'}</div>
              </div>
              
              {collection?.type === 'Books' ? (
                <>
                  <div className="bg-bg-secondary p-4 rounded-2xl border border-border">
                    <div className="flex items-center gap-2 text-gray-500 mb-1">
                      <ShieldCheck size={14} />
                      <span className="text-[10px] font-black uppercase tracking-wider">Genre</span>
                    </div>
                    <div className="text-sm font-black truncate">{item.customData.genre || 'Unknown'}</div>
                  </div>
                  <div className="bg-bg-secondary p-4 rounded-2xl border border-border">
                    <div className="flex items-center gap-2 text-gray-500 mb-1">
                      <Tag size={14} />
                      <span className="text-[10px] font-black uppercase tracking-wider">Author</span>
                    </div>
                    <div className="text-sm font-black truncate">{item.customData.author || 'N/A'}</div>
                  </div>
                  <div className="bg-bg-secondary p-4 rounded-2xl border border-border">
                    <div className="flex items-center gap-2 text-gray-500 mb-1">
                      <Calendar size={14} />
                      <span className="text-[10px] font-black uppercase tracking-wider">Date Finished</span>
                    </div>
                    <div className="text-sm font-bold">{item.customData.dateRead || 'Not Read'}</div>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-bg-secondary p-4 rounded-2xl border border-border">
                    <div className="flex items-center gap-2 text-gray-500 mb-1">
                      <ShieldCheck size={14} />
                      <span className="text-[10px] font-black uppercase tracking-wider">Rating</span>
                    </div>
                    <div className="text-lg font-black">{item.customData.contentRating || 'Unknown'}</div>
                  </div>
                  <div className="bg-bg-secondary p-4 rounded-2xl border border-border">
                    <div className="flex items-center gap-2 text-gray-500 mb-1">
                      <Tag size={14} />
                      <span className="text-[10px] font-black uppercase tracking-wider">Format</span>
                    </div>
                    <div className="text-lg font-black">{item.mediaType || 'N/A'}</div>
                  </div>
                  <div className="bg-bg-secondary p-4 rounded-2xl border border-border">
                    <div className="flex items-center gap-2 text-gray-500 mb-1">
                      <Calendar size={14} />
                      <span className="text-[10px] font-black uppercase tracking-wider">Watched</span>
                    </div>
                    <div className="text-sm font-bold">{item.customData.dateWatched || 'Never'}</div>
                  </div>
                </>
              )}
            </div>
          </section>

          {item.notes && (
            <section className="space-y-4">
              <h2 className="text-sm font-black uppercase tracking-[0.2em] text-accent opacity-80 border-b border-border pb-2">Synopsis</h2>
              <p className="text-sm leading-relaxed opacity-80 bg-bg-secondary p-4 rounded-2xl border border-border whitespace-pre-wrap">
                {item.notes}
              </p>
            </section>
          )}

          {item.customData.reviewText && (
            <section className="space-y-4">
              <h2 className="text-sm font-black uppercase tracking-[0.2em] text-accent opacity-80 border-b border-border pb-2 flex items-center justify-between">
                <span>Review</span>
                <span className="flex items-center gap-1 text-accent">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={16} className={i < (item.personalRating || 5) ? 'fill-current' : 'opacity-20'} />
                  ))}
                </span>
              </h2>
              <p className="text-sm leading-relaxed opacity-80 bg-bg-secondary p-4 rounded-2xl border border-border whitespace-pre-wrap">
                {item.customData.reviewText}
              </p>
            </section>
          )}

          <div className="pt-8 border-t border-border flex justify-between items-center text-[10px] font-black uppercase tracking-widest opacity-30">
            <span>Added {new Date(item.dateAdded).toLocaleDateString()}</span>
            <span>ID: {item.id.slice(0, 8)}</span>
          </div>
        </div>
      </div>

      {showEditModal && collection && (
        <ItemEditor 
          collection={collection}
          item={item}
          onClose={() => setShowEditModal(false)}
        />
      )}
    </div>
  );
};

export default ItemDetail;
