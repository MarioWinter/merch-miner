import type { IconProps } from './types';

export const TruckerHatIcon = ({ size = 40, color = 'currentColor' }: IconProps) => (
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
    <path d="M9 23 C9 13 13 9 20 9 C27 9 31 13 31 23" />
    <path d="M5 23 L35 23 L32 28 L8 28 Z" />
    <path d="M14 14 L14 23" />
    <path d="M20 11 L20 23" />
    <path d="M26 14 L26 23" />
  </svg>
);
