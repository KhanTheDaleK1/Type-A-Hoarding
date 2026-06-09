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
    await db.collections.bulkAdd([
      {
        id: movieCollId,
        name: 'Favorite Movies',
        type: 'Movies',
        createdAt: Date.now(),
        customFields: [
          { id: 'year', name: 'Year Made', type: 'number' },
          { id: 'contentRating', name: 'Content Rating (G/PG/R)', type: 'select', options: ['G', 'PG', 'PG-13', 'R', 'NC-17', 'Unrated'] },
          { id: 'dateWatched', name: 'Date Watched', type: 'date' }
        ]
      },
      {
        id: bookCollId,
        name: 'To Read List',
        type: 'Books',
        createdAt: Date.now(),
        customFields: [
          { id: 'author', name: 'Author', type: 'text' },
          { id: 'isbn', name: 'ISBN', type: 'text' },
          { id: 'dateRead', name: 'Date Read', type: 'date' }
        ]
      }
    ]);

    await db.items.bulkAdd([
      {
        id: 'item-1',
        collectionId: movieCollId,
        title: 'The Matrix',
        sortTitle: 'Matrix, The',
        mediaType: '4K Blu-ray',
        images: ['https://m.media-amazon.com/images/M/MV5BNzQzOTk3OTAtNDQ0Zi00ZTVkLWI0MTEtMDllZjNkYzNjNTc4L2ltYWdlXkEyXkFqcGdeQXVyNjU0OTQ0OTY@._V1_.jpg'],
        loanedStatus: false,
        dateAdded: Date.now(),
        personalRating: 5,
        customData: { year: 1999, contentRating: 'R', dateWatched: '2024-01-01' }
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
