import Dexie, { type Table } from 'dexie';
import type { Collection, Item, StorageLocation } from '../types';

export class MyDatabase extends Dexie {
  collections!: Table<Collection>;
  items!: Table<Item>;
  locations!: Table<StorageLocation>;

  constructor() {
    super('TypeAHoardingDB');
    this.version(3).stores({
      collections: 'id, name, type',
      items: 'id, collectionId, title, sortTitle, dateAdded, personalRating, storageLocation, mediaType',
      locations: 'id, name, dateAdded'
    });
  }
}

export const db = new MyDatabase();

export const seedDatabase = async () => {
  const locCount = await db.locations.count();
  if (locCount === 0) {
    await db.locations.bulkPut([
      { id: 'LOC-1001', name: 'Master Bedroom', description: 'Master Bedroom Storage', dateAdded: Date.now() },
      { id: 'LOC-1002', name: 'Master Closet', description: 'Master Closet Storage', dateAdded: Date.now() },
      { id: 'LOC-1003', name: 'Office', description: 'Office Storage', dateAdded: Date.now() },
      { id: 'LOC-1004', name: 'Hannah Room / School Room', description: 'Hannah Room and School Room', dateAdded: Date.now() },
      { id: 'LOC-1005', name: 'Garage', description: 'Garage Storage', dateAdded: Date.now() },
      { id: 'LOC-1006', name: 'Kitchen', description: 'Kitchen Storage', dateAdded: Date.now() },
      { id: 'LOC-1007', name: 'Apollo\'s Room', description: 'Apollo\'s Room Storage', dateAdded: Date.now() },
      { id: 'LOC-1008', name: 'Apollo\'s Bathroom', description: 'Apollo\'s Bathroom Storage', dateAdded: Date.now() },
      { id: 'LOC-1009', name: 'Living Room', description: 'Living Room Storage', dateAdded: Date.now() }
    ]);
  }
};
