import type { IconProps } from './types';

export const LongSleeveIcon = ({ size = 40, color = 'currentColor' }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 40 40"
    fill="none"
    stroke={color}
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path d="M15 8 L5 12 L5 26 L11 26 L11 33 L29 33 L29 26 L35 26 L35 12 L25 8 C23 11 17 11 15 8 Z" />
  </svg>
);
