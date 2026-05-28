const dotenv = require('dotenv');
dotenv.config({ path: 'backend/.env.local' });
dotenv.config({ path: 'backend/.env' });

const API_KEY = process.env.GEMINI_API_KEY;

async function testFetch() {
  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
  
  try {
    console.log('Testing direct fetch to gemini-1.5-flash...');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Say hello' }] }]
      })
    });
    
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Fetch error:', error.message);
  }
}

testFetch();
