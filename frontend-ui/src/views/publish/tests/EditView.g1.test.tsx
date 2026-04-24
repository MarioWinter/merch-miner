import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import type { DesignAsset, Listing } from '../types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
//
// EditView is a composition of many partials that each pull RTK Query hooks.
// For G1 we only care about the tab-switch / listing-state branching logic in
// EditView itself, so we mock the useEditView hook + the heavy partials to
// keep tests focused and fast.

const mockUseEditView = vi.fn();
vi.mock('../hooks/useEditView', () => ({
  useEditView: () => mockUseEditView(),
}));

// Stub heavy children so we can assert by role/text without rendering RTK
// Query-bound trees. Each stub exposes a marker test-id we can query.
vi.mock('../partials/edit/EditPageHeader', () => ({
  default: () => <div data-testid="EditPageHeader" />,
}));
vi.mock('../partials/edit/ThumbnailStrip', () => ({
  default: () => <div data-testid="ThumbnailStrip" />,
}));
vi.mock('../partials/edit/DesignPreview', () => ({
  default: () => <div data-testid="DesignPreview" />,
}));
vi.mock('../partials/edit/ProductTypeScroller', () => ({
  default: () => <div data-testid="ProductTypeScroller" />,
}));
vi.mock('../partials/edit/FitTypePrintSection', () => ({
  default: () => <div data-testid="FitTypePrintSection" />,
}));
vi.mock('../partials/edit/ColorGrid', () => ({
  default: () => <div data-testid="ColorGrid" />,
}));
vi.mock('../partials/edit/MarketplacePricing', () => ({
  default: () => <div data-testid="MarketplacePricing" />,
}));
vi.mock('../partials/edit/ListingFieldsSection', () => ({
  default: () => <div data-testid="ListingFieldsSection" />,
}));
vi.mock('../partials/edit/OptionsSection', () => ({
  default: () => <div data-testid="OptionsSection" />,
}));
vi.mock('../partials/edit/UnsavedChangesBar', () => ({
  default: () => <div data-testid="UnsavedChangesBar" />,
}));
vi.mock('../partials/edit/MarketplaceTabs', () => ({
  default: ({ value }: { value: string }) => (
    <div data-testid="MarketplaceTabs" data-value={value} />
  ),
}));
vi.mock('../partials/edit/MarketplacePlaceholder', () => ({
  default: ({ marketplace }: { marketplace: string }) => (
    <div data-testid="MarketplacePlaceholder" data-marketplace={marketplace} />
  ),
}));
vi.mock('../partials/command/CommandPalette', () => ({
  default: () => null,
}));
vi.mock('../partials/edit/CopyFromDesignDialog', () => ({
  default: () => null,
}));
vi.mock('../partials/EmptyState', () => ({
  default: () => <div data-testid="EmptyState" />,
}));

import EditView from '../EditView';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeDesign = (overrides: Partial<DesignAsset> = {}): DesignAsset => ({
  id: 'design-1',
  workspace: 'ws-1',
  file_name: 'x.png',
  file_url: '',
  source: 'upload',
  source_file_id: '',
  thumbnail_url: '',
  dimensions: { width: 1000, height: 1000 },
  file_size: 1,
  tags: [],
  listing: null,
  idea: 'idea-1',
  niche: null,
  collection: null,
  round: 1,
  created_by: 'user-1',
  created_at: '',
  ...overrides,
});

const makeListing = (overrides: Partial<Listing> = {}): Listing => ({
  id: 'listing-1',
  idea: 'idea-1',
  design: 'design-1',
  marketplace_type: 'mba',
  round: 1,
  brand_name: 'Brand',
  title: 'Title',
  bullet_1: '',
  bullet_2: '',
  description: '',
  keyword_context: '',
  status: 'draft',
  generated_by: 'ai',
  availability: 'public',
  publish_mode: 'live',
  language: 'en',
  translations: {},
  created_at: '',
  updated_at: '',
  ...overrides,
});

type EditViewHookState = ReturnType<typeof buildBaseState>;

// Stub form object — partials that would consume `control` are all mocked
// above, so we only need a placeholder that matches the shape enough for the
// useEditView contract.
const stubForm = {
  control: { register: vi.fn() } as unknown,
  reset: vi.fn(),
  getValues: vi.fn(),
  formState: { isDirty: false },
};

