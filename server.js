process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import express from 'express';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const TMDB_API_KEY = 'd08472ce6060f87031d77b5f6fc08c9e';
const OMDB_API_KEY = '8657ba09';

// Setup cache directory and file
const CACHE_DIR = path.join(__dirname, 'data');
const CACHE_FILE = path.join(CACHE_DIR, 'cache.json');

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR);
}

let cache = {};
if (fs.existsSync(CACHE_FILE)) {
  try {
    cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  } catch (err) {
    console.error('Failed to parse cache file, starting fresh:', err);
    cache = {};
  }
}

// Helper to save cache to disk
function saveCache() {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save cache file:', err);
  }
}

// Helper to fetch an image URL and convert it to a Base64 data URL
async function fetchUrlAsBase64(url) {
  if (!url) return '';
  if (url.startsWith('data:')) return url; // Already Base64
  try {
    const res = await fetch(url);
    if (!res.ok) return url;
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch (err) {
    console.error(`[Base64 Convert Error] Failed for ${url}:`, err.message);
    return url; // Fallback to original URL
  }
}

// Helper to process, cache, and send the lookup result with a Base64 thumbnail
async function sendResult(res, barcode, result) {
  if (result.thumbnail) {
    result.thumbnail = await fetchUrlAsBase64(result.thumbnail);
  }
  cache[barcode] = result;
  saveCache();
  return res.json(result);
}


// Search engine scraping fallback to get product title from barcode
async function resolveTitleFromSearchEngine(barcode) {
  const url = `https://html.duckduckgo.com/html/?q=${barcode}`;
  try {
    console.log(`[Search Scraper] Fetching DuckDuckGo URL: ${url}`);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    });

    if (res.ok) {
      const html = await res.text();
      const linkRegex = /class="result__a"[^>]*>([\s\S]*?)<\/a>/g;
      const titles = [];
      let match;
      while ((match = linkRegex.exec(html)) !== null) {
        let title = match[1].trim()
          .replace(/<[^>]*>/g, '') // strip HTML tags
          .replace(/\s+/g, ' ');
        titles.push(title);
      }

      console.log(`[Search Scraper] Found ${titles.length} titles on DuckDuckGo.`);

      if (titles.length === 0) {
        console.warn(`[Search Scraper] No results found on DDG. HTML length: ${html.length}. Snippet: ${html.substring(0, 300).replace(/\s+/g, ' ')}`);
        return null;
      }
      
      const candidates = [];
      
      for (let rawTitle of titles) {
        const titleLower = rawTitle.toLowerCase();
        
        // Skip spam/reverse lookup/tracking sites entirely
        const isSpam = [
          'phone', 'number', 'caller', 'scam', 'reverse', 'spokeo', 'robokiller', 
          'whocalls', 'carrier', 'junkcall', 'tracking', 'package', '17track', 
          'parcel', 'ups', 'usps', 'fedex', 'dhl', 'whitepages', 'yellowpages',
          'check status', 'caller id', 'who calls', 'lookup tool', 'search by',
          'whocalled', 'callers', 'area code', 'spam call'
        ].some(keyword => titleLower.includes(keyword));
        
        if (isSpam) {
          continue;
        }

        // Clean the title
        let cleaned = rawTitle;
        
        // Remove barcode numbers if present
        cleaned = cleaned.replace(new RegExp(barcode, 'g'), '');
        
        // Remove common retailer suffixes and audio/video specs from candidate selection
        cleaned = cleaned
          .replace(/\b(at Target|eBay|Amazon|Walmart|Best Buy|Shop|Silver Platters|Alibris|Movies Unlimited|ccvideo|DeepDiscount|Waterloo Records|daddykool)\b/gi, '')
          .replace(/[-|:|—|\|]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        // Calculate score
        let score = 0;
        
        // Boost for containing media-related terms
        const mediaKeywords = [
          'dvd', 'blu-ray', 'bluray', 'cd', 'vinyl', 'book', 'laserdisc', 
          'vhs', 'album', 'soundtrack', 'edition', 'novel', 'hardcover', 
          'paperback', 'movie', 'film', 'audio'
        ];
        mediaKeywords.forEach(keyword => {
          if (titleLower.includes(keyword)) {
            score += 10;
          }
        });
        
        // Boost for containing the barcode in raw title (proves it's specifically about this product)
        if (titleLower.includes(barcode)) {
          score += 15;
        }
        
        // Length penalty/boost (ideal title length is between 15 and 65)
        if (cleaned.length >= 15 && cleaned.length <= 65) {
          score += 5;
        } else if (cleaned.length < 5) {
          score -= 20; // far too short
        }

        if (cleaned.length > 5) {
          candidates.push({ cleaned, score, original: rawTitle });
        }
      }

      if (candidates.length === 0) {
        console.warn('[Search Scraper] No candidate titles passed the non-spam filters.');
        if (titles.length > 0) {
          console.log(`[Search Scraper] Falling back to first scraped title: "${titles[0]}"`);
          return titles[0];
        }
        return null;
      }

      // Sort by score descending
      candidates.sort((a, b) => b.score - a.score);
      console.log('[Search Scraper] Top Candidates:', candidates.slice(0, 3).map(c => `[Score: ${c.score}] ${c.cleaned} (from: "${c.original}")`));
      
      return candidates[0].cleaned;
    } else {
      console.warn(`[Search Scraper] DuckDuckGo returned non-OK status: ${res.status}`);
    }
  } catch (err) {
    console.error('[resolveTitleFromSearchEngine Error]', err.message);
  }
  return null;
}

// Enable CORS for all requests (including preflight)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,Content-Type,X-TMDB-API-KEY,X-OMDB-API-KEY,X-GEMINI-API-KEY,X-GEMINI-MODEL,Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Serve static files from the 'dist' directory
app.use(express.static(path.join(__dirname, 'dist')));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

// GitHub OAuth configuration
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'ov23stjApt2Hcrq8hKsn'; // Default client ID
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';

// Endpoint to get GitHub Client ID
app.get('/api/github/config', (req, res) => {
  res.json({
    success: true,
    clientId: GITHUB_CLIENT_ID
  });
});

