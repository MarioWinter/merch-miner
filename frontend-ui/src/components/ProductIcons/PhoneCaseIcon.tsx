import type { IconProps } from './types';

export const PhoneCaseIcon = ({ size = 40, color = 'currentColor' }: IconProps) => (
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
    <rect x="11" y="5" width="18" height="30" rx="3" />
    <rect x="17" y="8" width="6" height="2" rx="1" />
    <circle cx="20" cy="14" r="2" />
    <circle cx="20" cy="14" r="0.8" fill={color} />
  </svg>
);