const buildBaseState = (
  design: DesignAsset | undefined,
  overrides: Record<string, unknown> = {},
) => ({
  designIds: design ? [design.id] : [],
  designs: design ? [design] : [],
  activeDesign: design,
  activeIndex: 0,
  setActiveIndex: vi.fn(),
  isLoading: false,
  handleDesignIdsChange: vi.fn(),
  activeMarketplace: 'mba' as const,
  setActiveMarketplace: vi.fn(),
  listingForm: stubForm,
  activeLang: 'en' as const,
  setActiveLang: vi.fn(),
  autoTranslate: false,
  setAutoTranslate: vi.fn(),
  listing: null as Listing | null,
  isLoadingListing: false,
  isFetchingListing: false,
  listingError: null as unknown,
  listingNotFound: false,
  isSaving: false,
  isAutoSaving: false,
  isTranslating: false,
  isDirty: false,
  handleDiscardListing: vi.fn(),
  handleSaveListing: vi.fn(),
  handleRetryListing: vi.fn(),
  handleConvertFrom: vi.fn(),
  copyDialog: { open: false, scope: null },
  isApplyingCopy: false,
  openCopyDialog: vi.fn(),
  closeCopyDialog: vi.fn(),
  applyCopy: vi.fn(),
  cmdPalette: {
    open: false,
    query: '',
    setQuery: vi.fn(),
    context: null,
    activeIndex: 0,
    matched: [],
    recentActions: [],
    flatActions: [],
    handleKeyDown: vi.fn(),
    executeAction: vi.fn(),
    closePalette: vi.fn(),
    openPalette: vi.fn(),
  },
  // Phase P1/P2 — minimal editFormState stub (children are mocked so only
  // the references need to resolve).
  editFormState: {
    focusedProduct: null,
    setFocusedProduct: vi.fn(),
    controlSetters: {
      toggleProductEnabled: vi.fn(),
      setFitTypes: vi.fn(),
      setPrintSide: vi.fn(),
      setColors: vi.fn(),
      setMarketplaces: vi.fn(),
    },
    priceSetters: { setPrice: vi.fn() },
    textSetters: { onChange: vi.fn(), onBlur: vi.fn() },
    manualSave: vi.fn(),
    discard: vi.fn(),
    aiImprove: vi.fn(),
    isImproving: false,
    royaltyFor: vi.fn(),
    isDirty: false,
    isSaving: false,
    saveError: null,
    isOnline: true,
    queueLength: 0,
    textFields: [],
  },
  ...overrides,
});

const renderEditView = (state: EditViewHookState) => {
  mockUseEditView.mockReturnValue(state);
  return renderWithProviders(<EditView />, {
    initialRoute: '/publish/edit?designs=design-1',
  });
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EditView — G1 listing state branching (MBA tab)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hides listing form while listing is loading (skeleton owns the slot)', () => {
    const design = makeDesign();
    const state = buildBaseState(design, { isLoadingListing: true });
    renderEditView(state);

    // Product config stays visible — only the listing-form subtree is hidden.
    expect(screen.getByTestId('ProductTypeScroller')).toBeInTheDocument();
    expect(screen.getByTestId('FitTypePrintSection')).toBeInTheDocument();
    expect(screen.queryByTestId('ListingFieldsSection')).not.toBeInTheDocument();
    expect(screen.queryByTestId('OptionsSection')).not.toBeInTheDocument();
  });

  it('hides listing form when marketplace tab has no listing (404)', () => {
    const design = makeDesign();
    const state = buildBaseState(design, { listingNotFound: true });
    renderEditView(state);

    // Banner shows a Convert-from-another-tab hint (Generate endpoint
    // retired in P8). Form subtree stays hidden.
    expect(
      screen.getByText(/no listing for mba yet/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('ListingFieldsSection')).not.toBeInTheDocument();
  });

  it('hides listing form on hard error and shows retry banner', () => {
    const design = makeDesign();
    const state = buildBaseState(design, {
      listingError: { status: 500, data: {} },
    });
    renderEditView(state);

    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByTestId('ListingFieldsSection')).not.toBeInTheDocument();
  });

  it('shows listing form once listing is loaded', () => {
    const design = makeDesign();
    const state = buildBaseState(design, { listing: makeListing() });
    renderEditView(state);

    expect(screen.getByTestId('ListingFieldsSection')).toBeInTheDocument();
    expect(screen.getByTestId('OptionsSection')).toBeInTheDocument();
  });

  it('renders placeholder (no banner) when non-MBA tab is active', () => {
    const design = makeDesign();
    const state = buildBaseState(design, {
      activeMarketplace: 'global',
      listingNotFound: true,
    });
    renderEditView(state);

    const placeholder = screen.getByTestId('MarketplacePlaceholder');
    expect(placeholder).toBeInTheDocument();
    expect(placeholder).toHaveAttribute('data-marketplace', 'global');
    // The MBA-only banner/form branch is not rendered on non-MBA tabs.
    expect(screen.queryByTestId('ListingFieldsSection')).not.toBeInTheDocument();
  });

  it('forwards activeMarketplace to the tabs component', () => {
    const design = makeDesign();
    renderEditView(buildBaseState(design, { activeMarketplace: 'mba' }));
    expect(screen.getByTestId('MarketplaceTabs')).toHaveAttribute(
      'data-value',
      'mba',
    );
  });
});
