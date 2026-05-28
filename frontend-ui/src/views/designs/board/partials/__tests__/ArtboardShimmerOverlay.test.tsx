import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import ArtboardShimmerOverlay from '../ArtboardShimmerOverlay';

describe('ArtboardShimmerOverlay', () => {
  it('renders an overlay at the given screen-space rect', () => {
    renderWithProviders(
      <ArtboardShimmerOverlay x={100} y={200} width={320} height={400} />,
    );
    const overlay = screen.getByTestId('artboard-shimmer-overlay');
    expect(overlay).toBeInTheDocument();
    const style = window.getComputedStyle(overlay);
    expect(style.position).toBe('absolute');
    expect(style.left).toBe('100px');
    expect(style.top).toBe('200px');
    expect(style.width).toBe('320px');
    expect(style.height).toBe('400px');
    expect(style.pointerEvents).toBe('none');
  });
});
