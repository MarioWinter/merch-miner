import type { IconProps } from './types';

export const TShirtIcon = ({ size = 40, color = 'currentColor' }: IconProps) => (
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
    <path d="M15 8 L8 12 L11 19 L14 18 L14 33 L26 33 L26 18 L29 19 L32 12 L25 8 C23 11 17 11 15 8 Z" />
  </svg>
);
