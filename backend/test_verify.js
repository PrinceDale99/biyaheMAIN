const OpenAI = require('openai');
require('dotenv').config({ path: 'backend/.env' });

const openai = new OpenAI({
  apiKey: process.env.G4F_API_KEY || 'dummy_key',
  baseURL: process.env.G4F_BASE_URL || 'https://api.g4f.icu/v1',
});

async function test() {
  try {
    console.log('Testing G4F Verification AI...');
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Say hello' }],
    });
    console.log('Response:', response.choices[0].message.content);
  } catch (error) {
    console.error('G4F Error:', error.message);
  }
}

test();
