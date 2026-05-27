import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.G4F_API_KEY || 'dummy_key',
  baseURL: process.env.G4F_BASE_URL || 'https://api.g4f.icu/v1',
});

export async function POST(request: Request) {
  try {
    const data = await request.json();

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are the core verification AI for Biyahe.
          Your objective is to identify data spoofing or unrealistic traffic reports.
          
          Analyze the provided GPS data (lat, lon, speed, timestamp) and metadata.
          Check for:
          1. Physical impossibility (e.g., jumping large distances in short time).
          2. Speed anomalies (e.g., 200km/h in a city zone).
          3. Geofencing (Coordinates must be within the Greater Manila Area).
          
          Respond STRICTLY in JSON format:
          {
            "isValid": boolean,
            "confidence": number (0.0 to 1.0),
            "reason": "short explanation"
          }`
        },
        {
          role: 'user',
          content: `Traffic Data Payload: ${JSON.stringify(data)}`
        }
      ],
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('Empty AI response');
    }

    const result = JSON.parse(content);
    
    return NextResponse.json({
      isValid: result.isValid && result.confidence >= 0.8,
      confidence: result.confidence,
      reason: result.reason
    });

  } catch (error: any) {
    console.error('[API_VERIFY] Error:', error.message || error);
    return NextResponse.json({
      isValid: true, // Fail-open
      confidence: 0.5,
      reason: `Server-side verification error: ${error.message}`
    }, { status: 200 }); // Still return 200 to avoid breaking client logic
  }
}
