const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: 'backend/.env.local' });
require('dotenv').config({ path: 'backend/.env' });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_MAPS_API_KEY || 'MISSING');

async function test() {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
    
    console.log('Starting chat with correct history...');
    const chat = model.startChat({
      history: [],
    });

    const result = await chat.sendMessage('Hello! I am your Biyahe assistant. How can I help you with your commute today?\n\nHi');
    console.log('Response:', result.response.text());
  } catch (error) {
    console.error('Error caught as expected or unexpected:', error.message);
  }
}

test();
