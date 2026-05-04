import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

const SHIRT_CATALOG: MbaProductCatalogEntry = {
  key: 't_shirt',
  label: 'Standard T-Shirt',
  icon_key: 't_shirt',
  supports: ['fit_types', 'print_side', 'colors'],
  fit_types_options: ['Men'],
  print_side_options: ['front'],
  colors_options: [],
  marketplaces: ['amazon.com', 'amazon.de'],
  default_prices: { 'amazon.com': 19.99, 'amazon.de': 21.99 },
  royalty_formula: {
    'amazon.com': { coef: 0.4, base: 5.04 },
    'amazon.de': { coef: 0.4, base: 6.54 },
  },
};

const NO_MARKETPLACE_CATALOG: MbaProductCatalogEntry = {
  key: 'empty',
  label: 'Empty Product',
  icon_key: 't_shirt',
  supports: ['colors'],
  fit_types_options: [],
  print_side_options: [],
  colors_options: [],
  marketplaces: [],
  default_prices: {},
  royalty_formula: {},
};

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

// Spec-mirrored royalty so test assertions don't drift from the real helper.
const royaltyForStub = (
  _productKey: string,
  marketplace: string,
  price: number | null,
): number | null => {
  if (price === null || !Number.isFinite(price)) return null;
  const formula = SHIRT_CATALOG.royalty_formula[marketplace];
  if (!formula) return null;
  return Math.round((price * formula.coef - formula.base) * 100) / 100;
};

// ---------------------------------------------------------------------------
// Mocks — publishSlice
// ---------------------------------------------------------------------------

let mockCatalog: MbaProductCatalogEntry[] = [
  SHIRT_CATALOG,
  NO_MARKETPLACE_CATALOG,
];
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

