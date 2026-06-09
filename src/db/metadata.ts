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
  const cleanBarcode = barcode.replace(/[-\s]/g, '');
  const keys = JSON.parse(localStorage.getItem('hoarding_api_keys') || '{"tmdb":"","omdb":""}');

  const tryLookup = async (code: string): Promise<BarcodeResult | null> => {
    try {
      // 1. TMDb (If Key provided) - Best for Movies/TV
      if (keys.tmdb) {
        const tmdbSearch = await fetch(`https://api.themoviedb.org/3/find/${code}?api_key=${keys.tmdb}&external_source=imdb_id`).then(r => r.json());
        // Note: TMDb find works with IMDB IDs. For Barcodes, we often need a text search first
        const movie = tmdbSearch.movie_results?.[0];
        if (movie) {
          return {
            title: movie.title,
            year: movie.release_date?.split('-')[0],
            thumbnail: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : undefined,
            description: movie.overview,
            mediaType: 'Movie',
            source: 'TMDb'
          };
        }
      }

      // 2. OMDb (If Key provided)
      if (keys.omdb) {
        const omdb = await fetch(`https://www.omdbapi.com/?i=${code}&apikey=${keys.omdb}`).then(r => r.json());
        if (omdb.Title) {
          return {
            title: omdb.Title,
            author: omdb.Director,
            year: omdb.Year,
            thumbnail: omdb.Poster !== 'N/A' ? omdb.Poster : undefined,
            description: omdb.Plot,
            mediaType: omdb.Type === 'movie' ? 'Movie' : 'Item',
            source: 'OMDb'
          };
        }
      }

      // 3. MusicBrainz - Best for CDs/Vinyl/Music
      const mbRes = await fetch(`https://musicbrainz.org/ws/2/release/?query=barcode:${code}&fmt=json`).then(r => r.json());
      if (mbRes.releases?.[0]) {
        const rel = mbRes.releases[0];
        return {
          title: rel.title,
          author: rel['artist-credit']?.[0]?.name,
          year: rel.date?.split('-')[0],
          mediaType: 'Music',
          source: 'MusicBrainz'
        };
      }

      // 4. Google Books (Standard Fallback)
      const gBooks = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${code}`).then(r => r.json());
      if (gBooks.items?.[0]) {
        const b = gBooks.items[0].volumeInfo;
        return {
          title: b.title,
          author: b.authors?.join(', '),
          year: b.publishedDate?.split('-')[0],
          thumbnail: b.imageLinks?.thumbnail || b.imageLinks?.smallThumbnail,
          description: b.description,
          mediaType: 'Book',
          source: 'Google Books'
        };
      }

      // 5. Keyword search fallback for partial codes
      const fallback = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${code}`).then(r => r.json());
      if (fallback.items?.[0]) {
        const b = fallback.items[0].volumeInfo;
        return {
          title: b.title,
          author: b.authors?.join(', '),
          year: b.publishedDate?.split('-')[0],
          thumbnail: b.imageLinks?.thumbnail,
          mediaType: 'Item',
          source: 'Deep Search'
        };
      }

      // 6. Direct UPCItemDB
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

  // Run searches
  let result = await tryLookup(cleanBarcode);

  // Normalized fallback (Leading zero)
  if (!result && cleanBarcode.length === 12) {
    result = await tryLookup('0' + cleanBarcode);
  }
  // Truncated fallback (Common Disney/Disney style)
  if (!result && cleanBarcode.length === 10) {
    result = await tryLookup('0' + cleanBarcode);
  }

  return result;
};
