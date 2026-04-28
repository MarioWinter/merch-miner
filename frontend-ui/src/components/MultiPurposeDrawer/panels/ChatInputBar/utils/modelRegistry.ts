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
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini', provider: 'OpenRouter' },
  { value: 'gpt-4.1', label: 'GPT-4.1', provider: 'OpenRouter' },
  {
    value: 'claude-sonnet-4-20250514',
    label: 'Claude Sonnet 4',
    provider: 'OpenRouter',
  },
  {
    value: 'mistral-medium-latest',
    label: 'Mistral Medium',
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
