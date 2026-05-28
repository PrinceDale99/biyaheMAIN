import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: Request) {
  try {
    const data = await request.json();

    const model = genAI.getGenerativeModel({
      model: 'gemini-3.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            isValid: { type: SchemaType.BOOLEAN },
            confidence: { type: SchemaType.NUMBER },
            reason: { type: SchemaType.STRING },
          },
          required: ['isValid', 'confidence', 'reason'],
        },
      },
    });

    const prompt = `
      You are the core verification AI for Biyahe.
      Your objective is to identify data spoofing or unrealistic traffic reports.
      
      Analyze the provided GPS data (lat, lon, speed, timestamp) and metadata.
      Check for:
      1. Physical impossibility (e.g., jumping large distances in short time).
      2. Speed anomalies (e.g., 200km/h in a city zone).
      3. Geofencing (Coordinates must be within the Greater Manila Area).
      
      Traffic Data Payload: ${JSON.stringify(data)}
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const content = response.text();
    
    const verification = JSON.parse(content);
    
    return NextResponse.json({
      isValid: verification.isValid && verification.confidence >= 0.8,
      confidence: verification.confidence,
      reason: verification.reason
    });

  } catch (error: any) {
    console.error('[API_VERIFY] Error:', error.message || error);
    return NextResponse.json({
      isValid: true, // Fail-open
      confidence: 0.5,
      reason: `Server-side verification error: ${error.message}`
    }, { status: 200 });
  }
}
