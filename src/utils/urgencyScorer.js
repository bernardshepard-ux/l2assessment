/**
 * Urgency Scorer - Rule-based urgency calculation
 *
 * Rewritten to score based on message CONTENT (what's actually being
 * described) rather than surface features. This is the fallback scorer
 * used when the intentProcessor path is taken (no Groq call made).
 * When Groq IS called, prefer the urgency it returns directly — this
 * function is for the no-LLM path only.
 *
 * Signature unchanged: calculateUrgency(message) -> "High"|"Medium"|"Low"
 */

// Phrases that indicate real operational/customer impact, tiered by
// severity. A single CRITICAL match should be enough to reach "High"
// on its own — cumulative matches shouldn't be required for the
// clearest cases (e.g. "Server down now" is High by itself).
const CRITICAL_SIGNALS = [
  /\b(server|site|app|service|database|system)s?\s+(is|are|went|goes)?\s*down\b/i,
  /\bdown\s+(right\s+)?now\b/i,
  /\boutage\b/i,
  /\bdata\s+(loss|lost|breach)\b/i,
  /\bsecurity\s+(breach|incident|vulnerability)\b/i,
  /\bconnection\s+(lost|dropped|failed|refused)\b/i,
  /\b(lost|dropped)\s+connection\b/i,
  /\bdatabase\s+(is\s+)?(down|unreachable|not responding)\b/i,
  /\b(production|prod)\s+(is\s+)?(down|broken|failing)\b/i,
  /\ball\s+(users|customers)\s+(affected|impacted)\b/i,
];

const MODERATE_SIGNALS = [
  /\b(can'?t|cannot|unable to)\s+(access|log ?in|connect)\b/i,
  /\bcrash(ed|ing)?\b/i,
  /\bnot\s+working\b/i,
  /\bcharged?\s+(twice|multiple times|incorrectly)\b/i,
];

const MILD_SIGNALS = [
  /\burgent(ly)?\b/i,
  /\bemergency\b/i,
  /\bimmediately\b/i,
];

// Phrases that indicate low-stakes or non-issue messages (gratitude,
// praise, casual feedback). Each match pulls the score down.
const LOW_URGENCY_SIGNALS = [
  /\bthank(s| you)\b/i,
  /\bappreciat(e|ed)\b/i,
  /\b(great|love|awesome|nice|beautiful|wonderful|excellent)\s+(job|work|design|feature)\b/i,
  /\bjust\s+(wanted to|wondering|curious|browsing)\b/i,
  /\bno\s+rush\b/i,
  /\bwhen(ever)?\s+you\s+(get|have)\s+(a\s+)?(chance|time)\b/i,
  /\bpositive\s+feedback\b/i,
  /\bfeature\s+request\b/i,
];

const MIN_MEANINGFUL_WORDS = 4;
const STOPWORDS = new Set(['a', 'an', 'the', 'is', 'are', 'i', 'you', 'to', 'and', 'of', 'in', 'it']);

function countMeaningfulWords(message) {
  return message
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 0 && !STOPWORDS.has(w)).length;
}

export function calculateUrgency(message) {
  if (!message || typeof message !== 'string') return 'Low';

  // Baseline assumes Low urgency unless content signals otherwise.
  // (Previously this started at 50, which put every neutral,
  // no-signal message into "Medium" by default — e.g. an FAQ question
  // with zero urgency indicators. Signals now have to earn their way
  // up from a low baseline rather than down from a middling one.)
  let urgencyScore = 20;
  let matchedHigh = 0;
  let matchedLow = 0;

  CRITICAL_SIGNALS.forEach((pattern) => {
    if (pattern.test(message)) {
      urgencyScore += 65; // a single critical match reaches High on its own
      matchedHigh += 1;
    }
  });

  MODERATE_SIGNALS.forEach((pattern) => {
    if (pattern.test(message)) {
      urgencyScore += 30;
      matchedHigh += 1;
    }
  });

  MILD_SIGNALS.forEach((pattern) => {
    if (pattern.test(message)) {
      urgencyScore += 15;
      matchedHigh += 1;
    }
  });

  LOW_URGENCY_SIGNALS.forEach((pattern) => {
    if (pattern.test(message)) {
      urgencyScore -= 15;
      matchedLow += 1;
    }
  });

  // If the message is short AND matched no signals either way, there's
  // genuinely not enough content to judge. Default to "Low" rather than
  // a false-confidence Medium/High (the return type here stays a plain
  // string to preserve the existing signature; if you want to
  // distinguish "no signal" from "confidently low" in the UI later,
  // that's a good follow-up but requires changing the return type).
  if (matchedHigh === 0 && matchedLow === 0 && countMeaningfulWords(message) < MIN_MEANINGFUL_WORDS) {
    return 'Low';
  }

  if (urgencyScore > 80) return 'High';
  if (urgencyScore < 30) return 'Low';
  return 'Medium';
}
