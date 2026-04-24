import type { IconProps } from './types';

export const HoodiePulloverIcon = ({ size = 40, color = 'currentColor' }: IconProps) => (
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
    <path d="M15 24 L25 24 L23 30 L17 30 Z" />
    <path d="M19 14 L19 18" />
    <path d="M21 14 L21 18" />
  </svg>
);
