import type { IconProps } from './types';

export const WaterBottleIcon = ({ size = 40, color = 'currentColor' }: IconProps) => (
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
    <path d="M17 4 L23 4 L23 8 L17 8 Z" />
    <path d="M16 8 L24 8 L24 11 Q27 13 27 17 L27 33 Q27 36 24 36 L16 36 Q13 36 13 33 L13 17 Q13 13 16 11 Z" />
    <path d="M13 17 L27 17" />
  </svg>
);
