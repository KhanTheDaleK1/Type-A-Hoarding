process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function test() {
  console.log('Testing search...');
  const searchRes = await fetch('https://localhost:3000/api/search?q=Hotel+California&type=music');
  const searchData = await searchRes.json();
  console.log('Search Results:', JSON.stringify(searchData.results.slice(0, 2), null, 2));

  if (searchData.results.length > 0) {
    const firstId = searchData.results[0].barcode;
    console.log('\nTesting lookup for', firstId);
    const lookupRes = await fetch(`https://localhost:3000/api/lookup/${firstId}`);
    const lookupData = await lookupRes.json();
    console.log('Lookup Result:', JSON.stringify(lookupData, null, 2));
  }
}

test();
