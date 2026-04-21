import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import type { DesignAsset } from '../types';
import ThumbnailStrip from '../partials/edit/ThumbnailStrip';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeDesign = (overrides: Partial<DesignAsset> = {}): DesignAsset => ({
  id: 'design-1',
  workspace: 'ws-1',
  file_name: 'x.png',
  file_url: 'https://cdn.example/x.png',
  source: 'upload',
  source_file_id: '',
  thumbnail_url: 'https://cdn.example/x-thumb.png',
  dimensions: { width: 1000, height: 1000 },
  file_size: 1024,
  tags: [],
  listing: null,
  idea: null,
  niche: null,
  collection: null,
  round: 1,
  created_by: 'user-1',
  created_at: '2026-04-10T00:00:00Z',
  ...overrides,
});

const designFixtures = [
  makeDesign({ id: 'd-1', file_name: 'one.png' }),
  makeDesign({ id: 'd-2', file_name: 'two.png' }),
  makeDesign({ id: 'd-3', file_name: 'three.png' }),
];

const defaultProps = (overrides: Record<string, unknown> = {}) => ({
  designIds: designFixtures.map((d) => d.id),
  designs: designFixtures,
  activeIndex: 0,
  onActiveIndexChange: vi.fn(),
  isLoading: false,
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ThumbnailStrip', () => {
  it('renders one ThumbnailItem per designId', () => {
    renderWithProviders(<ThumbnailStrip {...defaultProps()} />);

    // Each ThumbnailItem exposes aria-label `Design <n>` (1-based index).
    expect(
      screen.getByRole('button', { name: /design 1/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /design 2/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /design 3/i }),
    ).toBeInTheDocument();
  });

  it('marks the active thumbnail with aria-current="true"', () => {
    renderWithProviders(<ThumbnailStrip {...defaultProps({ activeIndex: 1 })} />);

    // The cyan border + badge reflect the active state — aria-current is the
    // stable, theme-agnostic signal consumers (and tests) rely on.
    const active = screen.getByRole('button', { name: /design 2/i });
    expect(active).toHaveAttribute('aria-current', 'true');

    // Non-active thumbnails don't carry the attribute.
    expect(
      screen.getByRole('button', { name: /design 1/i }),
    ).not.toHaveAttribute('aria-current');
    expect(
      screen.getByRole('button', { name: /design 3/i }),
    ).not.toHaveAttribute('aria-current');
  });

  it('clicking an inactive thumbnail fires onActiveIndexChange with that index', () => {
    const onActiveIndexChange = vi.fn();
    renderWithProviders(
      <ThumbnailStrip
        {...defaultProps({ activeIndex: 0, onActiveIndexChange })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /design 3/i }));
    expect(onActiveIndexChange).toHaveBeenCalledWith(2);
  });

  it('Previous / Next arrows navigate the active index (wrap-around on boundaries)', () => {
    // Boundary case — activeIndex=0: Previous wraps to last (total - 1).
    const onActiveIndexChange = vi.fn();
    const { unmount } = renderWithProviders(
      <ThumbnailStrip
        {...defaultProps({ activeIndex: 0, onActiveIndexChange })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /previous design/i }));
    expect(onActiveIndexChange).toHaveBeenLastCalledWith(2);

    // Next from index 0 — advances to 1.
    fireEvent.click(screen.getByRole('button', { name: /next design/i }));
    expect(onActiveIndexChange).toHaveBeenLastCalledWith(1);

    unmount();

    // Boundary case — activeIndex=2: Next wraps back to 0.
    const onActiveIndexChange2 = vi.fn();
    renderWithProviders(
      <ThumbnailStrip
        {...defaultProps({
          activeIndex: 2,
          onActiveIndexChange: onActiveIndexChange2,
        })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /next design/i }));
    expect(onActiveIndexChange2).toHaveBeenLastCalledWith(0);
  });
});
