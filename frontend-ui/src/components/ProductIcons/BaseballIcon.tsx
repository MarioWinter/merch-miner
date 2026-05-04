import type { IconProps } from './types';

export const BaseballIcon = ({ size = 40, color = 'currentColor' }: IconProps) => (
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
    <path d="M15 8 L9 11 L10 22 L14 21 L14 33 L26 33 L26 21 L30 22 L31 11 L25 8 C23 11 17 11 15 8 Z" />
    <path d="M17 10 L10 22" />
    <path d="M23 10 L30 22" />
    <path d="M19 24 L19 28" />
    <path d="M21 24 L21 28" />
  </svg>
);
