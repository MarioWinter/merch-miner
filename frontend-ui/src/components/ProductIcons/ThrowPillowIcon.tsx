import type { IconProps } from './types';

export const ThrowPillowIcon = ({ size = 40, color = 'currentColor' }: IconProps) => (
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
    <path d="M10 12 Q6 20 10 28 Q20 33 30 28 Q34 20 30 12 Q20 7 10 12 Z" />
    <path d="M13 14 L11 12" />
    <path d="M27 14 L29 12" />
    <path d="M13 26 L11 28" />
    <path d="M27 26 L29 28" />
  </svg>
);
