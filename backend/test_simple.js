const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: 'backend/.env.local' });
require('dotenv').config({ path: 'backend/.env' });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'MISSING');

async function test() {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-8b' });
    console.log('Testing gemini-1.5-flash with simple prompt...');
    const result = await model.generateContent('Say hello');
    console.log('Response:', result.response.text());
  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();
