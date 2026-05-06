import { SvgIcon, type SvgIconProps } from '@mui/material';

/**
 * BSR-rank icon used on product cards. Draws a small chart frame with explicit
 * x and y axes plus an upward-trending line — mirrors Flying Research's
 * familiar BSR glyph (📈 with visible axes), which MUI's standard icon set
 * does not provide.
 */
const BsrChartIcon = (props: SvgIconProps) => (
  <SvgIcon viewBox="0 0 24 24" {...props}>
    {/* Y-axis (left vertical line) + X-axis (bottom horizontal line) */}
    <path
      d="M5 4 L5 19 L20 19"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    />
    {/* Trending-up line inside the frame */}
    <path
      d="M8 15 L11 12 L14 13 L18 8"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </SvgIcon>
);

export default BsrChartIcon;
