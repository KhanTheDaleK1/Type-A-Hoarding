import { db } from '../db/db';

export interface GitHubSyncConfig {
  token: string;
  owner: string;
  repo: string;
  path: string;
}

// Robust Base64 encoding for Unicode strings
function toBase64(str: string) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export const syncService = {
  getConfig(): GitHubSyncConfig | null {
    const config = localStorage.getItem('hoarding_github_config');
    return config ? JSON.parse(config) : null;
  },

  saveConfig(config: GitHubSyncConfig) {
    localStorage.setItem('hoarding_github_config', JSON.stringify(config));
  },

  async push() {
    const config = this.getConfig();
    if (!config) throw new Error('GitHub sync not configured');

    const collections = await db.collections.toArray();
    let items = await db.items.toArray();

    // Check if user wants to exclude images from backup to save space/bandwidth
    const excludeImages = localStorage.getItem('hoarding_exclude_images_backup') === 'true';
    if (excludeImages) {
      items = items.map(item => ({ ...item, images: [] }));
    }

    const content = JSON.stringify({ collections, items }, null, 2);
    
    // GitHub Contents API has a 25MB limit
    if (content.length > 25 * 1024 * 1024) {
      throw new Error('Backup size too large (exceeds 25MB). Try removing some high-res images.');
    }

    // 1. Get current file SHA (if it exists) to update it
    let sha: string | undefined;
    try {
      const getRes = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.path}`, {
        headers: {
          'Authorization': `Bearer ${config.token}`,
          'Accept': 'application/vnd.github+json'
        }
      });
      if (getRes.ok) {
        const data = await getRes.json();
        sha = data.sha;
      }
    } catch (e) {
      console.log('File does not exist yet, creating new one.');
    }

    // 2. Push to GitHub
    const res = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.path}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Sync: ${new Date().toISOString()}`,
        content: toBase64(content),
        sha
      })
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to push to GitHub');
    }

    return res.json();
  },

  async pull(merge = false) {
    const config = this.getConfig();
    if (!config) throw new Error('GitHub sync not configured');

    const res = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.path}`, {
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Accept': 'application/vnd.github+json'
      }
    });

    if (!res.ok) {
      if (res.status === 404) throw new Error('No backup found in repository.');
      const error = await res.json();
      throw new Error(error.message || 'Failed to pull from GitHub');
    }

    const data = await res.json();
    const binary = atob(data.content);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const content = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(content);

    if (parsed.collections && parsed.items) {
      if (merge) {
        // Merge collections
        for (const col of parsed.collections) {
          const localCol = await db.collections.get(col.id);
          if (!localCol) {
            await db.collections.add(col);
          } else if (col.createdAt > (localCol.createdAt || 0)) {
            await db.collections.put(col);
          }
        }

        // Merge items
        for (const item of parsed.items) {
          const localItem = await db.items.get(item.id);
          if (!localItem) {
            await db.items.add(item);
          } else {
            // Keep local images if remote is empty and local has images
            const mergedImages = (localItem.images && localItem.images.length > 0 && (!item.images || item.images.length === 0))
              ? localItem.images
              : item.images;

            await db.items.put({
              ...item,
              images: mergedImages
            });
          }
        }
      } else {
        await db.collections.clear();
        await db.items.clear();
        await db.collections.bulkAdd(parsed.collections);
        await db.items.bulkAdd(parsed.items);
      }
    }

    return parsed;
  }
};
