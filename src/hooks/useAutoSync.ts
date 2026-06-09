import { useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { syncService } from '../db/sync';

export const useAutoSync = () => {
  const collections = useLiveQuery(() => db.collections.toArray());
  const items = useLiveQuery(() => db.items.toArray());
  const firstLoad = useRef(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Skip the very first load to avoid pushing immediately on app start
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }

    // Check if sync is configured
    const config = syncService.getConfig();
    if (!config || !config.token) return;

    // Debounce the sync to avoid hitting GitHub API limits
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      try {
        console.log('Auto-syncing to GitHub...');
        await syncService.push();
      } catch (e) {
        console.error('Auto-sync failed:', e);
      }
    }, 5000); // 5 second debounce

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [collections, items]);
};
