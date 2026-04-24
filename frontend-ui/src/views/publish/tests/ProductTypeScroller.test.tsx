import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import type {
  DesignProductConfig,
  MbaProductCatalogEntry,
  ProductConfigEntry,
} from '../types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseCatalogEntry = (overrides: Partial<MbaProductCatalogEntry>):
  MbaProductCatalogEntry => ({
  key: 't_shirt',
  label: 'Standard T-Shirt',
  icon_key: 't_shirt',
  supports: ['fit_types', 'print_side', 'colors'],
  fit_types_options: ['men'],
  print_side_options: ['front'],
  colors_options: [],
  marketplaces: ['amazon.com'],
  default_prices: { 'amazon.com': 19.99 },
  royalty_formula: { 'amazon.com': { coef: 0.4, base: 5.04 } },
  ...overrides,
});

const CATALOG_FIXTURE: MbaProductCatalogEntry[] = [
  baseCatalogEntry({ key: 't_shirt', label: 'Standard T-Shirt', icon_key: 't_shirt' }),
  baseCatalogEntry({ key: 'hoodie_pullover', label: 'Pullover Hoodie', icon_key: 'hoodie_pullover' }),
  baseCatalogEntry({ key: 'tank_top', label: 'Tank Top', icon_key: 'tank_top' }),
  baseCatalogEntry({
    key: 'popsocket',
    label: 'PopSocket',
    icon_key: 'popsocket',
    supports: ['colors'],
    fit_types_options: [],
    print_side_options: [],
  }),
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
// Mocks — publishSlice hooks
// ---------------------------------------------------------------------------

let mockCatalog: MbaProductCatalogEntry[] = CATALOG_FIXTURE;
let mockProductConfig: DesignProductConfig | undefined;

vi.mock('@/store/publishSlice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/store/publishSlice')>();
  return {
    ...actual,
    useGetMbaProductCatalogQuery: () => ({
      data: mockCatalog,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }),
    useGetProductConfigQuery: () => ({
      data: mockProductConfig,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }),
  };
});

