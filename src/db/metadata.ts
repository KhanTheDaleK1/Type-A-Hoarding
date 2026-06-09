export interface BarcodeResult {
  title: string;
  author?: string;
  publisher?: string;
  year?: string;
  thumbnail?: string;
  description?: string;
  mediaType?: string;
  genre?: string;
  source: string;
}

export const fetchMetadataByBarcode = async (barcode: string): Promise<BarcodeResult | null> => {
  // 1. Clean and Normalize
  let cleanBarcode = barcode.replace(/[-\s]/g, '');
  const keys = JSON.parse(localStorage.getItem('hoarding_api_keys') || '{"tmdb":"","omdb":""}');

  const tryLookup = async (code: string): Promise<BarcodeResult | null> => {
    try {
      // Priority 1: High-Quality Movie APIs (User provided keys)
      if (keys.tmdb) {
        // TMDb usually uses barcodes as 'external_ids' but searching by query is more reliable for PWAs
        const tmdb = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${keys.tmdb}&query=${code}`).then(r => r.json());
        if (tmdb.results?.[0]) {
          const m = tmdb.results[0];
          return {
            title: m.title,
            year: m.release_date?.split('-')[0],
            thumbnail: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : undefined,
            description: m.overview,
            mediaType: 'Movie',
            source: 'TMDb'
          };
        }
      }

      // Priority 2: MusicBrainz + Cover Art Archive
      const mbRes = await fetch(`https://musicbrainz.org/ws/2/release/?query=barcode:${code}&fmt=json`).then(r => r.json());
      if (mbRes.releases?.[0]) {
        const rel = mbRes.releases[0];
        let thumbnail = undefined;
        
        // Fetch Art from Cover Art Archive
        try {
          const artRes = await fetch(`https://coverartarchive.org/release/${rel.id}`).then(r => r.json());
          thumbnail = artRes.images?.[0]?.thumbnails?.['500'] || artRes.images?.[0]?.image;
        } catch (e) {
          // No art found, continue with metadata only
        }

        return {
          title: rel.title,
          author: rel['artist-credit']?.[0]?.name,
          year: rel.date?.split('-')[0],
          thumbnail: thumbnail,
          mediaType: 'Music',
          source: 'MusicBrainz'
        };
      }

      // Priority 3: Google Books (Master fallback for almost everything with a number)
      const gBooks = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${code}`).then(r => r.json());
      if (gBooks.items?.[0]) {
        const b = gBooks.items[0].volumeInfo;
        // Verify it's a good match
        if (b.title) {
          return {
            title: b.title,
            author: b.authors?.join(', '),
            year: b.publishedDate?.split('-')[0],
            thumbnail: b.imageLinks?.thumbnail || b.imageLinks?.smallThumbnail,
            description: b.description,
            genre: b.categories?.join(', '),
            mediaType: 'Book',
            source: 'Google'
          };
        }
      }

      // Priority 4: UPCItemDB (Specific retail products)
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

  // Execution Pipeline: Try Original, then Padded, then Truncated
  let result = await tryLookup(cleanBarcode);
  
  if (!result && cleanBarcode.length === 12) {
    result = await tryLookup('0' + cleanBarcode); // Try EAN conversion
  }
  
  if (!result && cleanBarcode.length === 10) {
    result = await tryLookup('07869' + cleanBarcode.substring(5)); // Specialized Disney logic if we have partials
    if (!result) result = await tryLookup('0' + cleanBarcode);
  }

  return result;
};
