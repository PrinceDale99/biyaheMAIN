import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: Request) {
  try {
    const { routes, destination, preferences } = await request.json();

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `
      You are an expert urban transit analyst for Metro Manila. 
      Analyze the following route options to ${destination} and recommend the absolute best one based on user preferences: ${preferences}.
      
      Route Options:
      ${JSON.stringify(routes, null, 2)}

      Consider factors like:
      - Total travel time and reliability.
      - Number of transfers (fewer is usually better).
      - Cost efficiency.
      - Pedestrian infrastructure (use of footbridges/overpasses is safer).
      - Local Metro Manila context (jeepney availability, train congestion).

      Provide a concise, tactical recommendation in 2-3 sentences. Explain WHY this route is better than the others.
      Keep the tone professional and helpful.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ recommendation: text });
  } catch (error: any) {
    console.error('[API_ANALYZE_ROUTE] Error:', error.message || error);
    return NextResponse.json({ 
      error: 'Failed to analyze routes', 
      message: error.message 
    }, { status: 500 });
  }
}
