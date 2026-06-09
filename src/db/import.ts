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
          const items: Item[] = [];

          for (const book of books) {
            const title = book['Title'] || 'Unknown Title';
            const author = book['Author'] || 'Unknown Author';
            const isbn = (book['ISBN13'] || book['ISBN'] || '').replace(/[^0-9]/g, '');
            const rating = parseInt(book['My Rating']) || 0;
            const dateRead = book['Date Read'];
            
            const newItem: Item = {
              id: crypto.randomUUID(),
              collectionId: collectionId,
              title: title,
              sortTitle: title.replace(/^(The|A|An)\s+/i, '') + ', ' + (title.match(/^(The|A|An)\s+/i)?.[0].trim() || ''),
              mediaType: 'Book',
              images: [], // Will attempt to fetch below
              watched: !!dateRead,
              loanedStatus: false,
              dateAdded: Date.now(),
              personalRating: rating,
              customData: {
                author: author,
                isbn: isbn,
                dateRead: dateRead,
                year: book['Year Published'] || book['Original Publication Year']
              }
            };
            items.push(newItem);
          }

          // Add to DB
          await db.items.bulkAdd(items);

          // Background task: Try to fetch images for books with ISBNs
          // We do this after resolving so the user isn't waiting for 100+ API calls
          fetchImagesInBackground(items.filter(i => i.customData.isbn));

          resolve(items.length);
        } catch (err) {
          reject(err);
        }
      },
      error: (err) => reject(err)
    });
  });
};

const fetchImagesInBackground = async (items: Item[]) => {
  // Simple throttled fetcher
  for (const item of items) {
    try {
      const metadata = await fetchMetadataByBarcode(item.customData.isbn);
      if (metadata && metadata.thumbnail) {
        await db.items.update(item.id, { 
          images: [metadata.thumbnail],
          notes: metadata.description || item.notes 
        });
      }
      // Wait 1s between calls to respect API limits
      await new Promise(r => setTimeout(r, 1000));
    } catch (e) {
      console.warn(`Failed background fetch for ${item.title}`);
    }
  }
};
