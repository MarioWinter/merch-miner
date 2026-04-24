import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import type { Listing } from '../types';
import type { UseEditFormStateReturn } from '../hooks/useEditFormState';

// ---------------------------------------------------------------------------
// Mocks -- mirror GlobalTabContent.test.tsx so DisplateTabContent renders
// without RTK trees. Stable test-ids assert composition. Also stubs the
// Color radio so we can prove `hideColorMode` is forwarded.
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
// TypeColorOptions renders both sections; the stub exposes `hideColorMode`
// via a data-attr so we can assert Displate explicitly hides the Color radio.
vi.mock('../partials/global/TypeColorOptions', () => ({
  default: ({ hideColorMode }: { hideColorMode?: boolean }) => (
    <div
      data-testid="TypeColorOptions"
      data-hide-color-mode={hideColorMode ? 'true' : 'false'}
    />
  ),
}));
vi.mock('../partials/global/BackgroundColorPicker', () => ({
  default: () => <div data-testid="BackgroundColorPicker" />,
}));
vi.mock('../partials/global/TaggingOptionsMenu', () => ({
  default: () => <div data-testid="TaggingOptionsMenu-button" />,
}));
vi.mock('../partials/global/ImportKeywordsCsvDialog', () => ({
  default: () => null,
}));
// AdvancedOptionsDialog stub exposes `hideCategory` via a data-attr so the
// Displate composition can prove Category is hidden per AC-131.
vi.mock('../partials/global/AdvancedOptionsDialog', () => ({
  default: ({ open, hideCategory }: { open: boolean; hideCategory?: boolean }) =>
    open ? (
      <div
        data-testid="AdvancedOptionsDialog"
        data-hide-category={hideCategory ? 'true' : 'false'}
      />
    ) : null,
}));
vi.mock('@/components/ConfirmDialog', () => ({
  default: () => null,
}));
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

import DisplateTabContent from '../partials/global/DisplateTabContent';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeListing = (overrides: Partial<Listing> = {}): Listing => ({
  id: 'listing-1',
  idea: 'idea-1',
  design: 'design-1',
  marketplace_type: 'displate',
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
  background_color_hex: '',
  created_at: '',
  updated_at: '',
  ...overrides,
});

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
    bgHexSetter: vi.fn().mockResolvedValue(undefined),
    advancedOptionsSetter: vi.fn().mockResolvedValue(undefined),
  };
};

const renderDisplate = (listing: Listing | null = makeListing()) => {
  const stubs = makeStubSetters();
  return renderWithProviders(
    <DisplateTabContent
      listing={listing}
      activeLang="en"
      onLangChange={vi.fn()}
      autoTranslate={false}
      onAutoTranslateChange={vi.fn()}
      activeNicheId="niche-1"
      textSetters={stubs.textSetters}
      keywordsSetters={stubs.keywordsSetters}
      typeFlagsSetter={stubs.typeFlagsSetter}
      bgHexSetter={stubs.bgHexSetter}
      advancedOptionsSetter={stubs.advancedOptionsSetter}
      listingReady={listing !== null}
    />,
  );
};

// ---------------------------------------------------------------------------
// Tests -- Phase V3 (AC-125 / AC-126 / AC-128 / AC-130 / AC-134)
// ---------------------------------------------------------------------------

describe('DisplateTabContent -- Phase V3', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders core Displate sections (Title/Description + Keywords + Tagging + Background Color)', () => {
    renderDisplate();

    expect(screen.getByTestId('KeywordsChipField')).toBeInTheDocument();
    expect(screen.getByTestId('KeywordResearchLinks')).toBeInTheDocument();
    expect(screen.getByTestId('TaggingOptionsMenu-button')).toBeInTheDocument();
    expect(screen.getByTestId('TypeColorOptions')).toBeInTheDocument();
    expect(screen.getByTestId('BackgroundColorPicker')).toBeInTheDocument();
    expect(screen.getByTestId('AdvancedOptionsTrigger')).toBeInTheDocument();

    const fields = screen.getAllByTestId('ListingField');
    const labels = fields.map((n) => n.getAttribute('data-label'));
    expect(labels).toContain('Title');
    expect(labels).toContain('Description');
  });

  it('forwards `hideColorMode` to TypeColorOptions (AC-125 -- Displate has no color_mode)', () => {
    renderDisplate();

    expect(
      screen.getByTestId('TypeColorOptions').getAttribute('data-hide-color-mode'),
    ).toBe('true');
  });

  it('does NOT render MBA-specific sections', () => {
    renderDisplate();

    expect(screen.queryByTestId('MarketplacePricing')).not.toBeInTheDocument();
    expect(screen.queryByTestId('FitTypePrintSection')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ColorGrid')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ProductTypeScroller')).not.toBeInTheDocument();
  });
});
