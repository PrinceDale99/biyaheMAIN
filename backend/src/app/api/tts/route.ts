import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { text } = await request.json();
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      throw new Error('No API key configured');
    }

    const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: 'en-US', name: 'en-US-Journey-F' }, // Using a premium Journey voice if available
        audioConfig: { audioEncoding: 'MP3' },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'TTS API request failed');
    }

    const data = await response.json();
    return NextResponse.json({ audioContent: data.audioContent });
  } catch (error: any) {
    console.error('[API_TTS] Error:', error.message || error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
