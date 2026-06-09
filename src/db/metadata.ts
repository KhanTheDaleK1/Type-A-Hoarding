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
  
  // Use provided keys as defaults, but allow override via local storage
  const savedKeys = JSON.parse(localStorage.getItem('hoarding_api_keys') || '{}');
  const keys = {
    tmdb: savedKeys.tmdb || 'd08472ce6060f87031d77b5f6fc08c9e',
    omdb: savedKeys.omdb || '8657ba09'
  };

  const tryLookup = async (code: string): Promise<BarcodeResult | null> => {
    try {
      // Priority 1: TMDb (High Quality Movie/TV Data)
      if (keys.tmdb) {
        // First try searching for movie by query if it looks like a barcode
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

      // Priority 2: OMDb (Excellent legacy support for VHS/DVD)
      if (keys.omdb) {
        const omdb = await fetch(`https://www.omdbapi.com/?apikey=${keys.omdb}&s=${code}`).then(r => r.json());
        if (omdb.Search?.[0]) {
          const m = omdb.Search[0];
          // Get full details for the first match
          const details = await fetch(`https://www.omdbapi.com/?apikey=${keys.omdb}&i=${m.imdbID}`).then(r => r.json());
          return {
            title: details.Title,
            year: details.Year,
            thumbnail: details.Poster !== 'N/A' ? details.Poster : undefined,
            description: details.Plot,
            genre: details.Genre,
            mediaType: details.Type === 'series' ? 'TV Show' : 'Movie',
            source: 'OMDb'
          };
        }
      }

      // Priority 3: MusicBrainz + Cover Art Archive
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

export const fetchMetadataByTitle = async (title: string, type: string): Promise<BarcodeResult | null> => {
  const savedKeys = JSON.parse(localStorage.getItem('hoarding_api_keys') || '{}');
  const keys = {
    tmdb: savedKeys.tmdb || 'd08472ce6060f87031d77b5f6fc08c9e',
    omdb: savedKeys.omdb || '8657ba09'
  };

  try {
    if (type === 'Movies' || type === 'TV Shows') {
      // 1. Try TMDb
      const tmdb = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${keys.tmdb}&query=${encodeURIComponent(title)}`).then(r => r.json());
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

      // 2. Try OMDb
      const omdb = await fetch(`https://www.omdbapi.com/?apikey=${keys.omdb}&t=${encodeURIComponent(title)}`).then(r => r.json());
      if (omdb && omdb.Response !== 'False') {
        return {
          title: omdb.Title,
          year: omdb.Year,
          thumbnail: omdb.Poster !== 'N/A' ? omdb.Poster : undefined,
          description: omdb.Plot,
          genre: omdb.Genre,
          mediaType: omdb.Type === 'series' ? 'TV Show' : 'Movie',
          source: 'OMDb'
        };
      }
    }

    if (type === 'Books') {
      const gBooks = await fetch(`https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(title)}`).then(r => r.json());
      if (gBooks.items?.[0]) {
        const b = gBooks.items[0].volumeInfo;
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
  } catch (e) {
    console.error('Metadata search by title failed:', e);
  }

  return null;
};