import ProductTypeScroller from '../partials/edit/ProductTypeScroller';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProductTypeScroller — Phase P1', () => {
  beforeEach(() => {
    mockCatalog = CATALOG_FIXTURE;
    mockProductConfig = undefined;
  });

  it('renders one card per catalog entry', () => {
    renderWithProviders(
      <ProductTypeScroller
        designId="design-1"
        marketplaceType="mba"
        focusedProduct={null}
        onFocusedProductChange={vi.fn()}
        toggleProductEnabled={vi.fn()}
      />,
    );
    for (const item of CATALOG_FIXTURE) {
      expect(
        screen.getByTestId(`ProductTypeScroller-card-${item.key}`),
      ).toBeInTheDocument();
    }
  });

  it('click toggles enabled + sets focusedProduct', () => {
    const onFocusedProductChange = vi.fn();
    const toggleProductEnabled = vi.fn();
    // `t_shirt` currently disabled.
    mockProductConfig = makeProductConfig([
      makeEntry({ product_type: 't_shirt', enabled: false }),
    ]);
    renderWithProviders(
      <ProductTypeScroller
        designId="design-1"
        marketplaceType="mba"
        focusedProduct={null}
        onFocusedProductChange={onFocusedProductChange}
        toggleProductEnabled={toggleProductEnabled}
      />,
    );
    fireEvent.click(screen.getByTestId('ProductTypeScroller-card-t_shirt'));
    expect(onFocusedProductChange).toHaveBeenCalledWith('t_shirt');
    expect(toggleProductEnabled).toHaveBeenCalledWith('t_shirt', true);
  });

  // Round 4 (EC-37): click on an enabled-but-NOT-focused card = focus only,
  // no toggle. Round 2 UX complaint was that clicking to focus disabled the
  // product; this test locks in the fix.
  it('click on an enabled + unfocused card focuses without toggling off', () => {
    const onFocusedProductChange = vi.fn();
    const toggleProductEnabled = vi.fn();
    mockProductConfig = makeProductConfig([
      makeEntry({
        product_type: 't_shirt',
        enabled: true,
        marketplaces: [{ marketplace: 'amazon.com', price: 19.99, enabled: true }],
      }),
    ]);
    renderWithProviders(
      <ProductTypeScroller
        designId="design-1"
        marketplaceType="mba"
        focusedProduct={null}
        onFocusedProductChange={onFocusedProductChange}
        toggleProductEnabled={toggleProductEnabled}
      />,
    );
    fireEvent.click(screen.getByTestId('ProductTypeScroller-card-t_shirt'));
    expect(onFocusedProductChange).toHaveBeenCalledWith('t_shirt');
    expect(toggleProductEnabled).not.toHaveBeenCalled();
  });

  // Round 4 (EC-37): click on an enabled + FOCUSED card = disable.
  it('click on an enabled + focused card toggles enabled=false', () => {
    const onFocusedProductChange = vi.fn();
    const toggleProductEnabled = vi.fn();
    mockProductConfig = makeProductConfig([
      makeEntry({
        product_type: 't_shirt',
        enabled: true,
        marketplaces: [{ marketplace: 'amazon.com', price: 19.99, enabled: true }],
      }),
    ]);
    renderWithProviders(
      <ProductTypeScroller
        designId="design-1"
        marketplaceType="mba"
        focusedProduct="t_shirt"
        onFocusedProductChange={onFocusedProductChange}
        toggleProductEnabled={toggleProductEnabled}
      />,
    );
    fireEvent.click(screen.getByTestId('ProductTypeScroller-card-t_shirt'));
    expect(toggleProductEnabled).toHaveBeenCalledWith('t_shirt', false);
  });

  it('renders count badge = number of enabled marketplaces', () => {
    mockProductConfig = makeProductConfig([
      makeEntry({
        product_type: 't_shirt',
        enabled: true,
        marketplaces: [
          { marketplace: 'amazon.com', price: 19.99, enabled: true },
          { marketplace: 'amazon.de', price: 19.99, enabled: true },
          { marketplace: 'amazon.co.uk', price: 19.99, enabled: false },
        ],
      }),
    ]);
    renderWithProviders(
      <ProductTypeScroller
        designId="design-1"
        marketplaceType="mba"
        focusedProduct={null}
        onFocusedProductChange={vi.fn()}
        toggleProductEnabled={vi.fn()}
      />,
    );
    expect(
      screen.getByTestId('ProductTypeScroller-count-t_shirt'),
    ).toHaveTextContent('2');
  });

  it('omits the count badge when the product has no enabled marketplaces', () => {
    mockProductConfig = makeProductConfig([
      makeEntry({
        product_type: 't_shirt',
        enabled: true,
        marketplaces: [
          { marketplace: 'amazon.com', price: 19.99, enabled: false },
        ],
      }),
    ]);
    renderWithProviders(
      <ProductTypeScroller
        designId="design-1"
        marketplaceType="mba"
        focusedProduct={null}
        onFocusedProductChange={vi.fn()}
        toggleProductEnabled={vi.fn()}
      />,
    );
    expect(
      screen.queryByTestId('ProductTypeScroller-count-t_shirt'),
    ).not.toBeInTheDocument();
  });

  it('marks the focused card via data-focused=true', () => {
    renderWithProviders(
      <ProductTypeScroller
        designId="design-1"
        marketplaceType="mba"
        focusedProduct="hoodie_pullover"
        onFocusedProductChange={vi.fn()}
        toggleProductEnabled={vi.fn()}
      />,
    );
    expect(
      screen.getByTestId('ProductTypeScroller-card-hoodie_pullover'),
    ).toHaveAttribute('data-focused', 'true');
    expect(
      screen.getByTestId('ProductTypeScroller-card-t_shirt'),
    ).toHaveAttribute('data-focused', 'false');
  });

  it('skips querying product-config when designId is null (skipToken path)', () => {
    renderWithProviders(
      <ProductTypeScroller
        designId={null}
        marketplaceType="mba"
        focusedProduct={null}
        onFocusedProductChange={vi.fn()}
        toggleProductEnabled={vi.fn()}
      />,
    );
    // Cards still render (catalog-driven).
    expect(
      screen.getByTestId('ProductTypeScroller-card-t_shirt'),
    ).toBeInTheDocument();
  });
});
