import Dexie, { type Table } from 'dexie';
import type { Collection, Item } from '../types';

export class MyDatabase extends Dexie {
  collections!: Table<Collection>;
  items!: Table<Item>;

  constructor() {
    super('TypeAHoardingDB');
    this.version(2).stores({
      collections: 'id, name, type',
      items: 'id, collectionId, title, sortTitle, dateAdded, personalRating, storageLocation, mediaType'
    });
  }
}

export const db = new MyDatabase();

export const seedDatabase = async () => {
  const collectionCount = await db.collections.count();
  if (collectionCount > 0) return;

  const movieCollId = 'sample-movies';
  const bookCollId = 'sample-books';

  try {
    await db.collections.bulkPut([
      {
        id: movieCollId,
        name: 'Favorite Movies',
        type: 'Movies',
        createdAt: Date.now(),
        customFields: [
          { id: 'director', name: 'Director', type: 'text' },
          { id: 'runtime', name: 'Runtime (min)', type: 'number' }
        ]
      },
      {
        id: bookCollId,
        name: 'To Read List',
        type: 'Books',
        createdAt: Date.now(),
        customFields: [
          { id: 'author', name: 'Author', type: 'text' },
          { id: 'isbn', name: 'ISBN', type: 'text' }
        ]
      }
    ]);

    await db.items.bulkPut([
      {
        id: 'item-1',
        collectionId: movieCollId,
        title: 'The Matrix',
        sortTitle: 'Matrix, The',
        mediaType: '4K Blu-ray',
        images: [],
        loanedStatus: false,
        dateAdded: Date.now(),
        personalRating: 5,
        storageLocation: 'Living Room Shelf',
        customData: { director: 'Wachowskis', runtime: 136 }
      },
      {
        id: 'item-2',
        collectionId: bookCollId,
        title: 'Neuromancer',
        sortTitle: 'Neuromancer',
        mediaType: 'Paperback',
        images: [],
        loanedStatus: true,
        loanedTo: 'Alice',
        dateAdded: Date.now(),
        personalRating: 4,
        storageLocation: 'Office',
        customData: { author: 'William Gibson', isbn: '978-0441569595' }
      }
    ]);
  } catch (error) {
    console.warn('Seed data already exists or failed to insert:', error);
  }
};
