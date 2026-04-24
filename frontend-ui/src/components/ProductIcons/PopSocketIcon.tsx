import type { IconProps } from './types';

export const PopSocketIcon = ({ size = 40, color = 'currentColor' }: IconProps) => (
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
    <circle cx="20" cy="20" r="11" />
    <circle cx="20" cy="20" r="4" />
    <path d="M12 14 L14 15.5" />
    <path d="M28 14 L26 15.5" />
    <path d="M12 26 L14 24.5" />
    <path d="M28 26 L26 24.5" />
  </svg>
);