// Endpoint to exchange code for token
app.post('/api/github/callback', async (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ success: false, error: 'Code is required.' });
  }

  try {
    console.log(`[GitHub OAuth] Exchanging code for token...`);
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[GitHub OAuth] Exchange failed:`, errText);
      return res.status(500).json({ success: false, error: 'Failed to exchange code for token.' });
    }

    const data = await response.json();
    if (data.error) {
      console.error(`[GitHub OAuth] Error from GitHub:`, data.error_description || data.error);
      return res.status(400).json({ success: false, error: data.error_description || data.error });
    }

    console.log(`[GitHub OAuth] Token exchange successful.`);
    return res.json({
      success: true,
      token: data.access_token,
      scope: data.scope
    });

  } catch (err) {
    console.error('[GitHub OAuth Error]', err);
    return res.status(500).json({ success: false, error: 'Internal server error during token exchange.' });
  }
});

// API route for barcode lookup
app.get('/api/lookup/:barcode', async (req, res) => {
  const tmdbKey = req.headers['x-tmdb-api-key'] || req.query.tmdb_key || TMDB_API_KEY;
  const omdbKey = req.headers['x-omdb-api-key'] || req.query.omdb_key || OMDB_API_KEY;
  const isVhs = req.query.isVhs === 'true';

  let barcode = req.params.barcode.trim();
  const isCustomId = barcode.startsWith('tmdb_') || barcode.startsWith('mb_');
  if (!isCustomId) {
    barcode = barcode.replace(/[^0-9]/g, '');
  }

  if (!barcode) {
    return res.status(400).json({ success: false, error: 'Invalid identifier format.' });
  }

  // Check cache first
  if (cache[barcode]) {
    console.log(`[Cache Hit] Barcode ${barcode}`);
    return res.json(cache[barcode]);
  }

  console.log(`[Cache Miss] Querying APIs for barcode ${barcode}`);
  
  try {
    // A. Handle TMDb Direct lookup (Movie searched by title)
    if (barcode.startsWith('tmdb_')) {
      try {
        const movieId = barcode.replace('tmdb_', '');
        console.log(`[TMDb Direct] Querying Movie ID: ${movieId}`);
        const tmdbDetailRes = await fetch(`https://api.themoviedb.org/3/movie/${movieId}?api_key=${tmdbKey}&append_to_response=credits`);
        
        if (tmdbDetailRes.ok) {
          const tmdbDetails = await tmdbDetailRes.json();
          
          let result = {
            success: true,
            source: 'TMDb',
            barcode,
            title: tmdbDetails.title || 'Unknown Movie',
            subtitle: tmdbDetails.tagline || '',
            creator: tmdbDetails.credits?.crew?.find(c => c.job === 'Director')?.name || 'Unknown Director',
            type: 'movie',
            description: tmdbDetails.overview || 'No description available.',
            thumbnail: tmdbDetails.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbDetails.poster_path}` : '',
            publisher: tmdbDetails.production_companies?.[0]?.name || 'Unknown Studio',
            publishedDate: tmdbDetails.release_date ? tmdbDetails.release_date.substring(0, 4) : 'N/A',
            extra: {
              backdrop: tmdbDetails.backdrop_path ? `https://image.tmdb.org/t/p/w1280${tmdbDetails.backdrop_path}` : '',
              genres: tmdbDetails.genres?.map(g => g.name) || [],
              runtime: tmdbDetails.runtime ? `${tmdbDetails.runtime} min` : '',
              cast: tmdbDetails.credits?.cast?.slice(0, 5).map(c => c.name) || [],
              tmdbRating: tmdbDetails.vote_average || null
            }
          };

          try {
            const omdbRes = await fetch(`http://www.omdbapi.com/?t=${encodeURIComponent(result.title)}&apikey=${omdbKey}`);
            if (omdbRes.ok) {
              const omdbData = await omdbRes.json();
              if (omdbData.Response === 'True') {
                result.extra.rated = omdbData.Rated || 'N/A';
                result.extra.ratings = omdbData.Ratings || [];
                result.extra.boxOffice = omdbData.BoxOffice || 'N/A';
                result.extra.imdbRating = omdbData.imdbRating || null;
              }
            }
          } catch (e) {
            console.warn('OMDb lookup failed during TMDb direct lookup:', e.message);
          }

          return sendResult(res, barcode, result);
        }
      } catch (err) {
        console.error('[TMDb Direct Error]', err.message);
      }
    }

    // B. Handle MusicBrainz Direct lookup (Music searched by title)
    if (barcode.startsWith('mb_')) {
      try {
        const mbid = barcode.replace('mb_', '');
        console.log(`[MusicBrainz Direct] Querying Release ID: ${mbid}`);
        const mbRes = await fetch(`https://musicbrainz.org/ws/2/release/${mbid}?fmt=json&inc=artist-credits+labels`, {
          headers: { 'User-Agent': 'AuraScan/1.0.0 (contact@example.com)' }
        });
        
        if (mbRes.ok) {
          const rel = await mbRes.json();
          let thumbnail = '';
          
          try {
            const caRes = await fetch(`https://coverartarchive.org/release/${mbid}`);
            if (caRes.ok) {
              const caData = await caRes.json();
              thumbnail = caData.images?.[0]?.image || '';
            }
          } catch (e) {
            console.warn('Cover Art Archive lookup failed:', e.message);
          }

          const result = {
            success: true,
            source: 'MusicBrainz',
            barcode,
            title: rel.title || 'Unknown Album',
            subtitle: '',
            creator: rel['artist-credit']?.map(ac => ac.name).join(', ') || 'Unknown Artist',
            type: 'music',
            description: `Release Group: ${rel['release-group']?.title || 'N/A'}. Country: ${rel.country || 'N/A'}.`,
            thumbnail,
            publisher: rel['label-info']?.map(li => li.label?.name).filter(Boolean).join(', ') || 'Unknown Label',
            publishedDate: rel.date ? rel.date.substring(0, 4) : 'N/A',
            extra: {
              mbid,
              status: rel.status || 'Official',
              trackCount: rel.media?.[0]?.['track-count'] || null
            }
          };

          return sendResult(res, barcode, result);
        }
      } catch (err) {
        console.error('[MusicBrainz Direct Error]', err.message);
      }
    }

    // 1. Try Book Lookup (Google Books & Open Library) if it matches standard ISBN lengths (10 or 13)
    if (barcode.length === 10 || barcode.length === 13) {
      try {
        console.log(`[Google Books] Querying ISBN: ${barcode}`);
        const googleBooksRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${barcode}`);
        if (googleBooksRes.ok) {
          const gbData = await googleBooksRes.json();
          if (gbData.items && gbData.items.length > 0) {
            const bookInfo = gbData.items[0].volumeInfo;
            const thumbnail = bookInfo.imageLinks?.thumbnail || bookInfo.imageLinks?.smallThumbnail || '';
            const result = {
              success: true,
              source: 'Google Books',
              barcode,
              title: bookInfo.title || 'Unknown Title',
              subtitle: bookInfo.subtitle || '',
              creator: bookInfo.authors?.join(', ') || 'Unknown Author',
              type: 'book',
              description: bookInfo.description || 'No description available.',
              thumbnail: thumbnail,
              publisher: bookInfo.publisher || 'Unknown Publisher',
              publishedDate: bookInfo.publishedDate || 'Unknown Date',
              extra: {
                pages: bookInfo.pageCount || null,
                subjects: bookInfo.categories || [],
                googleBooksUrl: bookInfo.infoLink || ''
              }
            };
            return sendResult(res, barcode, result);
          }
        }
      } catch (gbErr) {
        console.error('[Google Books Lookup Error]', gbErr.message);
      }

      // Fallback to Open Library
      try {
        console.log(`[Open Library] Querying ISBN fallback: ${barcode}`);
        const openLibraryRes = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${barcode}&jscmd=data&format=json`);
        
        if (openLibraryRes.ok) {
          const data = await openLibraryRes.json();
          const key = `ISBN:${barcode}`;
          
          if (data[key]) {
            const bookData = data[key];
            const result = {
              success: true,
              source: 'Open Library',
              barcode,
              title: bookData.title || 'Unknown Title',
              subtitle: bookData.subtitle || '',
              creator: bookData.authors?.map(a => a.name).join(', ') || 'Unknown Author',
              type: 'book',
              description: bookData.notes || bookData.excerpts?.map(e => e.text).join(' ') || 'No description available.',
              thumbnail: bookData.cover?.medium || bookData.cover?.large || '',
              publisher: bookData.publishers?.map(p => p.name).join(', ') || 'Unknown Publisher',
              publishedDate: bookData.published_date || 'Unknown Date',
              extra: {
                pages: bookData.number_of_pages || null,
                subjects: bookData.subjects?.map(s => s.name).slice(0, 5) || [],
                openLibraryUrl: bookData.url || ''
              }
            };
            
            return sendResult(res, barcode, result);
          }
        }
      } catch (bookErr) {
        console.error('[Open Library Error]', bookErr.message);
      }
    }

    // 2. Try Music Lookup (MusicBrainz Cascade) for general UPC/EAN barcodes
    try {
      console.log(`[MusicBrainz Cascade] Querying barcode: ${barcode}`);
      const mbRes = await fetch(`https://musicbrainz.org/ws/2/release?query=barcode:${barcode}&fmt=json`, {
        headers: { 'User-Agent': 'AuraScan/1.0.0 (contact@example.com)' }
      });

      if (mbRes.ok) {
        const mbData = await mbRes.json();
        if (mbData.releases && mbData.releases.length > 0) {
          const rel = mbData.releases[0];
          const mbid = rel.id;
          let thumbnail = '';

          try {
            const caRes = await fetch(`https://coverartarchive.org/release/${mbid}`);
            if (caRes.ok) {
              const caData = await caRes.json();
              thumbnail = caData.images?.[0]?.image || '';
            }
          } catch (caErr) {
            console.warn('[Cover Art Cascade Error]', caErr.message);
          }

          const result = {
            success: true,
            source: 'MusicBrainz',
            barcode,
            title: rel.title || 'Unknown Title',
            subtitle: '',
            creator: rel['artist-credit']?.map(ac => ac.name).join(', ') || 'Unknown Artist',
            type: 'music',
            description: `A music release cataloged on MusicBrainz. Status: ${rel.status || 'Official'}.`,
            thumbnail,
            publisher: rel['label-info']?.map(li => li.label?.name).filter(Boolean).join(', ') || 'Unknown Label',
            publishedDate: rel.date ? rel.date.substring(0, 4) : 'N/A',
            extra: {
              mbid,
              category: 'Music',
              tracksCount: rel.media?.[0]?.['track-count'] || null
            }
          };

          return sendResult(res, barcode, result);
        }
      }
    } catch (mbErr) {
      console.warn('[MusicBrainz Cascade Error]', mbErr.message);
    }

    // 2. Try UpcItemDb for general lookup (movies, music, fallback for books)
    try {
      console.log(`[UpcItemDb] Querying UPC: ${barcode}`);
      const upcRes = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`, {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate'
        }
      });
      
      if (upcRes.ok) {
        const data = await upcRes.json();
        
        if (data.code === 'OK' && data.items && data.items.length > 0) {
          const item = data.items[0];
          
          // Determine type based on category hierarchy
          let type = 'product';
          const category = (item.category || '').toLowerCase();
          const title = (item.title || '').toLowerCase();
          
          if (category.includes('book') || category.includes('literature')) {
            type = 'book';
          } else if (
            category.includes('music') || 
            category.includes('cd') || 
            category.includes('vinyl') || 
            category.includes('audio') || 
            category.includes('album') ||
            title.includes(' vinyl') ||
            title.includes(' (cd)')
          ) {
            type = 'music';
          } else if (
            category.includes('movie') || 
            category.includes('dvd') || 
            category.includes('blu-ray') || 
            category.includes('video') || 
            category.includes('film') ||
            title.includes(' dvd') ||
            title.includes(' blu-ray')
          ) {
            type = 'movie';
          } else if (category.includes('game') || category.includes('software')) {
            type = 'game';
          }
          
          // Extract creator
          let creator = item.brand || item.publisher || '';
          if (!creator && type === 'music') {
            creator = item.artist || 'Unknown Artist';
          } else if (!creator && type === 'movie') {
            creator = item.director || 'Unknown Director';
          } else if (!creator && type === 'book') {
            creator = item.author || 'Unknown Author';
          }
          if (!creator) {
            creator = 'N/A';
          }

          let result = {
            success: true,
            source: 'UPCitemdb',
            barcode,
            title: item.title || 'Unknown Title',
            subtitle: '',
            creator,
            type,
            description: item.description || 'No description available.',
            thumbnail: item.images?.[0] || '',
            publisher: item.publisher || item.brand || 'Unknown',
            publishedDate: 'N/A',
            extra: {
              category: item.category || 'N/A',
              offers: item.offers?.slice(0, 3).map(o => ({
                merchant: o.merchant,
                price: o.price,
                link: o.link
              })) || [],
              model: item.model || '',
              asin: item.asin || ''
            }
          };

          // Enrich movies with TMDb and OMDb APIs
          if (type === 'movie') {
            try {
              let searchTitle = item.title || '';
              // Clean up title (remove formats, years, distributor details)
              searchTitle = searchTitle
                .replace(/\b(dvd|blu-ray|bluray|brd|ultra hd|4k|combo pack|special edition|collector's edition|anniversary edition|widescreen|fullscreen|steelbook|sensormatic|disc|1-disc|2-disc|digital video disc|digitally remastered)\b/gi, '')
                .replace(/[\[\({].*?[\]\)}]/g, '')
                .replace(/\b(lucasfilm|disney|hasbro|warner bros|warner|universal studios|universal|paramount|sony pictures|sony|columbia pictures|mgm|20th century fox|20th century studios|fox|hbo|bbc|criterion collection|criterion|mill creek)\b/gi, '')
                .replace(/ - /g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
                
              console.log(`[Movie Enrichment] Querying TMDb & OMDb for: "${searchTitle}"`);
              
              const [tmdbSearchRes, omdbRes] = await Promise.all([
                fetch(`https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(searchTitle)}&api_key=${tmdbKey}`),
                fetch(`http://www.omdbapi.com/?t=${encodeURIComponent(searchTitle)}&apikey=${omdbKey}`)
              ]);

              let tmdbDetails = null;
              if (tmdbSearchRes.ok) {
                const tmdbSearchData = await tmdbSearchRes.json();
                if (tmdbSearchData.results && tmdbSearchData.results.length > 0) {
                  // Filter by year <= 2006 if it is a VHS tape
                  const filtered = tmdbSearchData.results.filter(m => {
                    if (!isVhs) return true;
                    const releaseYear = m.release_date ? parseInt(m.release_date.substring(0, 4)) : 0;
                    return releaseYear > 0 && releaseYear <= 2006;
                  });
                  if (filtered.length > 0) {
                    const movieId = filtered[0].id;
                    const tmdbDetailRes = await fetch(`https://api.themoviedb.org/3/movie/${movieId}?api_key=${tmdbKey}&append_to_response=credits`);
                    if (tmdbDetailRes.ok) {
                      tmdbDetails = await tmdbDetailRes.json();
                    }
                  }
                }
              }

              let omdbData = null;
              if (omdbRes.ok) {
                const oData = await omdbRes.json();
                if (oData.Response === 'True') {
                  omdbData = oData;
                }
              }

              // Apply enrichment
              if (tmdbDetails) {
                result.source = 'TMDb & UPCitemdb';
                result.title = tmdbDetails.title || result.title;
                result.subtitle = tmdbDetails.tagline || '';
                
                // Get Director
                const director = tmdbDetails.credits?.crew?.find(c => c.job === 'Director')?.name;
                if (director) result.creator = director;
                
                result.description = tmdbDetails.overview || result.description;
                if (tmdbDetails.poster_path) {
                  result.thumbnail = `https://image.tmdb.org/t/p/w500${tmdbDetails.poster_path}`;
                }
                
                result.publishedDate = tmdbDetails.release_date ? tmdbDetails.release_date.substring(0, 4) : result.publishedDate;
                
                // Add TMDB specific details
                result.extra.backdrop = tmdbDetails.backdrop_path ? `https://image.tmdb.org/t/p/w1280${tmdbDetails.backdrop_path}` : '';
                result.extra.genres = tmdbDetails.genres?.map(g => g.name) || [],
                result.extra.runtime = tmdbDetails.runtime ? `${tmdbDetails.runtime} min` : '';
                result.extra.cast = tmdbDetails.credits?.cast?.slice(0, 5).map(c => c.name) || [];
                result.extra.tmdbRating = tmdbDetails.vote_average || null;
              }

              if (omdbData) {
                if (!tmdbDetails) {
                  // Fallback to OMDb if TMDb didn't find anything
                  result.source = 'OMDb & UPCitemdb';
                  result.title = omdbData.Title || result.title;
                  result.creator = omdbData.Director !== 'N/A' ? omdbData.Director : result.creator;
                  result.description = omdbData.Plot !== 'N/A' ? omdbData.Plot : result.description;
                  if (omdbData.Poster && omdbData.Poster !== 'N/A') {
                    result.thumbnail = omdbData.Poster;
                  }
                  result.publishedDate = omdbData.Year || result.publishedDate;
                }
                
                result.extra.rated = omdbData.Rated || 'N/A';
                result.extra.ratings = omdbData.Ratings || [];
                result.extra.boxOffice = omdbData.BoxOffice || 'N/A';
                result.extra.imdbRating = omdbData.imdbRating || null;
              }

            } catch (enrichErr) {
              console.error('[Movie Enrichment Error]', enrichErr.message);
            }
          }

          return sendResult(res, barcode, result);
        } else if (data.code === 'INVALID_UPC') {
          return res.status(400).json({ success: false, error: 'Invalid barcode checksum or format according to UPC standards.' });
        } else {
          console.warn(`[UpcItemDb] Non-OK JSON response: Code=${data.code}, Message=${data.message || 'N/A'}`);
        }
      } else {
        // Handle rate limiting (429) or other errors from UpcItemDb
        console.warn(`[UpcItemDb] HTTP Error: Status=${upcRes.status}`);
      }
    } catch (upcErr) {
      console.error('[UpcItemDb Error]', upcErr.message);
    }

    // 4. CRITICAL FALLBACK: If UpcItemDb failed or was rate-limited, query DuckDuckGo search engine
    console.log(`[Fallback] Querying search engine for barcode: ${barcode}`);
    try {
      const searchTitle = await resolveTitleFromSearchEngine(barcode);
      if (searchTitle) {
        console.log(`[Fallback] Resolved title: "${searchTitle}"`);
        
        let result = {
          success: true,
          source: 'Search Fallback',
          barcode,
          title: searchTitle,
          subtitle: '',
          creator: 'N/A',
          type: 'product',
          description: `Product details resolved via search engine fallback for barcode ${barcode}.`,
          thumbnail: '',
          publisher: 'Unknown',
          publishedDate: 'N/A',
          extra: {
            category: 'General Product'
          }
        };

        // Try movie lookups with TMDb & OMDb using the resolved title
        try {
          // Strip everything after ellipses, sidetracks
          let movieSearchTitle = searchTitle;
          const dotIndex = movieSearchTitle.indexOf('...');
          if (dotIndex !== -1) {
            movieSearchTitle = movieSearchTitle.substring(0, dotIndex);
          }
          movieSearchTitle = movieSearchTitle
            .replace(/\b(dvd|blu-ray|bluray|brd|ultra hd|4k|combo pack|special edition|collector's edition|anniversary edition|widescreen|fullscreen|steelbook|sensormatic|disc|1-disc|2-disc|digital video disc|digitally remastered|laserdisc|ld|clv|vhs)\b/gi, '')
            .replace(/[\[\({].*?[\]\)}]/g, '')
            .replace(/\b(lucasfilm|disney|hasbro|warner bros|warner|universal studios|universal|paramount|sony pictures|sony|columbia pictures|mgm|20th century fox|20th century studios|fox|hbo|bbc|criterion collection|criterion|mill creek|ebay|amazon|target|walmart|best buy|database|wiki|review|shop|store|online|buy|price)\b/gi, '')
            .replace(/[-|:|—|\||/]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

          console.log(`[Fallback Movie Search] Searching TMDb & OMDb for: "${movieSearchTitle}"`);
          
          let tmdbSearchRes = await fetch(`https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(movieSearchTitle)}&api_key=${tmdbKey}`);
          let tmdbSearchData = tmdbSearchRes.ok ? await tmdbSearchRes.json() : null;
          
          let omdbRes = await fetch(`http://www.omdbapi.com/?t=${encodeURIComponent(movieSearchTitle)}&apikey=${omdbKey}`);
          let omdbData = omdbRes.ok ? await omdbRes.json() : null;

          // Retry with first 5 words if no results found
          if ((!tmdbSearchData || !tmdbSearchData.results || tmdbSearchData.results.length === 0) && (!omdbData || omdbData.Response !== 'True')) {
            const words = movieSearchTitle.split(' ');
            if (words.length > 5) {
              const truncatedTitle = words.slice(0, 5).join(' ');
              console.log(`[Fallback Movie Search Retry] No results for full title. Retrying with truncated title: "${truncatedTitle}"`);
              
              const [retryTmdbRes, retryOmdbRes] = await Promise.all([
                fetch(`https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(truncatedTitle)}&api_key=${tmdbKey}`),
                fetch(`http://www.omdbapi.com/?t=${encodeURIComponent(truncatedTitle)}&apikey=${omdbKey}`)
              ]);
              
              if (retryTmdbRes.ok) {
                const retryTmdbData = await retryTmdbRes.json();
                if (retryTmdbData.results && retryTmdbData.results.length > 0) {
                  tmdbSearchData = retryTmdbData;
                }
              }
              if (retryOmdbRes.ok) {
                const retryOmdbData = await retryOmdbRes.json();
                if (retryOmdbData.Response === 'True') {
                  omdbData = retryOmdbData;
                }
              }
            }
          }

          let tmdbDetails = null;
          if (tmdbSearchData && tmdbSearchData.results && tmdbSearchData.results.length > 0) {
            // Filter by year <= 2006 if it is a VHS tape
            const filtered = tmdbSearchData.results.filter(m => {
              if (!isVhs) return true;
              const releaseYear = m.release_date ? parseInt(m.release_date.substring(0, 4)) : 0;
              return releaseYear > 0 && releaseYear <= 2006;
            });
            if (filtered.length > 0) {
              const movieId = filtered[0].id;
              const tmdbDetailRes = await fetch(`https://api.themoviedb.org/3/movie/${movieId}?api_key=${tmdbKey}&append_to_response=credits`);
              if (tmdbDetailRes.ok) {
                tmdbDetails = await tmdbDetailRes.json();
              }
            }
          }

          if (omdbData && omdbData.Response !== 'True') {
            omdbData = null;
          }

          if (tmdbDetails) {
            result.source = 'TMDb (Fallback)';
            result.title = tmdbDetails.title || result.title;
            result.subtitle = tmdbDetails.tagline || '';
            result.creator = tmdbDetails.credits?.crew?.find(c => c.job === 'Director')?.name || result.creator;
            result.type = 'movie';
            result.description = tmdbDetails.overview || result.description;
            if (tmdbDetails.poster_path) {
              result.thumbnail = `https://image.tmdb.org/t/p/w500${tmdbDetails.poster_path}`;
            }
            result.publishedDate = tmdbDetails.release_date ? tmdbDetails.release_date.substring(0, 4) : result.publishedDate;
            result.extra = {
              category: 'Media > Movies',
              backdrop: tmdbDetails.backdrop_path ? `https://image.tmdb.org/t/p/w1280${tmdbDetails.backdrop_path}` : '',
              genres: tmdbDetails.genres?.map(g => g.name) || [],
              runtime: tmdbDetails.runtime ? `${tmdbDetails.runtime} min` : '',
              cast: tmdbDetails.credits?.cast?.slice(0, 5).map(c => c.name) || [],
              tmdbRating: tmdbDetails.vote_average || null
            };
          }

          if (omdbData) {
            if (!tmdbDetails) {
              result.source = 'OMDb (Fallback)';
              result.title = omdbData.Title || result.title;
              result.creator = omdbData.Director !== 'N/A' ? omdbData.Director : result.creator;
              result.type = 'movie';
              result.description = omdbData.Plot !== 'N/A' ? omdbData.Plot : result.description;
              if (omdbData.Poster && omdbData.Poster !== 'N/A') {
                result.thumbnail = omdbData.Poster;
              }
              result.publishedDate = omdbData.Year || result.publishedDate;
              result.extra = { category: 'Media > Movies' };
            }
            result.extra.rated = omdbData.Rated || 'N/A';
            result.extra.ratings = omdbData.Ratings || [];
            result.extra.boxOffice = omdbData.BoxOffice || 'N/A';
            result.extra.imdbRating = omdbData.imdbRating || null;
          }

        } catch (enrichErr) {
          console.error('[Fallback Enrichment Error]', enrichErr.message);
        }

        return sendResult(res, barcode, result);
      }
    } catch (fallbackErr) {
      console.error('[Search Fallback Process Error]', fallbackErr.message);
    }

    // If all lookups failed
    return res.status(404).json({ 
      success: false, 
      error: 'Product not found in book or media databases. Check the barcode and try again.' 
    });

  } catch (err) {
    console.error('[Lookup System Error]', err);
    return res.status(500).json({ success: false, error: 'Internal server error during metadata lookup.' });
  }
});

