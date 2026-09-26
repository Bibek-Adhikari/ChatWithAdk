/**
 * Shared shape + extractor for model "thinking" (reasoning traces).
 *
 * Reasoning models expose their chain-of-thought under different fields
 * depending on provider:
 *   - Groq gpt-oss / DeepSeek on Groq → message.reasoning_content (string)
 *   - OpenRouter (DeepSeek R1 etc.)  → message.reasoning (string | array)
 *                                      or message.reasoning_details (array)
 * Non-reasoning models omit all of these → thinking stays undefined and
 * nothing changes for them.
 */

export interface ModelResponse {
  text: string;
  thinking?: string;
}

const MAX_THINKING_CHARS = 6000;

function pushText(out: string[], v: unknown) {
  if (typeof v === 'string' && v.trim()) out.push(v.trim());
  else if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (typeof o.text === 'string' && o.text.trim()) out.push(o.text.trim());
    else if (typeof o.summary === 'string' && o.summary.trim()) out.push(o.summary.trim());
  }
}

/**
 * Scrub sentences that merely echo the system prompt back ("the system
 * instructions say we are Tufan…", "mandatory truth override…").
 * The Thought process block itself stays standard — it just never shows
 * prompt scaffolding. Returns undefined only when nothing remains at all.
 */
function sanitizeThinking(raw: string): string | undefined {
  const sentences = raw.match(/[^.!?]+[.!?]+/g) || [raw];
  const kept = sentences.filter((s) => {
    const l = s.toLowerCase();
    if (l.includes('system instruction')) return false;
    if (l.includes('we are tufan') || l.includes('you are tufan') || l.includes('we are sutra') || l.includes('you are sutra') || l.includes('we are chatadk') || l.includes('you are chatadk')) return false;
    if (/mandatory truth override/.test(l)) return false;
    if (/\[system note/.test(l)) return false;
    if (/no question requiring/.test(l)) return false;
    if (/just (a greeting|respond friendly)/.test(l)) return false;
    if (/ensure we follow any style/.test(l)) return false;
    return true;
  });
  const text = kept.join(' ').replace(/\s+/g, ' ').trim();
  if (!text) return undefined;
  return text.slice(0, MAX_THINKING_CHARS);
}

export function extractThinking(message: unknown): string | undefined {
  if (!message || typeof message !== 'object') return undefined;
  const m = message as Record<string, unknown>;

  if (typeof m.reasoning_content === 'string' && m.reasoning_content.trim()) {
    return sanitizeThinking(m.reasoning_content.trim());
  }

  const out: string[] = [];
  if (typeof m.reasoning === 'string') {
    pushText(out, m.reasoning);
  } else if (Array.isArray(m.reasoning)) {
    m.reasoning.forEach((r) => pushText(out, r));
  }
  if (Array.isArray(m.reasoning_details)) {
    m.reasoning_details.forEach((r) => pushText(out, r));
  }

  if (out.length === 0) return undefined;
  return sanitizeThinking(out.join('\n\n'));
}
