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
  // Database is initialized empty for a clean slate.
};