// API route for search by title
app.get('/api/search', async (req, res) => {
  const tmdbKey = req.headers['x-tmdb-api-key'] || req.query.tmdb_key || TMDB_API_KEY;
  const query = req.query.q;
  const type = req.query.type || 'all'; // 'all', 'book', 'movie', 'music'
  const isVhs = req.query.isVhs === 'true';

  if (!query) {
    return res.status(400).json({ success: false, error: 'Query parameter "q" is required.' });
  }

  console.log(`[Search API] Searching for "${query}" (type: ${type})`);
  
  try {
    const results = [];

    // 1. Search books (Google Books with Open Library fallback)
    if (type === 'all' || type === 'book') {
      let booksFound = false;
      try {
        console.log(`[Google Books Search] Querying: "${query}"`);
        const gbRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=5`);
        if (gbRes.ok) {
          const gbData = await gbRes.json();
          if (gbData.items && gbData.items.length > 0) {
            booksFound = true;
            gbData.items.slice(0, 5).forEach(item => {
              const info = item.volumeInfo;
              const isbn = info.industryIdentifiers?.find(id => id.type === 'ISBN_13' || id.type === 'ISBN_10')?.identifier || item.id;
              const thumbnail = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || '';
              results.push({
                title: info.title,
                creator: info.authors?.join(', ') || 'Unknown Author',
                type: 'book',
                publishedDate: info.publishedDate || 'N/A',
                barcode: isbn,
                thumbnail: thumbnail,
                source: 'Google Books',
                description: info.description || undefined,
                extra: {
                  pages: info.pageCount || null,
                  genres: info.categories || [],
                  googleBooksUrl: info.infoLink || ''
                }
              });
            });
          }
        }
      } catch (err) {
        console.error('[Google Books Search Error]', err.message);
      }

      // Fallback to Open Library search if no books found
      if (!booksFound) {
        try {
          console.log(`[Open Library Search Fallback] Querying: "${query}"`);
          const olRes = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=5`);
          if (olRes.ok) {
            const olData = await olRes.json();
            if (olData.docs) {
              olData.docs.slice(0, 5).forEach(doc => {
                results.push({
                  title: doc.title,
                  creator: doc.author_name?.join(', ') || 'Unknown Author',
                  type: 'book',
                  publishedDate: doc.first_publish_year || 'N/A',
                  barcode: doc.isbn?.[0] || doc.key,
                  thumbnail: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : '',
                  source: 'Open Library',
                  extra: {
                    pages: doc.number_of_pages_median || null,
                    openLibraryUrl: doc.key ? `https://openlibrary.org${doc.key}` : ''
                  }
                });
              });
            }
          }
        } catch (err) {
          console.error('[Search API Book Fallback Error]', err.message);
        }
      }
    }

    // 2. Search movies (TMDb)
    if (type === 'all' || type === 'movie') {
      try {
        let tmdbRes = await fetch(`https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(query)}&api_key=${tmdbKey}`);
        let tmdbData = tmdbRes.ok ? await tmdbRes.json() : null;

        // Fallback: If no results and query contains a dash, try searching for the part before the dash
        if ((!tmdbData || !tmdbData.results || tmdbData.results.length === 0) && query.includes(' - ')) {
          const parts = query.split(' - ');
          const simplifiedQuery = parts[0].trim();
          console.log(`[Search API Fallback] No results for "${query}". Trying simplified query: "${simplifiedQuery}"`);
          tmdbRes = await fetch(`https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(simplifiedQuery)}&api_key=${tmdbKey}`);
          if (tmdbRes.ok) {
            tmdbData = await tmdbRes.json();
          }
        }

        if (tmdbData && tmdbData.results) {
          // If isVhs is true, we filter out movies released after 2006 (end of VHS era)
          const filteredResults = tmdbData.results.filter(m => {
            if (!isVhs) return true;
            const releaseYear = m.release_date ? parseInt(m.release_date.substring(0, 4)) : 0;
            return releaseYear > 0 && releaseYear <= 2006;
          });

          filteredResults.slice(0, 5).forEach(m => {
            results.push({
              title: m.title,
              creator: 'Movie',
              type: 'movie',
              publishedDate: m.release_date ? m.release_date.substring(0, 4) : 'N/A',
              barcode: `tmdb_${m.id}`, // Custom TMDb ID prefix
              thumbnail: m.poster_path ? `https://image.tmdb.org/t/p/w200${m.poster_path}` : '',
              source: 'TMDb',
              description: m.overview || '',
              extra: {
                backdrop: m.backdrop_path ? `https://image.tmdb.org/t/p/w1280${m.backdrop_path}` : '',
                tmdbRating: m.vote_average
              }
            });
          });
        }
      } catch (err) {
        console.error('[Search API Movie Error]', err.message);
      }
    }

    // 3. Search music (MusicBrainz)
    if (type === 'all' || type === 'music') {
      try {
        const mbRes = await fetch(`https://musicbrainz.org/ws/2/release?query=${encodeURIComponent(query)}&fmt=json&limit=5`, {
          headers: {
            'User-Agent': 'AuraScan/1.0.0 (contact@example.com)'
          }
        });
        if (mbRes.ok) {
          const mbData = await mbRes.json();
          if (mbData.releases) {
            mbData.releases.slice(0, 5).forEach(r => {
              results.push({
                title: r.title,
                creator: r['artist-credit']?.map(ac => ac.name).join(', ') || 'Unknown Artist',
                type: 'music',
                publishedDate: r.date ? r.date.substring(0, 4) : 'N/A',
                barcode: r.barcode || `mb_${r.id}`, // MB barcode or MBID fallback
                thumbnail: '',
                source: 'MusicBrainz',
                extra: {
                  mbid: r.id,
                  label: r['label-info']?.map(li => li.label?.name).filter(Boolean).join(', ') || 'N/A'
                }
              });
            });
          }
        }
      } catch (err) {
        console.error('[Search API Music Error]', err.message);
      }
    }

    // 4. Search video games (DuckDuckGo Instant Answer API)
    
    // 5. Search Trading Cards (Pokemon TCG API as an example, but works generically if name matches)
    if (type === 'all' || type === 'card') {
      try {
        console.log(`[Search API Card] Querying Pokemon TCG API for "${query}"`);
        const cleanQuery = query.replace(/[^a-zA-Z0-9 ]/g, '').trim();
        const tcgRes = await fetch(`https://api.pokemontcg.io/v2/cards?q=name:"${encodeURIComponent(cleanQuery)}"&pageSize=1`);
        if (tcgRes.ok) {
          const tcgData = await tcgRes.json();
          if (tcgData.data && tcgData.data.length > 0) {
            const card = tcgData.data[0];
            results.push({
              title: card.name,
              creator: card.set?.series ? `Pokemon (${card.set.series})` : 'Pokemon TCG',
              type: 'card',
              publishedDate: card.set?.releaseDate ? card.set.releaseDate.split('/')[0] : 'N/A',
              barcode: card.id,
              thumbnail: card.images?.large || card.images?.small || '',
              source: 'Pokemon TCG API',
              description: card.flavorText || card.attacks?.map(a => a.name + ': ' + a.text).join(' | ') || '',
              extra: {
                category: 'Trading Card',
                cardNumber: card.number,
                set: card.set?.name,
                rarity: card.rarity
              }
            });
          }
        }
      } catch (err) {
        console.error('[Search API Card Error]', err.message);
      }
    }

    if (type === 'all' || type === 'game') {
      try {
        console.log(`[Search API Game] Querying DuckDuckGo Instant Answer for "${query}"`);
        const ddgRes = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`);
        if (ddgRes.ok) {
          const ddgData = await ddgRes.json();
          if (ddgData.Heading && ddgData.AbstractText) {
            let publishedDate = 'N/A';
            const yearMatch = ddgData.AbstractText.match(/\b(19\d{2}|20\d{2})\b/);
            if (yearMatch) {
              publishedDate = yearMatch[1];
            }

            results.push({
              title: ddgData.Heading,
              creator: 'Video Game',
              type: 'game',
              publishedDate,
              barcode: `ddg_${ddgData.Heading.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
              thumbnail: ddgData.Image ? `https://duckduckgo.com${ddgData.Image}` : '',
              source: 'DuckDuckGo',
              description: ddgData.AbstractText || '',
              extra: {
                category: 'Video Game'
              }
            });
          }
        }
      } catch (err) {
        console.error('[Search API Game Error]', err.message);
      }
    }

    for (const item of results) {
      if (item.thumbnail) {
        item.thumbnail = await fetchUrlAsBase64(item.thumbnail);
      }
    }
    return res.json({ success: true, results });

  } catch (err) {
    console.error('[Search API System Error]', err);
    return res.status(500).json({ success: false, error: 'Internal server error during search.' });
  }
});

