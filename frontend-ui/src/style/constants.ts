export const EASING = {
  enter: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
  exit: 'cubic-bezier(0.4, 0.0, 1, 1)',
  standard: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
} as const;

export const DURATION = {
  fast: 150,
  default: 200,
  slow: 300,
} as const;

export const MONO_FONT_STACK =
  '"JetBrains Mono", "IBM Plex Mono", "Fira Code", ui-monospace, "Cascadia Code", "Courier New", monospace';
