import type { IconProps } from './types';

export const MugIcon = ({ size = 40, color = 'currentColor' }: IconProps) => (
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
    <path d="M9 11 L25 11 L25 32 Q25 34 23 34 L11 34 Q9 34 9 32 Z" />
    <path d="M25 15 L29 15 Q32 15 32 19 L32 24 Q32 28 29 28 L25 28" />
    <path d="M12 15 L22 15" />
  </svg>
);
