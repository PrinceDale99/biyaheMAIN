import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: Request) {
  try {
    const { routes, destination, preferences } = await request.json();

    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

    const prompt = `
      You are a high-precision tactical transit navigator for Metro Manila. 
      Analyze the following detailed route options to ${destination} and provide an ADVANCED, SPECIFIC tactical briefing for the absolute best one based on user preference: ${preferences}.
      
      Route Data (including step-by-step instructions):
      ${JSON.stringify(routes, null, 2)}

      Your briefing must be highly specific and include:
      1. SAFETY FIRST: Prioritize routes using pedestrian infrastructure (footbridges, overpasses, pedestrian lanes). EXPLICITLY warn the user NOT to walk on the road if a safe structure is nearby.
      2. EXACT MANEUVERS: Use precise tactical language (e.g., "In 150m, take the footbridge," "Head North for 200m using the sidewalk then cross via the overpass").
      3. TRANSIT SPECIFICS: Detail exactly which train/bus to board, which platform/entrance to use, and where to alight.
      4. METRO MANILA CONTEXT: Factor in real-world local conditions like "Avoid the crowded MRT-3 Northbound stairs," or "Use the footbridge to cross EDSA safely."
      5. TACTICAL ADVANTAGE: Explain how this route maximizes pedestrian safety while maintaining efficiency.

      If a route requires walking, always direct the user to the nearest PEDESTRIAN LANE or FOOTBRIDGE. Only allow walking on the side of the road if NO pedestrian infrastructure exists.
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
