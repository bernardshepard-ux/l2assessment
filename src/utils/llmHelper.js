import Groq from 'groq-sdk';
import {
  processCustomerMessage,
  intentToCategory,
  buildIntentReasoning,
} from './intentProcessor';

/**
 * LLM Helper for categorizing customer support messages
 * Using Groq API for AI-powered categorization
 */

const GROQ_SYSTEM_PROMPT = `You are a customer support triage assistant. Given a customer message, classify it.

Respond with ONLY valid JSON, no other text, matching exactly this schema:
{
  "category": "Technical" | "Billing" | "Feature Request" | "Feedback" | "General" | "Security",
  "urgency": "Low" | "Medium" | "High",
  "confidence": "low" | "medium" | "high",
  "reasoning": "<one sentence explaining the urgency judgment>"
}

Judge urgency based on the real-world impact described in the message —
for example, a service outage, data loss, or inability to complete a
critical task is High regardless of how briefly it's phrased. Polite,
enthusiastic, or lengthy messages expressing thanks or general feedback
are Low regardless of punctuation or message length. If the message is
too short or vague to judge (e.g. a greeting with no actual request),
set confidence to "low" and urgency to "Low".`;

const VALID_CATEGORIES = new Set([
  'Technical',
  'Billing',
  'Feature Request',
  'Feedback',
  'General',
  'Security',
]);
const VALID_URGENCY = new Set(['Low', 'Medium', 'High']);
const VALID_LLM_CONFIDENCE = new Set(['low', 'medium', 'high']);

// Initialize Groq client
const groq = new Groq({
  apiKey: import.meta.env.VITE_GROQ_API_KEY,
  dangerouslyAllowBrowser: true // Required for browser-based calls (not recommended for production!)
});

function parseGroqTriageResponse(content) {
  let trimmed = content.trim();

  if (trimmed.startsWith('```')) {
    trimmed = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }

  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error('Groq response was not valid JSON');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Groq response JSON was not an object');
  }

  if (!VALID_CATEGORIES.has(parsed.category)) {
    throw new Error(`Invalid or missing category: ${parsed.category}`);
  }

  if (!VALID_URGENCY.has(parsed.urgency)) {
    throw new Error(`Invalid or missing urgency: ${parsed.urgency}`);
  }

  if (!VALID_LLM_CONFIDENCE.has(parsed.confidence)) {
    throw new Error(`Invalid or missing confidence: ${parsed.confidence}`);
  }

  if (typeof parsed.reasoning !== 'string' || !parsed.reasoning.trim()) {
    throw new Error('Invalid or missing reasoning');
  }

  return parsed;
}

/**
 * Categorize a customer support message using Groq AI
 *
 * @param {string} message - The customer support message
 * @returns {Promise<object>}
 */
export async function categorizeMessage(message) {
  const intentResult = processCustomerMessage(message);

  if (intentResult.errorText) {
    return {
      category: 'Unknown',
      reasoning: intentResult.errorText,
      intent: intentResult.intent,
      confidence: intentResult.confidence,
      matchedTokens: intentResult.matchedTokens,
      classificationSource: 'intentProcessor',
    };
  }

  if (intentResult.confidence >= 0.5) {
    return {
      category: intentToCategory(intentResult.intent),
      reasoning: buildIntentReasoning(intentResult),
      intent: intentResult.intent,
      confidence: intentResult.confidence,
      matchedTokens: intentResult.matchedTokens,
      classificationSource: 'intentProcessor',
    };
  }

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: GROQ_SYSTEM_PROMPT },
      { role: 'user', content: message },
    ],
    temperature: 0.1,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Groq response did not include message content');
  }

  const parsed = parseGroqTriageResponse(content);

  return {
    category: parsed.category,
    urgency: parsed.urgency,
    reasoning: parsed.reasoning,
    llmConfidence: parsed.confidence,
    intent: intentResult.intent,
    confidence: intentResult.confidence,
    matchedTokens: intentResult.matchedTokens,
    classificationSource: 'llm',
  };
}
