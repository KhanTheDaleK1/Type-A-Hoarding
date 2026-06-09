import { db } from '../db/db';

export interface GitHubSyncConfig {
  token: string;
  owner: string;
  repo: string;
  path: string;
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
    const items = await db.items.toArray();
    const content = JSON.stringify({ collections, items }, null, 2);
    
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
        content: btoa(unescape(encodeURIComponent(content))), // Handle Unicode characters correctly
        sha
      })
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to push to GitHub');
    }

    return res.json();
  },

  async pull() {
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
    const content = decodeURIComponent(escape(atob(data.content)));
    const parsed = JSON.parse(content);

    if (parsed.collections && parsed.items) {
      await db.collections.clear();
      await db.items.clear();
      await db.collections.bulkAdd(parsed.collections);
      await db.items.bulkAdd(parsed.items);
    }

    return parsed;
  }
};
