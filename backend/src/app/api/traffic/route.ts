import { NextResponse } from 'next/server';
import { ReputationEngine } from '@/lib/reputation';

/**
 * Traffic Data Ingestion Endpoint
 */
export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    // AI Pre-screening logic for data anomalies
    const isValid = await ReputationEngine.screenData(data);
    if (!isValid) {
      return NextResponse.json({ error: 'Data anomaly detected' }, { status: 400 });
    }

    // Process user reputation scoring
    const { newScore, pointsEarned } = await ReputationEngine.updateScore(data.userId, true);

    return NextResponse.json({ 
      status: 'success', 
      pointsEarned: pointsEarned,
      reputationScore: newScore,
      message: pointsEarned > 0 ? 'Contribution accepted. Points awarded.' : 'Contribution accepted. Trust score too low for rewards.'
    });
  } catch (_error) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}
