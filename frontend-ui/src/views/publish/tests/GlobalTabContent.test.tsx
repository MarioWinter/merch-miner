import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import type { Listing } from '../types';
import type { UseEditFormStateReturn } from '../hooks/useEditFormState';

// ---------------------------------------------------------------------------
// Mocks — mirror the lightweight-stub style used in EditView.g1.test.tsx so
// GlobalTabContent can render without pulling real RTK-Query trees. Each mock
// exposes a stable test-id so we can assert composition.
// ---------------------------------------------------------------------------

vi.mock('../partials/edit/TranslationTabs', () => ({
  default: () => <div data-testid="TranslationTabs" />,
}));
vi.mock('../partials/edit/ListingField', () => ({
  default: ({ label }: { label: string }) => (
    <div data-testid="ListingField" data-label={label} />
  ),
}));
vi.mock('../partials/global/KeywordsChipField', () => ({
  default: () => <div data-testid="KeywordsChipField" />,
}));
vi.mock('../partials/global/KeywordResearchLinks', () => ({
  default: () => <div data-testid="KeywordResearchLinks" />,
}));
vi.mock('../partials/global/TypeColorOptions', () => ({
  default: () => <div data-testid="TypeColorOptions" />,
}));
vi.mock('../partials/global/TaggingOptionsMenu', () => ({
  default: () => <div data-testid="TaggingOptionsMenu-button" />,
}));
vi.mock('../partials/global/ImportKeywordsCsvDialog', () => ({
  default: () => null,
}));
vi.mock('../partials/global/AdvancedOptionsDialog', () => ({
  default: () => null,
}));
vi.mock('@/components/ConfirmDialog', () => ({
  default: () => null,
}));
// useGlobalTabActions pulls RTK mutations — stub with a minimal shape.
vi.mock('../hooks/useGlobalTabActions', () => ({
  useGlobalTabActions: () => ({
    confirm: null,
    importOpen: false,
    advancedOpen: false,
    openConfirm: vi.fn(),
    closeConfirm: vi.fn(),
    openImport: vi.fn(),
    closeImport: vi.fn(),
    openAdvanced: vi.fn(),
    closeAdvanced: vi.fn(),
    runCopyEnToAll: vi.fn(),
    runClearAll: vi.fn(),
    runImportCsv: vi.fn(),
  }),
}));

import GlobalTabContent from '../partials/global/GlobalTabContent';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeListing = (overrides: Partial<Listing> = {}): Listing => ({
  id: 'listing-1',
  idea: 'idea-1',
  design: 'design-1',
  marketplace_type: 'global',
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
  keywords: { en: [] },
  type_flags: [],
  color_mode: '',
  created_at: '',
  updated_at: '',
  ...overrides,
});

// Stub textSetters / keywordsSetters / misc setters — GlobalTabContent never
// fires them in these render-only tests, so no-op implementations suffice.
const makeStubSetters = () => {
  const textSetters: UseEditFormStateReturn['textSetters'] = {
    onChange: vi.fn(),
    onBlur: vi.fn(),
    onChangeTranslated: vi.fn(),
    onBlurTranslated: vi.fn(),
  };
  const keywordsSetters: UseEditFormStateReturn['keywordsSetters'] = {
    setAll: vi.fn().mockResolvedValue(undefined),
    commitChip: vi.fn().mockResolvedValue(undefined),
    removeChip: vi.fn().mockResolvedValue(undefined),
  };
  return {
    textSetters,
    keywordsSetters,
    typeFlagsSetter: vi.fn().mockResolvedValue(undefined),
    colorModeSetter: vi.fn().mockResolvedValue(undefined),
    advancedOptionsSetter: vi.fn().mockResolvedValue(undefined),
  };
};

const renderGlobalTab = (listing: Listing | null = makeListing()) => {
  const stubs = makeStubSetters();
  return renderWithProviders(
    <GlobalTabContent
      listing={listing}
      activeLang="en"
      onLangChange={vi.fn()}
      autoTranslate={false}
      onAutoTranslateChange={vi.fn()}
      activeNicheId="niche-1"
      textSetters={stubs.textSetters}
      keywordsSetters={stubs.keywordsSetters}
      typeFlagsSetter={stubs.typeFlagsSetter}
      colorModeSetter={stubs.colorModeSetter}
      advancedOptionsSetter={stubs.advancedOptionsSetter}
      listingReady={listing !== null}
    />,
  );
};

// ---------------------------------------------------------------------------
// Tests — Phase U9 (AC-42 / AC-84 / AC-88 / AC-128 / AC-130 / AC-134)
// ---------------------------------------------------------------------------

describe('GlobalTabContent — Phase U9', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders KeywordsChipField + KeywordResearchLinks + TypeColorOptions + Tagging Options + Advanced Options trigger when given a Global listing', () => {
    renderGlobalTab();

    // Keyword workflow (AC-84, AC-128, AC-134)
    expect(screen.getByTestId('KeywordsChipField')).toBeInTheDocument();
    expect(screen.getByTestId('KeywordResearchLinks')).toBeInTheDocument();
    expect(screen.getByTestId('TaggingOptionsMenu-button')).toBeInTheDocument();

    // Options (AC-88) + Advanced Options trigger (AC-130)
    expect(screen.getByTestId('TypeColorOptions')).toBeInTheDocument();
    expect(screen.getByTestId('AdvancedOptionsTrigger')).toBeInTheDocument();

    // Title + Description present via our ListingField mock
    const fields = screen.getAllByTestId('ListingField');
    const labels = fields.map((n) => n.getAttribute('data-label'));
    expect(labels).toContain('Title');
    expect(labels).toContain('Description');
  });

  it('does NOT render MBA-specific sections (MarketplacePricing, FitTypePrintSection)', () => {
    renderGlobalTab();

    // Per AC-45 the Global tab explicitly omits MBA product config + pricing.
    expect(screen.queryByTestId('MarketplacePricing')).not.toBeInTheDocument();
    expect(screen.queryByTestId('FitTypePrintSection')).not.toBeInTheDocument();
    // Also not rendered: Brand / Bullets / keyword_context (Brand lives in
    // the AdvancedOptions modal per AC-131).
    expect(screen.queryByTestId('ColorGrid')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ProductTypeScroller')).not.toBeInTheDocument();
  });
});
