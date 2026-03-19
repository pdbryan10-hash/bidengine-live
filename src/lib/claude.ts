import Anthropic from '@anthropic-ai/sdk';

// Initialize Anthropic client
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Tier-based rate limits
const TIER_LIMITS = {
  1: { rpm: 50, itpm: 40000 },
  2: { rpm: 1000, itpm: 80000 },
  3: { rpm: 2000, itpm: 160000 },
  4: { rpm: 4000, itpm: 2000000 },
};

// Get current tier from env (default to 1 for safety)
const CURRENT_TIER = (parseInt(process.env.ANTHROPIC_TIER || '1') as 1 | 2 | 3 | 4);
const LIMITS = TIER_LIMITS[CURRENT_TIER];

// Track requests in memory (simple approach for serverless)
let requestTimestamps: number[] = [];
let tokenCounts: number[] = [];

// Clean old entries (older than 1 minute)
function cleanOldEntries() {
  const oneMinuteAgo = Date.now() - 60000;
  const validIndices = requestTimestamps
    .map((t, i) => t > oneMinuteAgo ? i : -1)
    .filter(i => i >= 0);
  
  requestTimestamps = validIndices.map(i => requestTimestamps[i]);
  tokenCounts = validIndices.map(i => tokenCounts[i]);
}

// Estimate tokens from text (rough: 1 token ≈ 4 chars)
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Pre-request rate limit check
async function checkRateLimits(estimatedInputTokens: number): Promise<void> {
  cleanOldEntries();
  
  // Check RPM (use 85% threshold to be safe)
  const rpmThreshold = LIMITS.rpm * 0.85;
  if (requestTimestamps.length >= rpmThreshold) {
    const oldestRequest = requestTimestamps[0];
    const waitTime = 60000 - (Date.now() - oldestRequest) + 500;
    if (waitTime > 0) {
      console.log(`[Rate Limit] RPM threshold reached (${requestTimestamps.length}/${LIMITS.rpm}), waiting ${waitTime}ms`);
      await new Promise(r => setTimeout(r, waitTime));
      cleanOldEntries();
    }
  }
  
  // Check ITPM (use 85% threshold)
  const totalTokens = tokenCounts.reduce((a, b) => a + b, 0);
  const itpmThreshold = LIMITS.itpm * 0.85;
  if (totalTokens + estimatedInputTokens > itpmThreshold) {
    const oldestRequest = requestTimestamps[0];
    if (oldestRequest) {
      const waitTime = 60000 - (Date.now() - oldestRequest) + 500;
      if (waitTime > 0) {
        console.log(`[Rate Limit] ITPM threshold reached (${totalTokens}/${LIMITS.itpm}), waiting ${waitTime}ms`);
        await new Promise(r => setTimeout(r, waitTime));
        cleanOldEntries();
      }
    }
  }
}

// Record a completed request
function recordRequest(inputTokens: number) {
  requestTimestamps.push(Date.now());
  tokenCounts.push(inputTokens);
}

// Enhanced retry with rate limiting and retry-after header support
export async function callClaude(
  messages: Anthropic.MessageParam[],
  options: {
    maxTokens?: number;
    model?: string;
    maxRetries?: number;
    estimatedInputTokens?: number;
    temperature?: number;
  } = {}
): Promise<Anthropic.Message> {
  const {
    maxTokens = 4000,
    model = 'claude-sonnet-4-20250514',
    maxRetries = 5,
    estimatedInputTokens,
    temperature = 0.7,
  } = options;

  // Estimate input tokens if not provided
  const inputTokenEstimate = estimatedInputTokens || 
    estimateTokens(messages.map(m => typeof m.content === 'string' ? m.content : '').join(''));

  // Check rate limits before making request
  await checkRateLimits(inputTokenEstimate);

  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model,
        max_tokens: maxTokens,
        messages,
        temperature,
      });

      // Record successful request
      recordRequest(response.usage?.input_tokens || inputTokenEstimate);
      
      return response;
      
    } catch (err: any) {
      lastError = err;
      const status = err?.status || err?.error?.status;
      const errorType = err?.error?.type;
      
      // 429 Rate Limit Error
      if (status === 429) {
        // Try to get retry-after header
        const retryAfter = err?.headers?.['retry-after'] || 
                          err?.response?.headers?.['retry-after'];
        
        let delay: number;
        if (retryAfter) {
          delay = parseInt(retryAfter) * 1000;
          console.log(`[429] Rate limit hit, retry-after header says wait ${delay}ms`);
        } else {
          // Exponential backoff with jitter
          delay = Math.min(1000 * Math.pow(2, attempt), 60000);
          delay += Math.random() * delay * 0.2; // 20% jitter
          console.log(`[429] Rate limit hit, exponential backoff: ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxRetries})`);
        }
        
        if (attempt < maxRetries - 1) {
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
      }
      
      // 529 Overloaded Error (server-side, not our fault)
      if (status === 529 || errorType === 'overloaded_error') {
        const delay = Math.min(2000 * Math.pow(1.5, attempt), 30000);
        console.log(`[529] Server overloaded, waiting ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxRetries})`);
        
        if (attempt < maxRetries - 1) {
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
      }
      
      // Other errors - don't retry
      if (status !== 429 && status !== 529) {
        throw err;
      }
    }
  }
  
  throw lastError || new Error('Max retries exceeded for Claude API call');
}

// Helper for common use case: single user message
export async function askClaude(
  prompt: string,
  options: {
    maxTokens?: number;
    model?: string;
  } = {}
): Promise<string> {
  const response = await callClaude(
    [{ role: 'user', content: prompt }],
    {
      ...options,
      estimatedInputTokens: estimateTokens(prompt),
    }
  );
  
  const content = response.content[0];
  return content.type === 'text' ? content.text : '';
}

// Delay helper for use between batch operations
export async function rateLimitDelay(): Promise<void> {
  // Delay based on tier - reduced since we're batching
  const delays = {
    1: 1500,  // Tier 1: 1.5 seconds between batches
    2: 200,   // Tier 2: 200ms (plenty of headroom at 1000 RPM)
    3: 100,   // Tier 3: 100ms
    4: 50,    // Tier 4: 50ms
  };
  
  const delay = delays[CURRENT_TIER];
  if (delay > 0) {
    await new Promise(r => setTimeout(r, delay));
  }
}

// Log current rate limit status
export function logRateLimitStatus(): void {
  cleanOldEntries();
  const totalTokens = tokenCounts.reduce((a, b) => a + b, 0);
  console.log(`[Rate Limit Status] Tier ${CURRENT_TIER}: ${requestTimestamps.length}/${LIMITS.rpm} RPM, ${totalTokens}/${LIMITS.itpm} ITPM`);
}
