import type { CanvasElement, CanvasElementType } from '../types';

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

export const TYPE_LABELS: Record<CanvasElementType, string> = {
  image: 'Image',
  text: 'Text',
  shape: 'Shape',
  brush: 'Drawing',
  emoji: 'Emoji',
};

export const INITIAL_COUNTERS: Record<CanvasElementType, number> = {
  image: 0,
  text: 0,
  shape: 0,
  brush: 0,
  emoji: 0,
};

// -----------------------------------------------------------------
// Pure helpers
// -----------------------------------------------------------------

export const nextElementId = (): string =>
  `el_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const nextZIndex = (layers: CanvasElement[]): number =>
  layers.length === 0 ? 1 : Math.max(...layers.map((l) => l.zIndex)) + 1;
