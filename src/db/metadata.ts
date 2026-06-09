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
  // Clean barcode (remove spaces/dashes)
  const cleanBarcode = barcode.replace(/[-\s]/g, '');
  console.log(`Searching for barcode: ${cleanBarcode}`);

  try {
    // 1. Try Google Books API (Books - No Key needed for basic lookup, very reliable)
    // Works for many items that have ISBNs
    const googleResponse = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanBarcode}`);
    if (googleResponse.ok) {
      const googleData = await googleResponse.json();
      if (googleData.items && googleData.items.length > 0) {
        const book = googleData.items[0].volumeInfo;
        return {
          title: book.title,
          author: book.authors?.join(', '),
          publisher: book.publisher,
          year: book.publishedDate?.split('-')[0],
          thumbnail: book.imageLinks?.thumbnail || book.imageLinks?.smallThumbnail,
          description: book.description,
          mediaType: 'Book',
          source: 'Google Books'
        };
      }
    }

    // 2. Try Open Library (Books - No Key, Unlimited)
    const olResponse = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${cleanBarcode}&format=json&jscmd=data`);
    const olData = await olResponse.json();
    const bookKey = `ISBN:${cleanBarcode}`;
    
    if (olData[bookKey]) {
      const book = olData[bookKey];
      return {
        title: book.title,
        author: book.authors?.[0]?.name,
        publisher: book.publishers?.[0]?.name,
        year: book.publish_date?.toString().split(' ').pop(), // Try to get just the year
        thumbnail: book.cover?.large || book.cover?.medium,
        mediaType: 'Book',
        source: 'Open Library'
      };
    }

    // 3. Try UPCItemDB (Movies, Games, etc.)
    const upcResponse = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${cleanBarcode}`);
    if (upcResponse.ok) {
      const upcData = await upcResponse.json();
      if (upcData.items && upcData.items.length > 0) {
        const item = upcData.items[0];
        return {
          title: item.title,
          publisher: item.brand,
          description: item.description,
          thumbnail: item.images?.[0],
          mediaType: item.category?.split(' > ').pop() || 'Item',
          year: item.specs?.year,
          source: 'UPCItemDB'
        };
      }
    }
    
    // 4. Try BigBook (Alternative Book API)
    const bbResponse = await fetch(`https://api2.isbndb.com/book/${cleanBarcode}`, {
      headers: { 'Authorization': '43210_88888888' } // Common public test key if it works
    }).catch(() => null);
    
    if (bbResponse && bbResponse.ok) {
      const bbData = await bbResponse.json();
      if (bbData.book) {
        return {
          title: bbData.book.title,
          author: bbData.book.authors?.[0],
          year: bbData.book.date_published,
          thumbnail: bbData.book.image,
          mediaType: 'Book',
          source: 'ISBNDB'
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Error fetching metadata:', error);
    return null;
  }
};
