const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI('AIzaSyCuZ6NLOE7wo6Kopyqed7HZv6Uo6fFVnTI');

async function test() {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    console.log('Testing with Firebase API Key...');
    const result = await model.generateContent('Say hello');
    console.log('Response:', result.response.text());
  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();
