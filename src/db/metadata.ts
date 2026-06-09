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
  
  // Normalize UPC-A (12 digits) to EAN-13
  if (cleanBarcode.length === 12) {
    cleanBarcode = '0' + cleanBarcode;
  }
  
  console.log(`Searching for barcode: ${cleanBarcode}`);

  const tryLookup = async (code: string): Promise<BarcodeResult | null> => {
    try {
      // 1. Google Books (Keyword fallback - very aggressive)
      // Searching by 'q=' instead of 'isbn:' helps find partial matches
      const gBooksSearch = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${code}`).then(r => r.json());
      if (gBooksSearch.items?.[0]) {
        const b = gBooksSearch.items[0].volumeInfo;
        // Verify it's not a completely random match
        if (b.title) {
          return {
            title: b.title,
            author: b.authors?.join(', '),
            publisher: b.publisher,
            year: b.publishedDate?.split('-')[0],
            thumbnail: b.imageLinks?.thumbnail || b.imageLinks?.smallThumbnail,
            mediaType: 'Item',
            source: 'Deep Search'
          };
        }
      }

      // 2. Direct UPCItemDB
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

      return null;
    } catch (e) {
      return null;
    }
  };

  // Try original code
  let result = await tryLookup(cleanBarcode);
  
  // Fuzzy Fallback: If 10 digits, try common Disney/Universal prefixes (like 07869...)
  if (!result && cleanBarcode.length === 10) {
    // Disney often starts with 07869... or similar
    // Try searching specifically for the number string anywhere in the metadata
    result = await tryLookup('0' + cleanBarcode);
  }

  return result;
};
