import type { IconProps } from './types';

export const HoodieZipIcon = ({ size = 40, color = 'currentColor' }: IconProps) => (
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
    <path d="M14 13 Q20 4 26 13" />
    <path d="M14 13 L7 16 L10 23 L14 22 L14 33 L26 33 L26 22 L30 23 L33 16 L26 13" />
    <path d="M17 14 Q20 18 23 14" />
    <path d="M20 16 L20 33" />
    <circle cx="20" cy="21" r="0.8" fill={color} />
  </svg>
);
