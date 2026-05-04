import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import type {
  DesignProductConfig,
  MbaColor,
  MbaProductCatalogEntry,
  ProductConfigEntry,
} from '../types';

// ---------------------------------------------------------------------------
// Fixtures — per-product palettes. T-Shirt gets the full MBA palette;
// PopSocket a smaller subset to prove different products drive different
// palettes.
// ---------------------------------------------------------------------------

const SHIRT_COLORS: MbaColor[] = [
  { key: 'black', name: 'Black', hex: '#000000' },
  { key: 'white', name: 'White', hex: '#FFFFFF' },
  { key: 'navy', name: 'Navy', hex: '#0E1E3A' },
  { key: 'red', name: 'Red', hex: '#E11D48' },
];

const POPSOCKET_COLORS: MbaColor[] = [
  { key: 'black', name: 'Black', hex: '#000000' },
  { key: 'white', name: 'White', hex: '#FFFFFF' },
];

const makeCatalog = (
  options: Partial<Record<string, MbaColor[]>> = {},
): MbaProductCatalogEntry[] => [
  {
    key: 't_shirt',
    label: 'Standard T-Shirt',
    icon_key: 't_shirt',
    supports: ['fit_types', 'print_side', 'colors'],
    fit_types_options: ['Men', 'Women'],
    print_side_options: ['front', 'back'],
    colors_options: options.t_shirt ?? SHIRT_COLORS,
    marketplaces: ['amazon.com'],
    default_prices: { 'amazon.com': 19.99 },
    royalty_formula: { 'amazon.com': { coef: 0.4, base: 5.04 } },
  },
  {
    key: 'popsocket',
    label: 'PopSocket',
    icon_key: 'popsocket',
    supports: ['colors'],
    fit_types_options: [],
    print_side_options: [],
    colors_options: options.popsocket ?? POPSOCKET_COLORS,
    marketplaces: ['amazon.com'],
    default_prices: { 'amazon.com': 14.99 },
    royalty_formula: { 'amazon.com': { coef: 0.4, base: 3.0 } },
  },
  // A product that doesn't support colors at all — useful for the
  // "null render when catalog lacks 'colors' support" test.
  {
    key: 'hat_ish',
    label: 'No-Color Hat',
    icon_key: 't_shirt',
    supports: ['fit_types'],
    fit_types_options: [],
    print_side_options: [],
    colors_options: [],
    marketplaces: ['amazon.com'],
    default_prices: { 'amazon.com': 19.99 },
    royalty_formula: { 'amazon.com': { coef: 0.4, base: 5.04 } },
  },
];

const makeEntry = (
  overrides: Partial<ProductConfigEntry> & { product_type: string },
): ProductConfigEntry => ({
  enabled: false,
  fit_types: [],
  print_side: 'front',
  colors: [],
  marketplaces: [],
  ...overrides,
});

const makeProductConfig = (
  entries: ProductConfigEntry[],
): DesignProductConfig => ({
  id: 'pc-1',
  design: 'design-1',
  marketplace_type: 'mba',
  products_config: entries,
  created_at: '',
  updated_at: '',
});

// ---------------------------------------------------------------------------
// Mocks — publishSlice
// ---------------------------------------------------------------------------

type CatalogResult = {
  data: MbaProductCatalogEntry[] | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
};

let mockCatalog: CatalogResult = {
  data: makeCatalog(),
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
};

let mockProductConfig: DesignProductConfig | undefined;

vi.mock('@/store/publishSlice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/store/publishSlice')>();
  return {
    ...actual,
    useGetMbaProductCatalogQuery: () => mockCatalog,
    useGetProductConfigQuery: () => ({
      data: mockProductConfig,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }),
  };
});

