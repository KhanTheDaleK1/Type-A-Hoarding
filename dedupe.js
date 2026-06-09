const fs = require('fs');

try {
  const data = JSON.parse(fs.readFileSync('Beechem Family Data', 'utf8'));
  const cleaned = { collections: [], items: [] };

  // De-duplicate Collections
  const seenCollections = new Set();
  data.collections.forEach(c => {
    const key = \`\${c.name.trim().toLowerCase()}|\${c.type}\`;
    if (!seenCollections.has(key)) {
      seenCollections.add(key);
      cleaned.collections.push(c);
    }
  });

  // De-duplicate Items
  const seenItems = new Set();
  data.items.forEach(i => {
    const author = (i.customData.author || '').trim().toLowerCase();
    const isbn = (i.customData.isbn || '').replace(/[^0-9]/g, '');
    const title = (i.title || '').trim().toLowerCase();
    
    // Key by ISBN if available, otherwise Title + Author
    const key = isbn ? \`isbn:\${isbn}\` : \`title:\${title}|author:\${author}\`;
    
    if (!seenItems.has(key)) {
      seenItems.add(key);
      cleaned.items.push(i);
    }
  });

  fs.writeFileSync('Beechem Family Data', JSON.stringify(cleaned, null, 2));
  console.log(\`Success: Removed \${data.collections.length - cleaned.collections.length} collections and \${data.items.length - cleaned.items.length} items.\`);
} catch (e) {
  console.error('Error:', e.message);
  process.exit(1);
}
