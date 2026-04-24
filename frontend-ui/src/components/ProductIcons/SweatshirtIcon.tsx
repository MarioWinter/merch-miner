import type { IconProps } from './types';

export const SweatshirtIcon = ({ size = 40, color = 'currentColor' }: IconProps) => (
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
    <path d="M15 8 L7 12 L10 20 L14 19 L14 31 L10 34 L30 34 L26 31 L26 19 L30 20 L33 12 L25 8 C23 11 17 11 15 8 Z" />
    <path d="M14 31 L26 31" />
    <path d="M10 19 L14 19" />
    <path d="M26 19 L30 19" />
  </svg>
);