// Route for AI visual recognition of collectibles using Gemini 3.5 Flash (or dynamically requested model version)

app.post('/api/identify-batch', async (req, res) => {
  const geminiKey = req.headers['x-gemini-api-key'];
  const model = req.headers['x-gemini-model'] || 'gemini-1.5-flash';
  const { image, collectionType, collectionName, customFields } = req.body;

  if (!geminiKey) {
    return res.status(401).json({ success: false, error: 'Gemini API key is required' });
  }

  if (!image) {
    return res.status(400).json({ success: false, error: 'Image data is required' });
  }

  try {
    const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, '');

    let customPrompt = '';
    if (customFields && customFields.length > 0) {
      const fieldNames = customFields.map(f => f.name).join(', ');
      customPrompt = ` Try to also extract or infer the following custom fields if possible: ${fieldNames}.`;
    }

    const prompt = `Identify all ${collectionName || collectionType} visible in this image. Extract them into a JSON array of objects.
      Each object must have:
      - title (String): The exact title of the item.
      - creator (String): The author, artist, director, or manufacturer.
      - year (String): The release year, if visible.
      - description (String): A brief summary or description of this collectible item (1-3 sentences).
      - mediaType (String): The specific format of the item if identifiable (e.g., 'DVD', 'Blu-ray', '4K UHD', 'VHS', 'CD', 'Vinyl', etc.).
      - customData (Object): ${customPrompt}

      Return ONLY raw JSON formatting without markdown formatting like \`\`\`json. Output format: { "results": [ { ... } ] }`;

    const requestBody = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: base64Data
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2
      }
    };

    let response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok && (response.status === 404 || response.status === 503 || response.status === 429 || response.status === 500)) {
      const errText = await response.clone().text();
      console.warn(`[Gemini Batch API Warning] Primary model ${model} failed: ${errText}. Attempting fallbacks...`);
      
      const fallbacks = ['gemini-1.5-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-pro-vision'];
      for (const fallbackModel of fallbacks) {
        console.log(`[Gemini Batch API] Querying fallback model: ${fallbackModel}...`);
        try {
          const fallbackRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${fallbackModel}:generateContent?key=${geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          });
          if (fallbackRes.ok) {
            response = fallbackRes;
            console.log(`[Gemini Batch API] Fallback to ${fallbackModel} succeeded.`);
            break;
          } else {
            const fbErrText = await fallbackRes.text();
            console.warn(`[Gemini Batch API Warning] Fallback to ${fallbackModel} failed: ${fbErrText}`);
          }
        } catch (e) {
          console.warn(`[Gemini Batch API Warning] Fallback network error for ${fallbackModel}:`, e.message);
        }
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Batch Identify API Error]', errorText);
      return res.status(response.status).json({ success: false, error: 'Failed to communicate with Gemini.' });
    }

    const data = await response.json();
    let textResult = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Clean up markdown wrapper if model ignored instructions
    textResult = textResult.replace(/^\s*\x60\x60\x60json\n/i, '').replace(/\n\x60\x60\x60\s*$/, '').trim();

    let parsedResult;
    try {
      parsedResult = JSON.parse(textResult);
    } catch (parseErr) {
      console.error('[Batch Identify JSON Parse Error]', textResult);
      return res.status(500).json({ success: false, error: 'Gemini returned invalid JSON.' });
    }

    return res.json({ success: true, results: parsedResult.results || [] });
  } catch (err) {
    console.error('[Batch Identify API Error]', err);
    return res.status(500).json({ success: false, error: 'Internal server error during batch identification.' });
  }
});
app.post('/api/identify', async (req, res) => {
  const geminiKey = req.headers['x-gemini-api-key'] || req.body.gemini_key;
  const geminiModel = req.headers['x-gemini-model'] || req.body.gemini_model || 'gemini-3.5-flash';
  const image = req.body.image;
  const collectionType = req.body.collectionType || 'Custom';
  const collectionName = req.body.collectionName || '';
  const customFields = req.body.customFields || [];

  if (!geminiKey) {
    return res.status(400).json({ success: false, error: 'Gemini API Key is required. Please add it in Settings.' });
  }

  if (!image) {
    return res.status(400).json({ success: false, error: 'Image data is required.' });
  }

  try {
    // Strip base64 data prefix if present
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`;
    
    const fieldsPrompt = customFields.length > 0
      ? `The collection defines these custom fields. You MUST map the values you extract to these exact keys in the "customData" object (only include keys that exist in this list):
${JSON.stringify(customFields.map(f => ({ id: f.id, name: f.name, type: f.type })))}`
      : `Provide any relevant metadata in the "customData" object matching typical fields like:
{
  "author": "string (only if book)",
  "publisher": "string (only if book/music/game/comic/magazine/wine)",
  "year": "string/number (year)",
  "genre": "string (genre of the book, movie, game or music)",
  "cardNumber": "string (e.g. 020/189 - only if Pokemon/TCG card)",
  "set": "string (e.g. Darkness Ablaze - only if Pokemon/TCG card)",
  "rarity": "string (e.g. Holo Rare - only if Pokemon/TCG card)",
  "type": "string (e.g. Fire, Water, Trainer - only if Pokemon/TCG card)",
  "weight": "string (e.g. 199.5 lbs - only if Pokemon card)",
  "height": "string (e.g. 5'07\\\" - only if Pokemon card)",
  "pokemonNumber": "string (e.g. #006 - only if Pokemon card)",
  "platform": "string (e.g. Nintendo Wii - only if video game)",
  "director": "string (only if movie/vhs)",
  "artist": "string (only if music/art)",
  "label": "string (only if music)"
}`;

    const prompt = `Analyze this photo of a collectible item (such as a Pokemon card, Magic card, coin, action figure, book, vinyl record, cassette, VHS tape, board game, toy car, Lego set, etc.).
Identify the item and extract the following details. 

You MUST return the response STRICTLY as a single JSON object matching this schema:
{
  "title": "Full official name of the item (e.g. Charizard VMAX or Super Mario Galaxy or Winnie the Pooh)",
  "creator": "Brand, manufacturer, author, artist, director, or publisher (e.g. The Pokemon Company, Nintendo, J.K. Rowling, Disney)",
  "year": "Release or publication year (4 digits, or 'Unknown')",
  "description": "A brief summary or description of this collectible item (1-3 sentences)",
  "mediaType": "The specific format of the item if identifiable (e.g., 'DVD', 'Blu-ray', '4K UHD', 'VHS', 'CD', 'Vinyl', etc.)",
  "customData": {
     // Key-value pairs matching the custom fields
  }
}

Context: This item belongs to a collection named "${collectionName}" of category type "${collectionType}".
${fieldsPrompt}`;

    const requestBody = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Data
              }
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json"
      }
    };

    console.log(`[Gemini API] Querying ${geminiModel} for image identification (collection type: ${collectionType})...`);
    
    // Log the list of models from Gemini to see valid identifiers
    try {
      const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`);
      if (listRes.ok) {
        const listData = await listRes.json();
        const names = listData.models?.map((m) => m.name);
        console.log('[Gemini API] Available models for this key:', JSON.stringify(names));
      } else {
        console.warn('[Gemini API] Failed to list models:', listRes.status);
      }
    } catch (e) {
      console.warn('[Gemini API] Error listing models:', e.message);
    }

    let response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    // If the primary model fails due to high load, rate limits, or server error, attempt fallback models
    if (!response.ok && (response.status === 503 || response.status === 429 || response.status === 500)) {
      const errText = await response.clone().text();
      console.warn(`[Gemini API Warning] Primary model ${geminiModel} failed with status ${response.status}: ${errText}. Attempting fallback models...`);
      
      const fallbacks = ['gemini-2.5-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-2.0-flash'].filter(m => m !== geminiModel);
      for (const fallbackModel of fallbacks) {
        console.log(`[Gemini API] Querying fallback model: ${fallbackModel}...`);
        const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/${fallbackModel}:generateContent?key=${geminiKey}`;
        try {
          const fallbackRes = await fetch(fallbackUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
          });
          if (fallbackRes.ok) {
            response = fallbackRes;
            console.log(`[Gemini API] Fallback to ${fallbackModel} succeeded.`);
            break;
          } else {
            const fbErrText = await fallbackRes.text();
            console.warn(`[Gemini API Warning] Fallback to ${fallbackModel} failed: ${fbErrText}`);
          }
        } catch (e) {
          console.warn(`[Gemini API Warning] Fallback network error for ${fallbackModel}:`, e.message);
        }
      }
    }

    if (!response.ok) {
      const errText = await response.text();
      console.error('[Gemini API Error]', errText);
      return res.status(response.status).json({ success: false, error: `Gemini API returned error: ${errText}` });
    }

    const data = await response.json();
    
    // Extract JSON string from Gemini's response structure
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      throw new Error('Gemini did not return any text candidates.');
    }

    // Parse the returned JSON text
    let parsedResult;
    try {
      parsedResult = JSON.parse(candidateText.trim());
    } catch (parseErr) {
      console.error('Failed to parse Gemini output as JSON:', candidateText);
      throw new Error('Gemini output was not valid JSON.');
    }

    // Return the recognized metadata
    return res.json({
      success: true,
      result: parsedResult
    });

  } catch (err) {
    console.error('[Identify API Error]', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal server error during image identification.' });
  }
});

// Serve dist/index.html for any other route (SPA fallback)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const KEY_FILE = path.join(__dirname, '..', 'certs', 'key.pem');
const CERT_FILE = path.join(__dirname, '..', 'certs', 'cert.pem');

if (fs.existsSync(KEY_FILE) && fs.existsSync(CERT_FILE)) {
  const credentials = {
    key: fs.readFileSync(KEY_FILE, 'utf8'),
    cert: fs.readFileSync(CERT_FILE, 'utf8')
  };
  const httpsServer = https.createServer(credentials, app);
  httpsServer.listen(PORT, () => {
    console.log(`HTTPS Server is running at https://localhost:${PORT}`);
  });
} else {
  app.listen(PORT, () => {
    console.log(`HTTP Server is running at http://localhost:${PORT}`);
  });
}
