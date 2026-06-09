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
            const title = book['Title'] || 'Unknown Title';
            const author = book['Author'] || 'Unknown Author';
            const isbn = (book['ISBN13'] || book['ISBN'] || '').replace(/[^0-9]/g, '');
            const rating = parseInt(book['My Rating']) || 0;
            const dateRead = book['Date Read'];
            
            // Look for existing item by ISBN or Title+Author
            const existing = existingItems.find(i => 
              (isbn && i.customData.isbn === isbn) || 
              (i.title.toLowerCase() === title.toLowerCase() && i.customData.author?.toLowerCase() === author.toLowerCase())
            );

            const itemData: Item = {
              id: existing?.id || crypto.randomUUID(),
              collectionId: collectionId,
              title: title,
              sortTitle: title.replace(/^(The|A|An)\s+/i, '') + ', ' + (title.match(/^(The|A|An)\s+/i)?.[0].trim() || ''),
              mediaType: 'Book',
              images: existing?.images || [], // Preserve existing images if we have them
              watched: !!dateRead,
              loanedStatus: existing?.loanedStatus || false,
              dateAdded: existing?.dateAdded || Date.now(),
              personalRating: rating,
              customData: {
                author: author,
                isbn: isbn,
                dateRead: dateRead,
                year: book['Year Published'] || book['Original Publication Year']
              }
            };
            itemsToSave.push(itemData);
          }

          // bulkPut handles both inserting new items and updating existing ones by ID
          await db.items.bulkPut(itemsToSave);

          // Background task: Try to fetch images for books with ISBNs that don't have images yet
          fetchImagesInBackground(itemsToSave.filter(i => i.customData.isbn && i.images.length === 0));

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
