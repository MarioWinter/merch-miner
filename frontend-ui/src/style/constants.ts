export const COLORS = {
  // Teal-black (ink) — dark bg + light-mode text base
  ink:          '#071E26',
  inkPaper:     '#0B2731',
  inkElevated:  '#0F3040',

  // Snow — dark-mode text
  snow:         '#E8F4F8',
  snowMuted:    '#7BAAB8',
  snowDisabled: '#3D6A7A',

  // Ash — light-mode surfaces
  ash:          '#E8F0F3',
  ashDefault:   '#F0F6F8',
  ashTooltip:   '#F7FBFC',

  // Light-mode text
  mist:         '#3D6A7A',
  mistDisabled: '#8AADB8',

  // Brand red (primary)
  red:   '#FF5A4F',
  redDk: '#E84B42',
  redLt: '#FF7A72',

  // Brand cyan — dark secondary
  cyan:   '#00C8D7',
  cyanDk: '#00A8B5',
  cyanLt: '#33D5E2',

  // Teal — light secondary
  teal:   '#0097A7',
  tealDk: '#00838F',
  tealLt: '#00BCD4',

  // Neutral
  white: '#FFFFFF',
  black: '#000000',

  // Status — dark mode
  successDk:      '#22D3A3',
  successDkShade: '#18B08A',
  warningDk:      '#F59E0B',
  warningDkShade: '#D97706',
  errorDk:        '#F43F3A',
  errorDkShade:   '#D93530',
  infoDk:         '#38BDF8',

  // Status — light mode
  successLight: '#059669',
  warningLight: '#D97706',
  errorLight:   '#DC2626',
  infoLight:    '#0284C7',
} as const;

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
