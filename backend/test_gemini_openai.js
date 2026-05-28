const OpenAI = require('openai');
require('dotenv').config({ path: 'backend/.env.local' });
require('dotenv').config({ path: 'backend/.env' });

const openai = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: 'https://generativelanguage.googleapis.com/v1beta/',
});

async function testOpenAI() {
  try {
    console.log('Testing Gemini via OpenAI SDK...');
    const response = await openai.chat.completions.create({
      model: 'gemini-1.5-flash',
      messages: [{ role: 'user', content: 'Say hello' }],
    });
    console.log('Response:', response.choices[0].message.content);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testOpenAI();
