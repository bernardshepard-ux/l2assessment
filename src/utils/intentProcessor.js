/**
 * Relay AI Intent Processor Engine - Optimized Release
 * Resolves case-insensitivity, erratic punctuation, and empty boundary crashes.
 */
export const processCustomerMessage = (messageText) => {
  // 1. Area 3 Implementation: Defensive Guard Rails for Null/Empty States
  if (!messageText || typeof messageText !== 'string' || !messageText.trim()) {
    return {
      intent: 'unknown',
      confidence: 0.0,
      matchedTokens: [],
      errorText: 'Please enter a valid message.'
    };
  }

  // Sanitize the input string: trim whitespaces and isolate basic string value
  const sanitizedInput = messageText.trim();

  // 2. Definitive Business Rule Intent Dictionary (Expandable)
  const intentRules = [
    {
      intent: 'billing_dispute',
      keywords: ['charge', 'billing', 'refund', 'double-billed', 'amex', 'card', 'price'],
      priority: 1 // High financial priority flag
    },
    {
      intent: 'cancellation',
      keywords: ['cancel', 'deactivate', 'terminate', 'close account', 'stop subscription'],
      priority: 2
    },
    {
      intent: 'shipping_logistics',
      keywords: ['tracking', 'shipping', 'package', 'delivery', 'arrived', 'order'],
      priority: 3
    }
  ];

  let bestMatch = { intent: 'general_inquiry', confidence: 0.0, matchedTokens: [] };
  let highestScore = 0;

  // 3. Area 1 Implementation: Context-Aware Regular Expression Matching Loop
  intentRules.forEach((rule) => {
    let matchesFound = [];

    rule.keywords.forEach((keyword) => {
      // Escape special characters to guarantee safe regex compilation paths
      const escapedKeyword = keyword.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      
      // Match boundaries (\b) safely across punctuation markers, case-insensitively
      const pattern = new RegExp(`\\b${escapedKeyword}(?:s|es|'s)?\\b`, 'gi');
      const matches = sanitizedInput.match(pattern);

      if (matches) {
        matchesFound.push(...matches);
      }
    });

    // Score calculations: Weight the concentration of matched words against context length
    if (matchesFound.length > 0) {
      const keywordDensityScore = matchesFound.length / rule.keywords.length;
      const baseConfidence = Math.min(0.5 + keywordDensityScore, 0.98);

      // Multi-Intent Priority Check: If scores are equal, prioritize crucial operational areas
      if (baseConfidence > highestScore || (baseConfidence === highestScore && rule.priority < (bestMatch.priority || 99))) {
        highestScore = baseConfidence;
        bestMatch = {
          intent: rule.intent,
          confidence: parseFloat(baseConfidence.toFixed(2)),
          matchedTokens: [...new Set(matchesFound.map(m => m.toLowerCase()))],
          priority: rule.priority
        };
      }
    }
  });

  const { priority, ...result } = bestMatch;
  return result;
};

const INTENT_TO_CATEGORY = {
  billing_dispute: 'Billing Issue',
  cancellation: 'Billing Issue',
  shipping_logistics: 'Shipping & Delivery',
  general_inquiry: 'General Inquiry',
  unknown: 'Unknown',
};

export function intentToCategory(intent) {
  return INTENT_TO_CATEGORY[intent] || 'General Inquiry';
}

export function buildIntentReasoning(result) {
  if (result.errorText) {
    return result.errorText;
  }

  if (result.intent === 'general_inquiry' && result.confidence === 0) {
    return 'No specific intent keywords detected. Classified as general inquiry.';
  }

  const label = result.intent.replace(/_/g, ' ');
  const tokens = result.matchedTokens.length > 0
    ? result.matchedTokens.join(', ')
    : 'none';

  return `Detected **${label}** with ${Math.round(result.confidence * 100)}% confidence. Matched keywords: ${tokens}.`;
}
