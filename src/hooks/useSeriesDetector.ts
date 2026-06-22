import { useState, useEffect } from 'react';
import type { Item, Collection } from '../types';

export interface SeriesSuggestion {
  seriesName: string;
  items: Item[];
}

export const useSeriesDetector = (items: Item[], collection?: Collection) => {
  const [suggestions, setSuggestions] = useState<SeriesSuggestion[]>([]);

  useEffect(() => {
    if (!collection || collection.type !== 'Books' || !items || items.length === 0) {
      setSuggestions([]);
      return;
    }

    const detect = () => {
      // 1. Group by author
      const byAuthor: Record<string, Item[]> = {};
      items.forEach(item => {
        const author = item.customData?.author?.trim() || 'Unknown';
        if (author && author !== 'Unknown' && author !== 'N/A') {
          if (!byAuthor[author]) byAuthor[author] = [];
          byAuthor[author].push(item);
        }
      });

      const foundSuggestions: SeriesSuggestion[] = [];

      for (const author in byAuthor) {
        const authorItems = byAuthor[author];
        if (authorItems.length < 2) continue;

        const prefixes: Record<string, Set<Item>> = {};
        
        authorItems.forEach(item => {
          let titleStr = item.title;
          let possiblePrefixes: string[] = [];
          
          // Split by colons or hyphens
          if (titleStr.includes(':')) {
            possiblePrefixes.push(titleStr.split(':')[0].trim());
          }
          if (titleStr.includes(' - ')) {
            possiblePrefixes.push(titleStr.split(' - ')[0].trim());
          }
          
          // Look for Series, Book, Vol, Part syntax in parenthesis or following a comma
          const match = titleStr.match(/^(.*?)(?:,|\s-|\s:|\(|Book|Vol|Volume|#|\sPart)/i);
          if (match && match[1]) {
            const prefix = match[1].trim();
            if (prefix.length > 3 && prefix !== titleStr) {
               possiblePrefixes.push(prefix);
            }
          }
          
          possiblePrefixes.forEach(p => {
             // Clean up prefix
             let cleanP = p.replace(/^(The|A|An)\s+/i, '');
             if (cleanP.length > 3) {
               if (!prefixes[cleanP]) prefixes[cleanP] = new Set();
               prefixes[cleanP].add(item);
             }
          });
        });

        // 2. Evaluate prefixes
        for (const prefix in prefixes) {
          const matchedItems = Array.from(prefixes[prefix]);
          if (matchedItems.length >= 2) {
             // Check if they need tagging (some don't have this exact series tag yet)
             const needsTagging = matchedItems.some(i => i.customData?.series?.toLowerCase() !== prefix.toLowerCase());
             if (needsTagging) {
                foundSuggestions.push({
                   seriesName: prefix,
                   items: matchedItems
                });
             }
          }
        }
      }
      
      // 3. Filter out overlapping suggestions (greedily keep largest groups, then longest prefix)
      const deduplicated: SeriesSuggestion[] = [];
      const seenItemIds = new Set<string>();
      
      foundSuggestions.sort((a, b) => b.items.length - a.items.length || b.seriesName.length - a.seriesName.length);
      
      for (const sug of foundSuggestions) {
         // Only accept suggestion if at least 2 items are NOT already part of another suggestion
         const unseenItems = sug.items.filter(i => !seenItemIds.has(i.id));
         if (unseenItems.length >= 2) {
            deduplicated.push({ ...sug, items: unseenItems }); // only keep the ones not overlapping
            unseenItems.forEach(i => seenItemIds.add(i.id));
         }
      }

      setSuggestions(deduplicated);
    };

    detect();
  }, [items, collection]);

  return suggestions;
};
