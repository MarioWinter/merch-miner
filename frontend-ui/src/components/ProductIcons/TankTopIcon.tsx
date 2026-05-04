import type { IconProps } from './types';

export const TankTopIcon = ({ size = 40, color = 'currentColor' }: IconProps) => (
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
    <path d="M14 8 L14 14 L11 16 L11 33 L29 33 L29 16 L26 14 L26 8" />
    <path d="M14 8 C17 12 23 12 26 8" />
  </svg>
);
