import Papa from 'papaparse';
import { db } from './db';
import type { Item } from '../types';
import { fetchMetadataByBarcode } from './metadata';

export const importGoodreadsCSV = async (file: File, collectionId: string) => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const books = results.data as any[];
          const itemsToSave: Item[] = [];
          
          // Get all existing books in this collection to check for duplicates
          const existingItems = await db.items.where('collectionId').equals(collectionId).toArray();

          for (const book of books) {
            const title = (book['Title'] || 'Unknown Title').trim();
            const author = (book['Author'] || 'Unknown Author').trim();
            const isbn = (book['ISBN13'] || book['ISBN'] || '').replace(/[^0-9]/g, '');
            const rating = parseInt(book['My Rating']) || 0;
            const dateRead = book['Date Read'];
            const bookshelves = book['Bookshelves'] || '';
            
            // Look for existing item by ISBN or Normalized Title+Author
            const existing = existingItems.find(i => 
              (isbn && i.customData.isbn === isbn) || 
              (i.title.trim().toLowerCase() === title.toLowerCase() && i.customData.author?.trim().toLowerCase() === author.toLowerCase())
            );

            const itemData: Item = {
              id: existing?.id || crypto.randomUUID(),
              collectionId: collectionId,
              title: title,
              sortTitle: title.replace(/^(The|A|An)\s+/i, '') + ', ' + (title.match(/^(The|A|An)\s+/i)?.[0].trim() || ''),
              mediaType: 'Book',
              images: existing?.images || [], 
              watched: !!dateRead,
              loanedStatus: existing?.loanedStatus || false,
              dateAdded: existing?.dateAdded || Date.now(),
              personalRating: rating,
              customData: {
                ...existing?.customData,
                author: author,
                isbn: isbn,
                dateRead: dateRead,
                genre: existing?.customData.genre || (bookshelves.split(',')[0].trim() || 'Unknown'),
                year: book['Year Published'] || book['Original Publication Year']
              }
            };
            itemsToSave.push(itemData);
          }

          // bulkPut handles both inserting new items and updating existing ones by ID
          await db.items.bulkPut(itemsToSave);

          // Background task: Try to fetch images & better genres for books
          fetchImagesInBackground(itemsToSave.filter(i => i.customData.isbn));

          resolve(itemsToSave.length);
        } catch (err) {
          reject(err);
        }
      },
      error: (err) => reject(err)
    });
  });
};

const fetchImagesInBackground = async (items: Item[]) => {
  for (const item of items) {
    try {
      const metadata = await fetchMetadataByBarcode(item.customData.isbn);
      if (metadata) {
        const updates: any = {};
        if (metadata.thumbnail && item.images.length === 0) updates.images = [metadata.thumbnail];
        if (metadata.description) updates.notes = metadata.description;
        
        // Update genre if it's currently generic or unknown
        if (metadata.genre && (!item.customData.genre || item.customData.genre === 'Unknown')) {
          updates.customData = { ...item.customData, genre: metadata.genre.split(',')[0].trim() };
        }

        if (Object.keys(updates).length > 0) {
          await db.items.update(item.id, updates);
        }
      }
      await new Promise(r => setTimeout(r, 1000));
    } catch (e) {
      console.warn(`Failed background fetch for ${item.title}`);
    }
  }
};
