import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { StellarRewards } from '@/lib/stellar';

export async function POST(request: Request) {
  try {
    const { userId, stellarAddress } = await request.json();

    if (!userId || !stellarAddress) {
      return NextResponse.json({ error: 'Missing userId or stellarAddress' }, { status: 400 });
    }

    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userSnap.data();
    const reputation = userData.reputation || 0;
    const points = userData.points || 0;
    const totalClaimed = userData.totalClaimed || 0;

    // Requirement: Must have at least 75% Trust Score (Reputation) to start earning/claiming
    if (reputation < 75) {
      return NextResponse.json({
        error: `Insufficient Trust Score (${reputation.toFixed(1)}%). You need at least 75% trust to claim rewards.`
      }, { status: 403 });
    }

    const claimablePoints = Math.max(0, points - totalClaimed);

    if (claimablePoints <= 0) {
      return NextResponse.json({ error: 'No rewards available to claim' }, { status: 400 });
    }

    const rewardAmount = Math.floor(claimablePoints * 10);

    const stellarResult = await StellarRewards.rewardContributor(stellarAddress, rewardAmount);

    await updateDoc(userRef, {
      totalClaimed: increment(claimablePoints),
      stellarAddress: stellarAddress,
      lastClaimHash: stellarResult.hash,
      lastClaimDate: Date.now()
    });

    return NextResponse.json({
      success: true,
      amount: rewardAmount,
      txHash: stellarResult.hash,
      message: `Successfully claimed ${rewardAmount} $BIYAHE tokens.`
    });

  } catch (error: any) {
    console.error('[API_REWARDS_CLAIM] Error:', error);
    return NextResponse.json({
      error: error.message || 'Failed to claim rewards'
    }, { status: 500 });
  }
}
