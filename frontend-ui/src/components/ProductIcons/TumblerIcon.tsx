import type { IconProps } from './types';

export const TumblerIcon = ({ size = 40, color = 'currentColor' }: IconProps) => (
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
    <path d="M14 7 L26 7 L28 10 L26 13 L14 13 L12 10 Z" />
    <path d="M14 13 L15 34 L25 34 L26 13" />
    <path d="M15 18 L25 18" />
    <path d="M28 10 Q32 11 32 16" />
  </svg>
);
