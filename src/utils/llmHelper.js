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

// Initialize Groq client
const groq = new Groq({
  apiKey: import.meta.env.VITE_GROQ_API_KEY,
  dangerouslyAllowBrowser: true // Required for browser-based calls (not recommended for production!)
});

/**
 * Categorize a customer support message using Groq AI
 * 
 * @param {string} message - The customer support message
 * @returns {Promise<{category: string, reasoning: string}>}
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
    };
  }

  if (intentResult.confidence >= 0.5) {
    return {
      category: intentToCategory(intentResult.intent),
      reasoning: buildIntentReasoning(intentResult),
      intent: intentResult.intent,
      confidence: intentResult.confidence,
      matchedTokens: intentResult.matchedTokens,
    };
  }

  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "user",
          content: `Categorize this customer support message: ${message}`
        }
      ],
      temperature: 0.7,
    });

    const content = response.choices[0].message.content;
    
    const lines = content.split('\n');
    let category = "Unknown";
    let reasoning = content;
    
    if (content.toLowerCase().includes('billing')) {
      category = "Billing Issue";
    } else if (content.toLowerCase().includes('technical') || content.toLowerCase().includes('bug')) {
      category = "Technical Problem";
    } else if (content.toLowerCase().includes('feature')) {
      category = "Feature Request";
    } else if (content.toLowerCase().includes('inquiry') || content.toLowerCase().includes('question')) {
      category = "General Inquiry";
    }
    
    return {
      category,
      reasoning: content,
      intent: intentResult.intent,
      confidence: intentResult.confidence,
      matchedTokens: intentResult.matchedTokens,
    };
  } catch (error) {
    console.warn('Groq API failed, using intent processor:', error.message);
    return getIntentCategorization(intentResult);
  }
}

function getIntentCategorization(intentResult) {
  return {
    category: intentToCategory(intentResult.intent),
    reasoning: buildIntentReasoning(intentResult),
    intent: intentResult.intent,
    confidence: intentResult.confidence,
    matchedTokens: intentResult.matchedTokens,
  };
}
