export interface BarcodeResult {
  title: string;
  author?: string;
  publisher?: string;
  year?: string;
  thumbnail?: string;
  description?: string;
  source: string;
}

export const fetchMetadataByBarcode = async (barcode: string): Promise<BarcodeResult | null> => {
  try {
    // 1. Try Open Library (Books)
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
        source: 'Open Library'
      };
    }

    // 2. Try OMDb (Movies - requires API key, but we can structure it)
    // For now, we'll stick to free open ones or placeholders for others
    
    return null;
  } catch (error) {
    console.error('Error fetching metadata:', error);
    return null;
  }
};
