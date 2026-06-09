export interface BarcodeResult {
  title: string;
  author?: string;
  publisher?: string;
  year?: string;
  thumbnail?: string;
  description?: string;
  mediaType?: string;
  source: string;
}

export const fetchMetadataByBarcode = async (barcode: string): Promise<BarcodeResult | null> => {
  // Clean and normalize barcode
  let cleanBarcode = barcode.replace(/[-\s]/g, '');
  
  // Normalize UPC-A (12 digits) to EAN-13 by padding with a leading zero
  if (cleanBarcode.length === 12) {
    cleanBarcode = '0' + cleanBarcode;
  }
  
  console.log(`Searching for barcode: ${cleanBarcode}`);

  const tryLookup = async (code: string): Promise<BarcodeResult | null> => {
    try {
      // 1. Google Books (Good for ISBNs)
      const gBooks = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${code}`).then(r => r.json());
      if (gBooks.items?.[0]) {
        const b = gBooks.items[0].volumeInfo;
        return {
          title: b.title,
          author: b.authors?.join(', '),
          publisher: b.publisher,
          year: b.publishedDate?.split('-')[0],
          thumbnail: b.imageLinks?.thumbnail || b.imageLinks?.smallThumbnail,
          mediaType: 'Book',
          source: 'Google Books'
        };
      }

      // 2. Open Library
      const ol = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${code}&format=json&jscmd=data`).then(r => r.json());
      if (ol[`ISBN:${code}`]) {
        const b = ol[`ISBN:${code}`];
        return {
          title: b.title,
          author: b.authors?.[0]?.name,
          year: b.publish_date?.toString().split(' ').pop(),
          thumbnail: b.cover?.large || b.cover?.medium,
          mediaType: 'Book',
          source: 'Open Library'
        };
      }

      // 3. UPCItemDB (Movies/Media)
      const upc = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`).then(r => r.json());
      if (upc.items?.[0]) {
        const i = upc.items[0];
        return {
          title: i.title,
          description: i.description,
          thumbnail: i.images?.[0],
          mediaType: i.category?.split(' > ').pop() || 'Item',
          year: i.specs?.year,
          source: 'UPCItemDB'
        };
      }

      // 4. Fallback Keyword Search (If barcode search fails, try searching the number as a generic term)
      const searchFallback = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${code}`).then(r => r.json());
      if (searchFallback.items?.[0]) {
        const b = searchFallback.items[0].volumeInfo;
        return {
          title: b.title,
          author: b.authors?.join(', '),
          year: b.publishedDate?.split('-')[0],
          thumbnail: b.imageLinks?.thumbnail,
          mediaType: 'Item',
          source: 'Search Fallback'
        };
      }

      return null;
    } catch (e) {
      return null;
    }
  };

  // Try normalized code
  let result = await tryLookup(cleanBarcode);
  
  // If failed and we added a zero, try without the zero
  if (!result && cleanBarcode.startsWith('0')) {
    result = await tryLookup(cleanBarcode.substring(1));
  }

  return result;
};
