const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: 'backend/.env.local' });
require('dotenv').config({ path: 'backend/.env' });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'MISSING');

async function listModels() {
  try {
    const models = await genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }).listModels();
    // Note: genAI doesn't have a direct listModels, we usually use the model service.
    // However, the error message suggests calling ModelService.ListModels.
    // In the SDK it's actually not directly exposed on genAI.
    console.log('Fetching models...');
    // Let's just try to hit a very common model name
    const model = genAI.getGenerativeModel({ model: 'gemini-1.0-pro' });
    const result = await model.generateContent('Hi');
    console.log('Gemini 1.0 Pro Response:', result.response.text());
  } catch (error) {
    console.error('Error:', error.message);
  }
}

listModels();
