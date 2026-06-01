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

// Order (top→bottom): GPT-4.1 Mini pinned at the top (default workspace
// model), then everything else by release date descending (newest first).
// Within a same-date pair, list the more-capable variant first.
//
// Release dates as of 2026-05-31:
//   - Gemini 3.5 Flash:           2026-05-19  ← newest
//   - GPT-5.4 Mini / Nano:        2026-03-17  (mini before nano)
//   - Gemini 3.1 Flash Lite Pv:   pre-3.5 preview line
//   - Gemini 3 Flash Pv:          pre-3.1 preview line
//   - Mistral Medium 3:           oldest entry
//
// Keep `chat_attachments_app/constants.py::VISION_CAPABLE_MODELS` in sync.
export const MODELS: ReadonlyArray<ModelEntry> = [
  { value: 'openai/gpt-4.1-mini', label: 'GPT-4.1 Mini', provider: 'OpenRouter' },
  // 2026-05-19 — Google's high-efficiency multimodal model. 1M context,
  // text/image/video/audio/PDF input, thinking-mode default medium.
  // Pricing: $1.50/M input, $9/M output. Vision-capable.
  {
    value: 'google/gemini-3.5-flash',
    label: 'Gemini 3.5 Flash',
    provider: 'OpenRouter',
  },
  // 2026-03-17 — OpenAI's mid-tier 5.4 variant. 400K context, vision
  // input. Pricing: $0.75/M input, $4.50/M output.
  {
    value: 'openai/gpt-5.4-mini',
    label: 'GPT-5.4 Mini',
    provider: 'OpenRouter',
  },
  // 2026-03-17 — cheapest 5.4 variant for high-volume / cost-sensitive
  // turns. 400K context, vision input. $0.20/M input, $1.25/M output.
  {
    value: 'openai/gpt-5.4-nano',
    label: 'GPT-5.4 Nano',
    provider: 'OpenRouter',
  },
  {
    value: 'google/gemini-3.1-flash-lite-preview',
    label: 'Gemini 3.1 Flash Lite (Preview)',
    provider: 'OpenRouter',
  },
  {
    value: 'google/gemini-3-flash-preview',
    label: 'Gemini 3 Flash (Preview)',
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