import MarketplacePricing from '../partials/edit/MarketplacePricing';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MarketplacePricing — Phase P4', () => {
  beforeEach(() => {
    mockCatalog = [SHIRT_CATALOG, NO_MARKETPLACE_CATALOG];
    mockProductConfig = undefined;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when no product is focused', () => {
    const { container } = renderWithProviders(
      <MarketplacePricing
        designId="design-1"
        marketplaceType="mba"
        focusedProduct={null}
        setPrice={vi.fn()}
        setMarketplaceEnabled={vi.fn()}
        royaltyFor={royaltyForStub}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when the focused product has no marketplaces in catalog', () => {
    const { container } = renderWithProviders(
      <MarketplacePricing
        designId="design-1"
        marketplaceType="mba"
        focusedProduct="empty"
        setPrice={vi.fn()}
        setMarketplaceEnabled={vi.fn()}
        royaltyFor={royaltyForStub}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('T-Shirt focused → renders one row per catalog marketplace', () => {
    renderWithProviders(
      <MarketplacePricing
        designId="design-1"
        marketplaceType="mba"
        focusedProduct="t_shirt"
        setPrice={vi.fn()}
        setMarketplaceEnabled={vi.fn()}
        royaltyFor={royaltyForStub}
      />,
    );
    expect(
      screen.getByTestId('MarketplacePricing-row-amazon.com'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('MarketplacePricing-row-amazon.de'),
    ).toBeInTheDocument();
  });

  it('reflects enabled + price state from the focused product entry', () => {
    mockProductConfig = makeProductConfig([
      makeEntry({
        product_type: 't_shirt',
        enabled: true,
        marketplaces: [
          { marketplace: 'amazon.com', price: 19.99, enabled: true },
          { marketplace: 'amazon.de', price: 0, enabled: false },
        ],
      }),
    ]);
    renderWithProviders(
      <MarketplacePricing
        designId="design-1"
        marketplaceType="mba"
        focusedProduct="t_shirt"
        setPrice={vi.fn()}
        setMarketplaceEnabled={vi.fn()}
        royaltyFor={royaltyForStub}
      />,
    );
    const usCheckbox = screen.getByRole('checkbox', {
      name: /enable amazon\.com/i,
    });
    const deCheckbox = screen.getByRole('checkbox', {
      name: /enable amazon\.de/i,
    });
    expect(usCheckbox).toBeChecked();
    expect(deCheckbox).not.toBeChecked();

    const usPrice = screen.getByRole('spinbutton', {
      name: /price for amazon\.com/i,
    }) as HTMLInputElement;
    expect(usPrice.value).toBe('19.99');
  });

  it('checkbox toggle calls setMarketplaceEnabled(focused, mp, !current)', () => {
    const setMarketplaceEnabled = vi.fn();
    mockProductConfig = makeProductConfig([
      makeEntry({
        product_type: 't_shirt',
        enabled: true,
        marketplaces: [
          { marketplace: 'amazon.com', price: 19.99, enabled: true },
        ],
      }),
    ]);
    renderWithProviders(
      <MarketplacePricing
        designId="design-1"
        marketplaceType="mba"
        focusedProduct="t_shirt"
        setPrice={vi.fn()}
        setMarketplaceEnabled={setMarketplaceEnabled}
        royaltyFor={royaltyForStub}
      />,
    );
    fireEvent.click(
      screen.getByRole('checkbox', { name: /enable amazon\.com/i }),
    );
    expect(setMarketplaceEnabled).toHaveBeenCalledWith(
      't_shirt',
      'amazon.com',
      false,
    );
  });

  it('price input → setPrice(focused, mp, numericValue) on each keystroke', () => {
    const setPrice = vi.fn();
    mockProductConfig = makeProductConfig([
      makeEntry({
        product_type: 't_shirt',
        enabled: true,
        marketplaces: [
          { marketplace: 'amazon.com', price: 0, enabled: true },
        ],
      }),
    ]);
    renderWithProviders(
      <MarketplacePricing
        designId="design-1"
        marketplaceType="mba"
        focusedProduct="t_shirt"
        setPrice={setPrice}
        setMarketplaceEnabled={vi.fn()}
        royaltyFor={royaltyForStub}
      />,
    );
    const input = screen.getByRole('spinbutton', {
      name: /price for amazon\.com/i,
    });
    fireEvent.change(input, { target: { value: '19.99' } });
    // Debounce lives inside priceSetters.setPrice in the hook. The
    // component still calls setPrice on every keystroke; the hook
    // collapses them.
    expect(setPrice).toHaveBeenLastCalledWith('t_shirt', 'amazon.com', 19.99);
  });

  it('royalty: "19.99" on amazon.com → positive + green tone', () => {
    renderWithProviders(
      <MarketplacePricing
        designId="design-1"
        marketplaceType="mba"
        focusedProduct="t_shirt"
        setPrice={vi.fn()}
        setMarketplaceEnabled={vi.fn()}
        royaltyFor={royaltyForStub}
      />,
    );
    const input = screen.getByRole('spinbutton', {
      name: /price for amazon\.com/i,
    });
    fireEvent.change(input, { target: { value: '19.99' } });
    const cell = screen.getByTestId('MarketplacePricing-royalty-amazon.com');
    // 19.99 * 0.4 - 5.04 = 2.956 → rounded 2.96
    expect(cell).toHaveTextContent(/\$2\.96/);
    expect(cell).toHaveAttribute('data-royalty-tone', 'positive');
  });

  it('royalty: "5" on amazon.com → negative + red tone', () => {
    renderWithProviders(
      <MarketplacePricing
        designId="design-1"
        marketplaceType="mba"
        focusedProduct="t_shirt"
        setPrice={vi.fn()}
        setMarketplaceEnabled={vi.fn()}
        royaltyFor={royaltyForStub}
      />,
    );
    const input = screen.getByRole('spinbutton', {
      name: /price for amazon\.com/i,
    });
    fireEvent.change(input, { target: { value: '5' } });
    const cell = screen.getByTestId('MarketplacePricing-royalty-amazon.com');
    // 5 * 0.4 - 5.04 = -3.04
    expect(cell).toHaveTextContent(/-\$3\.04/);
    expect(cell).toHaveAttribute('data-royalty-tone', 'negative');
  });

  it('royalty: empty price → "—" + neutral tone', () => {
    mockProductConfig = makeProductConfig([
      makeEntry({
        product_type: 't_shirt',
        enabled: true,
        marketplaces: [
          { marketplace: 'amazon.com', price: 0, enabled: true },
        ],
      }),
    ]);
    renderWithProviders(
      <MarketplacePricing
        designId="design-1"
        marketplaceType="mba"
        focusedProduct="t_shirt"
        setPrice={vi.fn()}
        setMarketplaceEnabled={vi.fn()}
        royaltyFor={royaltyForStub}
      />,
    );
    const input = screen.getByRole('spinbutton', {
      name: /price for amazon\.com/i,
    });
    fireEvent.change(input, { target: { value: '' } });
    const cell = screen.getByTestId('MarketplacePricing-royalty-amazon.com');
    expect(cell).toHaveTextContent(/—/);
    expect(cell).toHaveAttribute('data-royalty-tone', 'neutral');
  });
});
