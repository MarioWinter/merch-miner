/**
 * PROJ-20 Phase 3.6 — model registry
 *
 * Static catalog of LLM models surfaced in the ChatInputBar's Model popover.
 * Migrated from the (deleted) `ChatControls.tsx` MODELS constant.
 *
 * The `provider` field drives the grouped section header in the popover.
 * Add models here when new ones go live; the popover groups them
 * automatically.
 */

export interface ModelEntry {
  /** Stable id stored in `chatBarSlice.selectedModel` and sent to the backend. */
  value: string;
  /** Human-friendly label rendered in the popover and search filter. */
  label: string;
  /** Provider header — currently only "OpenRouter"; kept extensible. */
  provider: 'OpenRouter';
}

export const MODELS: ReadonlyArray<ModelEntry> = [
  { value: 'openai/gpt-4.1-mini', label: 'GPT-4.1 Mini', provider: 'OpenRouter' },
  {
    value: 'google/gemini-3-flash-preview',
    label: 'Gemini 3 Flash (Preview)',
    provider: 'OpenRouter',
  },
  {
    value: 'google/gemini-3.1-flash-lite-preview',
    label: 'Gemini 3.1 Flash Lite (Preview)',
    provider: 'OpenRouter',
  },
  // PROJ-29 follow-up: Mistral Medium 3 is the writing-tuned creative
  // baseline. `generate_slogans` falls back to gemini-3-flash-preview
  // automatically when this model is unavailable.
  {
    value: 'mistralai/mistral-medium-3',
    label: 'Mistral Medium 3',
    provider: 'OpenRouter',
  },
];

/**
 * Group models by provider, preserving insertion order both for the groups
 * and for the entries within each group.
 */
export const groupModelsByProvider = (
  models: ReadonlyArray<ModelEntry>,
): Array<{ provider: ModelEntry['provider']; entries: ModelEntry[] }> => {
  const order: ModelEntry['provider'][] = [];
  const map = new Map<ModelEntry['provider'], ModelEntry[]>();
  for (const m of models) {
    if (!map.has(m.provider)) {
      order.push(m.provider);
      map.set(m.provider, []);
    }
    map.get(m.provider)!.push(m);
  }
  return order.map((provider) => ({
    provider,
    entries: map.get(provider) ?? [],
  }));
};
