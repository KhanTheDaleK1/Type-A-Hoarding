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
  try {
    // 1. Try UPCItemDB (Trial - No Key, 100/day)
    // Good for general media (Movies, Games, Books)
    const upcResponse = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`);
    if (upcResponse.ok) {
      const upcData = await upcResponse.json();
      if (upcData.items && upcData.items.length > 0) {
        const item = upcData.items[0];
        return {
          title: item.title,
          publisher: item.brand,
          description: item.description,
          thumbnail: item.images?.[0],
          mediaType: item.category,
          source: 'UPCItemDB'
        };
      }
    }

    // 2. Try Open Library (Books - No Key, Unlimited)
    const olResponse = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${barcode}&format=json&jscmd=data`);
    const olData = await olResponse.json();
    const bookKey = `ISBN:${barcode}`;
    
    if (olData[bookKey]) {
      const book = olData[bookKey];
      return {
        title: book.title,
        author: book.authors?.[0]?.name,
        publisher: book.publishers?.[0]?.name,
        year: book.publish_date,
        thumbnail: book.cover?.large || book.cover?.medium,
        mediaType: 'Book',
        source: 'Open Library'
      };
    }

    // 3. Try ScanDex (Video Games - No Key)
    const sdResponse = await fetch(`https://gamery.app/api/v1/lookup?barcode=${barcode}`);
    if (sdResponse.ok) {
      const sdData = await sdResponse.json();
      if (sdData.title) {
        return {
          title: sdData.title,
          thumbnail: sdData.cover_url,
          mediaType: 'Video Game',
          source: 'ScanDex'
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching metadata:', error);
    return null;
  }
};
