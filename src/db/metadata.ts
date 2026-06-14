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

const getApiUrl = (path: string) => {
  const base = localStorage.getItem('hoarding_api_url') || 'https://hoardbackend.beechem.site';
  return `${base}${path}`;
};

const getHeaders = () => {
  const headers: Record<string, string> = {
    'Accept': 'application/json'
  };
  const savedKeys = localStorage.getItem('hoarding_api_keys');
  if (savedKeys) {
    try {
      const keys = JSON.parse(savedKeys);
      if (keys.tmdb) headers['X-TMDB-API-KEY'] = keys.tmdb;
      if (keys.omdb) headers['X-OMDB-API-KEY'] = keys.omdb;
    } catch (e) {
      console.error('Failed to parse hoarding_api_keys', e);
    }
  }
  return headers;
};

export const fetchMetadataByBarcode = async (barcode: string): Promise<BarcodeResult | null> => {
  // 1. Clean and Normalize
  let cleanBarcode = barcode.replace(/[-\s]/g, '');

  const tryLookup = async (code: string): Promise<BarcodeResult | null> => {
    try {
      const response = await fetch(getApiUrl(`/api/lookup/${code}`), {
        headers: getHeaders()
      });
      if (!response.ok) return null;
      
      const data = await response.json();
      if (data && data.success) {
        // Map backend response to BarcodeResult structure
        return {
          title: data.title,
          author: data.creator !== 'N/A' && data.creator !== 'Unknown Artist' && data.creator !== 'Unknown Director' && data.creator !== 'Unknown Author' ? data.creator : undefined,
          publisher: data.publisher !== 'Unknown' && data.publisher !== 'Unknown Studio' && data.publisher !== 'Unknown Publisher' && data.publisher !== 'Unknown Label' ? data.publisher : undefined,
          year: data.publishedDate !== 'N/A' && data.publishedDate !== 'Unknown Date' ? data.publishedDate : undefined,
          thumbnail: data.thumbnail || undefined,
          description: data.description !== 'No description available.' ? data.description : undefined,
          mediaType: data.type ? (data.type.charAt(0).toUpperCase() + data.type.slice(1)) : undefined, // movie -> Movie, book -> Book, etc.
          genre: data.extra?.genres?.join(', ') || data.extra?.category || undefined,
          source: data.source
        };
      }
      return null;
    } catch (e) {
      console.error('Lookup failed for barcode', code, e);
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
  try {
    // Map collection type to backend API query type ('movie', 'book', 'music', or 'all')
    let backendType = 'all';
    if (type === 'Movies' || type === 'TV Shows') {
      backendType = 'movie';
    } else if (type === 'Books') {
      backendType = 'book';
    } else if (type === 'Music') {
      backendType = 'music';
    }

    const response = await fetch(getApiUrl(`/api/search?q=${encodeURIComponent(title)}&type=${backendType}`), {
      headers: getHeaders()
    });
    if (!response.ok) return null;

    const data = await response.json();
    if (data && data.success && data.results && data.results.length > 0) {
      const first = data.results[0];
      return {
        title: first.title,
        author: first.creator !== 'N/A' && first.creator !== 'Unknown Artist' && first.creator !== 'Unknown Director' && first.creator !== 'Unknown Author' ? first.creator : undefined,
        publisher: first.publisher !== 'Unknown' && first.publisher !== 'Unknown Studio' && first.publisher !== 'Unknown Publisher' && first.publisher !== 'Unknown Label' ? first.publisher : undefined,
        year: first.publishedDate !== 'N/A' && first.publishedDate !== 'Unknown Date' ? first.publishedDate : undefined,
        thumbnail: first.thumbnail || undefined,
        description: first.description || undefined,
        mediaType: first.type ? (first.type.charAt(0).toUpperCase() + first.type.slice(1)) : undefined,
        genre: first.extra?.genres?.join(', ') || first.extra?.category || undefined,
        source: first.source
      };
    }
  } catch (e) {
    console.error('Metadata search by title failed:', e);
  }

  return null;
};
