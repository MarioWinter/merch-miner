import { useState, useCallback } from 'react';
import { useLazyGetSuggestionsQuery } from '@/store/researchSlice';

export const DEFAULT_PREFIXES = [
  'funny',
  'best',
  'retired',
  'cute',
  'vintage',
  'custom',
  'proud',
] as const;

export const DEFAULT_SUFFIXES = [
  'gifts',
  'shirt',
  'appreciation',
  'retirement',
  'mug',
  'hoodie',
  'sticker',
] as const;

export interface ModifierSuggestion {
  keyword: string;
  modifier: string;
  type: 'prefix' | 'suffix';
}

interface UseModifierSuggestionsReturn {
  suggestions: ModifierSuggestion[];
  isGenerating: boolean;
  generate: (keyword: string, prefixes: string[], suffixes: string[], marketplace: string) => void;
  clear: () => void;
}

export const useModifierSuggestions = (): UseModifierSuggestionsReturn => {
  const [suggestions, setSuggestions] = useState<ModifierSuggestion[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [triggerSuggestions] = useLazyGetSuggestionsQuery();

  const generate = useCallback(
    async (
      keyword: string,
      prefixes: string[],
      suffixes: string[],
      marketplace: string,
    ) => {
      if (!keyword.trim()) return;

      setIsGenerating(true);
      const combos: { q: string; modifier: string; type: 'prefix' | 'suffix' }[] = [];

      for (const p of prefixes) {
        combos.push({ q: `${p} ${keyword}`, modifier: p, type: 'prefix' });
      }
      for (const s of suffixes) {
        combos.push({ q: `${keyword} ${s}`, modifier: s, type: 'suffix' });
      }

      try {
        const results = await Promise.allSettled(
          combos.map(async (combo) => {
            const result = await triggerSuggestions(
              { q: combo.q, marketplace },
              true,
            ).unwrap();
            return (result ?? []).map((kw: string) => ({
              keyword: kw,
              modifier: combo.modifier,
              type: combo.type,
            }));
          }),
        );

        const seen = new Set<string>();
        const merged: ModifierSuggestion[] = [];

        for (const r of results) {
          if (r.status === 'fulfilled') {
            for (const s of r.value) {
              const lower = s.keyword.toLowerCase();
              if (!seen.has(lower) && lower !== keyword.toLowerCase()) {
                seen.add(lower);
                merged.push(s);
              }
            }
          }
        }

        setSuggestions(merged);
      } finally {
        setIsGenerating(false);
      }
    },
    [triggerSuggestions],
  );

  const clear = useCallback(() => setSuggestions([]), []);

  return { suggestions, isGenerating, generate, clear };
};
