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

const SHIRT_CATALOG: MbaProductCatalogEntry = {
  key: 't_shirt',
  label: 'Standard T-Shirt',
  icon_key: 't_shirt',
  supports: ['fit_types', 'print_side', 'colors'],
  fit_types_options: ['Men', 'Women', 'Youth', 'Girls', 'Adult Unisex'],
  print_side_options: ['front', 'back'],
  colors_options: [],
  marketplaces: ['amazon.com'],
  default_prices: { 'amazon.com': 19.99 },
  royalty_formula: { 'amazon.com': { coef: 0.4, base: 5.04 } },
};

const POPSOCKET_CATALOG: MbaProductCatalogEntry = {
  key: 'popsocket',
  label: 'PopSocket',
  icon_key: 'popsocket',
  supports: ['colors'],
  fit_types_options: [],
  print_side_options: [],
  colors_options: [],
  marketplaces: ['amazon.com'],
  default_prices: { 'amazon.com': 14.99 },
  royalty_formula: { 'amazon.com': { coef: 0.4, base: 3.04 } },
};

const THROW_PILLOW_CATALOG: MbaProductCatalogEntry = {
  key: 'throw_pillow',
  label: 'Throw Pillow',
  icon_key: 'throw_pillow',
  supports: ['print_side', 'colors'],
  fit_types_options: [],
  print_side_options: ['front', 'back'],
  colors_options: [],
  marketplaces: ['amazon.com'],
  default_prices: { 'amazon.com': 29.99 },
  royalty_formula: { 'amazon.com': { coef: 0.4, base: 10 } },
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

// ---------------------------------------------------------------------------
// Mocks — publishSlice
// ---------------------------------------------------------------------------

let mockCatalog: MbaProductCatalogEntry[] = [
  SHIRT_CATALOG,
  POPSOCKET_CATALOG,
  THROW_PILLOW_CATALOG,
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

import FitTypePrintSection from '../partials/edit/FitTypePrintSection';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FitTypePrintSection — Phase P2', () => {
  beforeEach(() => {
    mockCatalog = [SHIRT_CATALOG, POPSOCKET_CATALOG, THROW_PILLOW_CATALOG];
    mockProductConfig = undefined;
  });

  it('renders nothing when no product is focused', () => {
    const { container } = renderWithProviders(
      <FitTypePrintSection
        designId="design-1"
        marketplaceType="mba"
        focusedProduct={null}
        setFitTypes={vi.fn()}
        setPrintSide={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('PopSocket (supports=[colors]) → section hidden entirely', () => {
    const { container } = renderWithProviders(
      <FitTypePrintSection
        designId="design-1"
        marketplaceType="mba"
        focusedProduct="popsocket"
        setFitTypes={vi.fn()}
        setPrintSide={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('T-Shirt → Men/Women/Youth/Girls/Adult Unisex fit options visible', () => {
    renderWithProviders(
      <FitTypePrintSection
        designId="design-1"
        marketplaceType="mba"
        focusedProduct="t_shirt"
        setFitTypes={vi.fn()}
        setPrintSide={vi.fn()}
      />,
    );
    for (const label of ['Men', 'Women', 'Youth', 'Girls', 'Adult Unisex']) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(
      screen.getByTestId('FitTypePrintSection-fits'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('FitTypePrintSection-print'),
    ).toBeInTheDocument();
  });

  it('Throw Pillow (supports=[print_side, colors]) → print side visible, fits hidden', () => {
    renderWithProviders(
      <FitTypePrintSection
        designId="design-1"
        marketplaceType="mba"
        focusedProduct="throw_pillow"
        setFitTypes={vi.fn()}
        setPrintSide={vi.fn()}
      />,
    );
    expect(
      screen.queryByTestId('FitTypePrintSection-fits'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId('FitTypePrintSection-print'),
    ).toBeInTheDocument();
  });

  it('toggling a fit calls setFitTypes(focused, nextList)', () => {
    const setFitTypes = vi.fn();
    mockProductConfig = makeProductConfig([
      makeEntry({ product_type: 't_shirt', enabled: true, fit_types: ['Men'] }),
    ]);
    renderWithProviders(
      <FitTypePrintSection
        designId="design-1"
        marketplaceType="mba"
        focusedProduct="t_shirt"
        setFitTypes={setFitTypes}
        setPrintSide={vi.fn()}
      />,
    );
    // Tick 'Women' on top of existing 'Men'.
    fireEvent.click(screen.getByLabelText('Women'));
    expect(setFitTypes).toHaveBeenCalledWith('t_shirt', ['Men', 'Women']);
  });

  it('changing print side calls setPrintSide(focused, side)', () => {
    const setPrintSide = vi.fn();
    mockProductConfig = makeProductConfig([
      makeEntry({ product_type: 't_shirt', enabled: true, print_side: 'front' }),
    ]);
    renderWithProviders(
      <FitTypePrintSection
        designId="design-1"
        marketplaceType="mba"
        focusedProduct="t_shirt"
        setFitTypes={vi.fn()}
        setPrintSide={setPrintSide}
      />,
    );
    fireEvent.click(
      screen.getByRole('radio', { name: /back/i }),
    );
    expect(setPrintSide).toHaveBeenCalledWith('t_shirt', 'back');
  });
});