import ColorGrid from '../partials/edit/ColorGrid';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ColorGrid — Phase P3', () => {
  beforeEach(() => {
    mockCatalog = {
      data: makeCatalog(),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    };
    mockProductConfig = undefined;
  });

  it('renders nothing when no product is focused', () => {
    const { container } = renderWithProviders(
      <ColorGrid
        designId="design-1"
        marketplaceType="mba"
        focusedProduct={null}
        toggleColor={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('T-Shirt focused → renders the full shirt palette', () => {
    renderWithProviders(
      <ColorGrid
        designId="design-1"
        marketplaceType="mba"
        focusedProduct="t_shirt"
        toggleColor={vi.fn()}
      />,
    );
    for (const c of SHIRT_COLORS) {
      expect(
        screen.getByTestId(`ColorGrid-swatch-${c.key}`),
      ).toBeInTheDocument();
    }
    expect(screen.getAllByRole('checkbox')).toHaveLength(SHIRT_COLORS.length);
  });

  it('different products show different palettes', () => {
    const { rerender } = renderWithProviders(
      <ColorGrid
        designId="design-1"
        marketplaceType="mba"
        focusedProduct="t_shirt"
        toggleColor={vi.fn()}
      />,
    );
    expect(screen.getAllByRole('checkbox')).toHaveLength(SHIRT_COLORS.length);

    rerender(
      <ColorGrid
        designId="design-1"
        marketplaceType="mba"
        focusedProduct="popsocket"
        toggleColor={vi.fn()}
      />,
    );
    expect(screen.getAllByRole('checkbox')).toHaveLength(
      POPSOCKET_COLORS.length,
    );
    // Shirt-only color must no longer be in the DOM.
    expect(
      screen.queryByTestId('ColorGrid-swatch-navy'),
    ).not.toBeInTheDocument();
  });

  it('renders nothing when catalog entry does not support colors', () => {
    const { container } = renderWithProviders(
      <ColorGrid
        designId="design-1"
        marketplaceType="mba"
        focusedProduct="hat_ish"
        toggleColor={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('reflects selected colors from the focused product config entry', () => {
    mockProductConfig = makeProductConfig([
      makeEntry({
        product_type: 't_shirt',
        enabled: true,
        colors: ['black', 'navy'],
      }),
    ]);
    renderWithProviders(
      <ColorGrid
        designId="design-1"
        marketplaceType="mba"
        focusedProduct="t_shirt"
        toggleColor={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('checkbox', { name: /black/i }),
    ).toHaveAttribute('aria-checked', 'true');
    expect(
      screen.getByRole('checkbox', { name: /navy/i }),
    ).toHaveAttribute('aria-checked', 'true');
    expect(
      screen.getByRole('checkbox', { name: /white/i }),
    ).toHaveAttribute('aria-checked', 'false');
  });

  it('click calls toggleColor(focusedProduct, colorKey) — race-safe (Round 4)', () => {
    const toggleColor = vi.fn();
    mockProductConfig = makeProductConfig([
      makeEntry({
        product_type: 't_shirt',
        enabled: true,
        colors: ['black'],
      }),
    ]);
    renderWithProviders(
      <ColorGrid
        designId="design-1"
        marketplaceType="mba"
        focusedProduct="t_shirt"
        toggleColor={toggleColor}
      />,
    );
    // Round 4 P3 fix: ColorGrid no longer derives the next array from a
    // stale closure — it delegates to useEditFormState.toggleColor which
    // reads productsConfigRef.current at call time. The component's only
    // job is to name the (product, color) pair being clicked.
    fireEvent.click(screen.getByRole('checkbox', { name: /navy/i }));
    expect(toggleColor).toHaveBeenCalledWith('t_shirt', 'navy');

    fireEvent.click(screen.getByRole('checkbox', { name: /black/i }));
    expect(toggleColor).toHaveBeenLastCalledWith('t_shirt', 'black');
  });

  it('switching focused product swaps the selection baseline', () => {
    mockProductConfig = makeProductConfig([
      makeEntry({
        product_type: 't_shirt',
        enabled: true,
        colors: ['black', 'navy'],
      }),
      makeEntry({
        product_type: 'popsocket',
        enabled: true,
        colors: ['white'],
      }),
    ]);
    const { rerender } = renderWithProviders(
      <ColorGrid
        designId="design-1"
        marketplaceType="mba"
        focusedProduct="t_shirt"
        toggleColor={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('checkbox', { name: /navy/i }),
    ).toHaveAttribute('aria-checked', 'true');

    rerender(
      <ColorGrid
        designId="design-1"
        marketplaceType="mba"
        focusedProduct="popsocket"
        toggleColor={vi.fn()}
      />,
    );
    // Navy isn't in PopSocket's palette at all — and White (popsocket's
    // selected) is marked.
    expect(
      screen.queryByRole('checkbox', { name: /navy/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: /white/i }),
    ).toHaveAttribute('aria-checked', 'true');
  });

  it('renders skeleton grid while catalog is loading', () => {
    mockCatalog = {
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    };
    const { container } = renderWithProviders(
      <ColorGrid
        designId="design-1"
        marketplaceType="mba"
        focusedProduct="t_shirt"
        toggleColor={vi.fn()}
      />,
    );
    expect(
      container.querySelector('[aria-busy="true"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelectorAll('.MuiSkeleton-root'),
    ).toHaveLength(20);
  });

  it('renders error alert with retry when the catalog fails', () => {
    const refetch = vi.fn();
    mockCatalog = {
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    };
    renderWithProviders(
      <ColorGrid
        designId="design-1"
        marketplaceType="mba"
        focusedProduct="t_shirt"
        toggleColor={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      /failed to load colors/i,
    );
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
