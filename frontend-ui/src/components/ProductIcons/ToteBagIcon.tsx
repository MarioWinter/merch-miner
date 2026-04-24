import type { IconProps } from './types';

export const ToteBagIcon = ({ size = 40, color = 'currentColor' }: IconProps) => (
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
    <path d="M14 12 Q14 5 20 5 Q26 5 26 12" />
    <path d="M9 12 L31 12 L33 34 L7 34 Z" />
    <path d="M15 18 L15 22" />
    <path d="M25 18 L25 22" />
  </svg>
);
