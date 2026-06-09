import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { ArrowLeft, Edit2, Trash2 } from 'lucide-react';

const ItemDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const item = useLiveQuery(() => db.items.get(id || ''));

  if (!item) return <div>Loading...</div>;

  return (
    <div className="item-detail">
      <header className="view-header">
        <Link to={`/collection/${item.collectionId}`} className="icon-button">
          <ArrowLeft size={24} />
        </Link>
        <h1>{item.title}</h1>
        <div className="header-actions">
          <button className="icon-button"><Edit2 size={24} /></button>
          <button className="icon-button danger"><Trash2 size={24} /></button>
        </div>
      </header>

      <div className="detail-content">
        <div className="image-gallery">
          {item.images.map((img, i) => (
            <img key={i} src={img} alt={`View ${i + 1}`} />
          ))}
          {item.images.length === 0 && <div className="placeholder-large" />}
        </div>

        <div className="metadata-section">
          <div className="meta-row">
            <span className="label">Location</span>
            <span className="value">{item.storageLocation || 'Not set'}</span>
          </div>
          <div className="meta-row">
            <span className="label">Rating</span>
            <span className="value">{item.personalRating}/5</span>
          </div>
          <div className="meta-row">
            <span className="label">Status</span>
            <span className="value">{item.loanedStatus ? `Loaned to ${item.loanedTo}` : 'In Stock'}</span>
          </div>
          {item.notes && (
            <div className="notes-section">
              <h3>Notes</h3>
              <p>{item.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ItemDetail;
