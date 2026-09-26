// services/codecraftModels.ts
// Full CodeCraft catalogue (all 33 ids verified live), grouped by provider
// family for the Craft mode sub-selector.

export interface CodecraftModel {
  id: string;
  label: string;
  family: string;
  hint: string;
}

export const DEFAULT_CRAFT_MODEL = 'deepseek-v4-flash-0731';

export const CODECRAFT_FAMILIES = [
  'Anthropic',
  'OpenAI',
  'DeepSeek',
  'Google',
  'xAI',
  'Qwen',
  'GLM',
  'Kimi',
  'Seed',
  'Meta',
] as const;

export const CODECRAFT_MODELS: CodecraftModel[] = [
  // Anthropic (9)
  { id: 'claude-opus-5.5', label: 'Opus 5.5', family: 'Anthropic', hint: 'flagship' },
  { id: 'claude-opus-5', label: 'Opus 5', family: 'Anthropic', hint: 'most capable' },
  { id: 'claude-opus-4.8', label: 'Opus 4.8', family: 'Anthropic', hint: '' },
  { id: 'claude-opus-4.7', label: 'Opus 4.7', family: 'Anthropic', hint: '' },
  { id: 'claude-opus-4.6', label: 'Opus 4.6', family: 'Anthropic', hint: '' },
  { id: 'claude-sonnet-5', label: 'Sonnet 5', family: 'Anthropic', hint: 'fast' },
  { id: 'claude-fable-5.1', label: 'Fable 5.1', family: 'Anthropic', hint: '' },
  { id: 'claude-fable-5', label: 'Fable 5', family: 'Anthropic', hint: '' },
  { id: 'claude-mythos-preview', label: 'Mythos Preview', family: 'Anthropic', hint: 'preview' },
  // OpenAI (5)
  { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol', family: 'OpenAI', hint: '' },
  { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra', family: 'OpenAI', hint: '' },
  { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna', family: 'OpenAI', hint: 'efficient' },
  { id: 'gpt-5.5', label: 'GPT-5.5', family: 'OpenAI', hint: '' },
  { id: 'gpt-5.5-pro', label: 'GPT-5.5 Pro', family: 'OpenAI', hint: 'pro' },
  // DeepSeek (3)
  { id: 'deepseek-v4-pro-max', label: 'V4 Pro Max', family: 'DeepSeek', hint: 'strongest' },
  { id: 'deepseek-v4-pro-0813', label: 'V4 Pro', family: 'DeepSeek', hint: 'coding' },
  { id: 'deepseek-v4-flash-0731', label: 'V4 Flash', family: 'DeepSeek', hint: 'cheap & fast' },
  // Google (4)
  { id: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash', family: 'Google', hint: 'fast' },
  { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash', family: 'Google', hint: '' },
  { id: 'gemini-3.1-pro', label: 'Gemini 3.1 Pro', family: 'Google', hint: 'pro' },
  { id: 'gemma-2-2b', label: 'Gemma 2 2B', family: 'Google', hint: 'tiny' },
  // xAI (2)
  { id: 'grok-4.6', label: 'Grok 4.6', family: 'xAI', hint: '' },
  { id: 'grok-4.5', label: 'Grok 4.5', family: 'xAI', hint: '' },
  // Qwen (3)
  { id: 'qwen3.8-max', label: 'Qwen 3.8 Max', family: 'Qwen', hint: '' },
  { id: 'qwen3.7-max', label: 'Qwen 3.7 Max', family: 'Qwen', hint: '' },
  { id: 'qwen3.8-27b', label: 'Qwen 3.8 27B', family: 'Qwen', hint: 'compact' },
  // GLM (2)
  { id: 'glm-5.3', label: 'GLM 5.3', family: 'GLM', hint: '' },
  { id: 'glm-5.2', label: 'GLM 5.2', family: 'GLM', hint: '' },
  // Kimi (2)
  { id: 'kimi-k3', label: 'Kimi K3', family: 'Kimi', hint: '' },
  { id: 'kimi-k2.6', label: 'Kimi K2.6', family: 'Kimi', hint: '' },
  // Seed (2)
  { id: 'seed-2.1-pro', label: 'Seed 2.1 Pro', family: 'Seed', hint: '' },
  { id: 'seed-2.1-turbo', label: 'Seed 2.1 Turbo', family: 'Seed', hint: 'fast' },
  // Meta (1)
  { id: 'muse-spark-1.1', label: 'Muse Spark 1.1', family: 'Meta', hint: 'reasoning' },
];

export function isCodecraftModel(id: string): boolean {
  return CODECRAFT_MODELS.some((m) => m.id === id);
}

export function craftModelLabel(id: string): string {
  return CODECRAFT_MODELS.find((m) => m.id === id)?.label || id;
}
