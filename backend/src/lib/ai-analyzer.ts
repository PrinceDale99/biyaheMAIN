export interface AIVerificationResult {
  isValid: boolean;
  confidence: number;
  reason: string;
}

/**
 * AI-driven verification layer for B.I.Y.A.H.E.
 * Client-safe wrapper that calls the server-side API route.
 */
export class AIAnalyzer {
  static async verifyRoute(data: any): Promise<AIVerificationResult> {
    try {
      // Call the internal API route instead of calling OpenAI directly from the browser
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('[AI_ANALYZER] Client Verification Error:', error.message || error);
      
      // Fail-safe: if API is down, we allow the data but mark it for manual review
      return {
        isValid: true, 
        confidence: 0.5,
        reason: `AI service unreachable: ${error.message || 'Unknown error'} - falling back to baseline heuristics`
      };
    }
  }

  static async analyzeOptimalRoute(routes: any[], destination: string, preferences: string): Promise<string> {
    try {
      const response = await fetch('/api/analyze-route', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ routes, destination, preferences }),
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();
      return data.recommendation;
    } catch (error: any) {
      console.error('[AI_ANALYZER] Route Analysis Error:', error.message || error);
      return "AI analysis currently unavailable. Based on system metrics, the fastest route is recommended.";
    }
  }
}
