/**
 * User Reputation Scoring System
 * Part of the Infrastructure Layer (~15% of codebase).
 *
 * Points are drawn from the system treasury (system/treasury) via an atomic
 * Firestore transaction. If the treasury is empty, no points are awarded.
 */

import { AIAnalyzer } from './ai-analyzer';
import { db } from './firebase';
import { doc, getDoc, runTransaction } from 'firebase/firestore';

const TREASURY_REF = () => doc(db, 'system', 'treasury');
const POINTS_PER_CONTRIBUTION = 10;

interface ContributionData {
  lat: number;
  lon: number;
  speed: number;
  timestamp: number;
  userId?: string;
  metadata?: Record<string, any>;
}

export class ReputationEngine {
  /**
   * Updates user reputation based on a new data contribution.
   * Points are drawn from the system treasury via an atomic transaction.
   * If the treasury balance is insufficient, no points are awarded.
   */
  static async updateScore(
    userId: string,
    isAccurate: boolean
  ): Promise<{ newScore: number; pointsEarned: number; treasuryEmpty?: boolean }> {
    const userRef = doc(db, 'users', userId);

    try {
      return await runTransaction(db, async (transaction) => {
        // --- Read Phase (must come before all writes in a transaction) ---
        const userSnap = await transaction.get(userRef);
        const treasurySnap = await transaction.get(TREASURY_REF());

        // Calculate new reputation score
        const currentScore = userSnap.exists()
          ? (userSnap.data().reputation ?? 75.0)
          : 75.0;
        const delta = isAccurate ? 1.5 : -5.0;
        const newScore = Math.max(0, Math.min(100, currentScore + delta));

        const userData = userSnap.data() || {};
        let pointsEarned = 0;
        let treasuryEmpty = false;

        // Award points only if: contribution is accurate AND trust score >= 75
        if (isAccurate && newScore >= 75) {
          const treasuryBalance = treasurySnap.exists()
            ? (treasurySnap.data().balance ?? 0)
            : 0;

          if (treasuryBalance >= POINTS_PER_CONTRIBUTION) {
            pointsEarned = POINTS_PER_CONTRIBUTION;

            // Atomically deduct from treasury
            transaction.set(
              TREASURY_REF(),
              {
                balance: treasuryBalance - POINTS_PER_CONTRIBUTION,
                totalDistributed:
                  (treasurySnap.data()?.totalDistributed ?? 0) +
                  POINTS_PER_CONTRIBUTION,
                lastDistributedAt: Date.now(),
              },
              { merge: true }
            );
          } else {
            // Treasury exhausted — no reward, but still update reputation
            treasuryEmpty = true;
            console.warn(
              `[TREASURY] Insufficient funds (balance: ${treasuryBalance}). Skipping reward for user ${userId}.`
            );
          }
        }

        // Always update the user's reputation score
        transaction.set(
          userRef,
          {
            reputation: newScore,
            points: (userData.points ?? 0) + pointsEarned,
            lastUpdate: Date.now(),
            totalClaimed: userData.totalClaimed ?? 0,
          },
          { merge: true }
        );

        return { newScore, pointsEarned, treasuryEmpty };
      });
    } catch (error) {
      console.error('[REPUTATION] Transaction failed:', error);
      return { newScore: 75.0, pointsEarned: 0 };
    }
  }

  /**
   * Retrieves current user reputation.
   */
  static async getScore(userId: string): Promise<number> {
    try {
      const userSnap = await getDoc(userRef(userId));
      return userSnap.exists() ? (userSnap.data().reputation ?? 75.0) : 75.0;
    } catch {
      return 75.0;
    }
  }

  /**
   * AI Pre-screening logic for crowdsourced data.
   * Identifies outliers and potential spoofing attempts.
   */
  static async screenData(data: ContributionData): Promise<boolean> {
    const { lat, lon, speed } = data;

    // Layer 1: Basic anomaly detection
    if (speed > 120) return false;
    if (lat < 14.3 || lat > 14.8 || lon < 120.8 || lon > 121.2) return false;

    // Layer 2: AI-driven verification
    const aiVerification = await AIAnalyzer.verifyRoute(data);
    if (!aiVerification.isValid) {
      console.warn(`[REPUTATION] AI Anomaly Detected: ${aiVerification.reason}`);
      return false;
    }

    return true;
  }
}

// Helper to avoid repetition
function userRef(userId: string) {
  return doc(db, 'users', userId);
}
