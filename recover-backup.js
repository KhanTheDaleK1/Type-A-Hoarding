const https = require('https');
const fs = require('fs');

const token = process.argv[2];
const owner = process.argv[3];
const repo = process.argv[4];
const filePath = process.argv[5] || 'hoard_backup.json';

if (!token || !owner || !repo) {
  console.log('\nUsage: node recover-backup.js <github-token> <owner> <repo> [file-path]');
  console.log('Example: node recover-backup.js ghp_xxx KhanTheDaleK1 hoard-data hoard_backup.json\n');
  process.exit(1);
}

function githubRequest(urlPath) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: urlPath,
      method: 'GET',
      headers: {
        'User-Agent': 'Type-A-Hoarding-Recovery',
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`GitHub API returned status ${res.statusCode}: ${data}`));
        } else {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Failed to parse JSON response: ${e.message}`));
          }
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.end();
  });
}

async function main() {
  try {
    console.log(`\n[Recovery] Fetching commit history for file '${filePath}' in ${owner}/${repo}...`);
    const commitsUrl = `/repos/${owner}/${repo}/commits?path=${encodeURIComponent(filePath)}`;
    const commits = await githubRequest(commitsUrl);

    console.log(`Found ${commits.length} commits affecting '${filePath}'. Scanning from newest to oldest...\n`);

    for (let i = 0; i < commits.length; i++) {
      const commit = commits[i];
      const sha = commit.sha;
      const date = commit.commit.author.date;
      const message = commit.commit.message;

      console.log(`Scanning Commit ${i + 1}/${commits.length}:`);
      console.log(`  SHA:     ${sha}`);
      console.log(`  Date:    ${date}`);
      console.log(`  Message: ${message}`);

      try {
        const contentUrl = `/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}?ref=${sha}`;
        const fileData = await githubRequest(contentUrl);
        
        if (!fileData.content) {
          console.log(`  -> No content returned for this commit.\n`);
          continue;
        }

        // Decode Base64 content
        const buffer = Buffer.from(fileData.content, 'base64');
        const jsonContent = JSON.parse(buffer.toString('utf8'));

        const collectionsCount = jsonContent.collections ? jsonContent.collections.length : 0;
        const itemsCount = jsonContent.items ? jsonContent.items.length : 0;
        const itemsWithImages = jsonContent.items 
          ? jsonContent.items.filter(item => item.images && item.images.length > 0)
          : [];

        console.log(`  -> Collections: ${collectionsCount}`);
        console.log(`  -> Items: ${itemsCount}`);
        console.log(`  -> Items with Photos: ${itemsWithImages.length}`);

        if (itemsWithImages.length > 0) {
          const outName = `recovered_backup_${sha.substring(0, 7)}.json`;
          fs.writeFileSync(outName, JSON.stringify(jsonContent, null, 2), 'utf8');
          console.log(`\n======================================================`);
          console.log(`SUCCESS! Found photos in this commit!`);
          console.log(`Saved recovered data to: ${outName}`);
          console.log(`You can now import this file in the settings page of the app.`);
          console.log(`======================================================\n`);
          return;
        } else {
          console.log(`  -> No photos found in this version.\n`);
        }
      } catch (err) {
        console.log(`  -> Error scanning this commit: ${err.message}\n`);
      }
    }

    console.log('Scan completed. Unfortunately, no versions of the file on GitHub were found to contain photos.');
    console.log('This might mean that photos were never successfully pushed to GitHub, or the "Exclude Images" setting was enabled from the very beginning of the sync setup.');
  } catch (err) {
    console.error(`\nRecovery failed: ${err.message}\n`);
  }
}

main();
