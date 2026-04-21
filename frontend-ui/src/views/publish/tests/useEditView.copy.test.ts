import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import type { DesignAsset, Listing } from '../types';

// ---------------------------------------------------------------------------
// Mocks — cover every RTK Query hook + collaborator that useEditView pulls
// in, and assert on the copy-from mutation. Flat mocks (no importOriginal)
// mirror the pattern established in useListingEditor.test.ts.
// ---------------------------------------------------------------------------

const mockEnqueueSnackbar = vi.fn();
vi.mock('notistack', () => ({
  useSnackbar: () => ({ enqueueSnackbar: mockEnqueueSnackbar }),
}));

const stableT = (key: string, opts?: { defaultValue?: string }) =>
  opts?.defaultValue ?? key;
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: stableT }),
}));

// Capture args for later inspection
const mockCopyProductConfig = vi.fn();
const mockFetchSourceListing = vi.fn();
const mockListGallery = vi.fn();
const mockConvertMutation = vi.fn();

const makeListing = (overrides: Partial<Listing> = {}): Listing => ({
  id: 'listing-mba-1',
  idea: 'idea-1',
  design: 'design-1',
  marketplace_type: 'mba',
  round: 1,
  brand_name: 'B',
  title: 'T',
  bullet_1: '',
  bullet_2: '',
  bullet_3: '',
  bullet_4: '',
  bullet_5: '',
  description: '',
  backend_keywords: '',
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

const makeDesign = (overrides: Partial<DesignAsset> = {}): DesignAsset => ({
  id: 'design-1',
  workspace: 'ws-1',
  file_name: 'x.png',
  file_url: '',
  source: 'upload',
  source_file_id: '',
  thumbnail_url: '',
  dimensions: { width: 1, height: 1 },
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

// Default gallery contains the active design + a source design so
// applyCopy('listing') can find the source's idea id.
const defaultDesigns: DesignAsset[] = [
  makeDesign({ id: 'design-1', idea: 'idea-1' }),
  makeDesign({ id: 'src-id', idea: 'idea-src' }),
];

vi.mock('@/store/publishSlice', () => ({
  useListGalleryQuery: () => mockListGallery(),
  useLazyGetListingQuery: () => [mockFetchSourceListing, { isLoading: false }],
  useCopyProductConfigFromMutation: () => [
    mockCopyProductConfig,
    { isLoading: false },
  ],
  useGetListingQuery: () => ({
    data: makeListing(),
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  }),
  useGenerateListingMutation: () => [vi.fn(), { isLoading: false }],
  useUpdateListingMutation: () => [vi.fn(), { isLoading: false }],
  useTranslateListingMutation: () => [vi.fn(), { isLoading: false }],
  useTmCheckMutation: () => [vi.fn(), { isLoading: false }],
  useLazyExportListingQuery: () => [vi.fn(), { isLoading: false }],
  useConvertListingMutation: () => [mockConvertMutation, { isLoading: false }],
  useGetProductConfigQuery: () => ({
    data: undefined,
    isLoading: false,
    isFetching: false,
    error: { status: 404 },
  }),
  useUpdateProductConfigMutation: () => [vi.fn(), { isLoading: false }],
}));

import { useEditView } from '../hooks/useEditView';

// ---------------------------------------------------------------------------
// Test harness — wrap renderHook with MemoryRouter so useSearchParams works.
// Start with ?designs=design-1,src-id so both appear in `designs[]`.
// ---------------------------------------------------------------------------

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(
    MemoryRouter,
    { initialEntries: ['/publish/edit?designs=design-1,src-id'] },
    children,
  );

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useEditView — applyCopy (product-config scopes)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListGallery.mockReturnValue({
      data: { results: defaultDesigns, count: defaultDesigns.length },
      isLoading: false,
    });
  });

  it("applyCopy('colors', src-id) calls copyProductConfigFrom with scope 'colors'", async () => {
    mockCopyProductConfig.mockReturnValue({
      unwrap: () => Promise.resolve({ ok: true }),
    });
    const { result } = renderHook(() => useEditView(), { wrapper });

    await act(async () => {
      await result.current.applyCopy('src-id', 'colors');
    });

    expect(mockCopyProductConfig).toHaveBeenCalledTimes(1);
    expect(mockCopyProductConfig).toHaveBeenCalledWith({
      designId: 'design-1',
      source_design_id: 'src-id',
      marketplace_type: 'mba',
      scope: 'colors',
    });
  });

  it("applyCopy 404 surfaces warning snackbar naming the marketplace", async () => {
    mockCopyProductConfig.mockReturnValue({
      unwrap: () => Promise.reject({ status: 404 }),
    });
    const { result } = renderHook(() => useEditView(), { wrapper });

    await act(async () => {
      await result.current.applyCopy('src-id', 'colors');
    });

    // 404 maps to the "source has no config" warning (marketplace name is
    // interpolated by i18next at runtime — the test `t` stub preserves the
    // template literal, so we assert on the stable prefix).
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
      expect.stringContaining('Source has no config'),
      { variant: 'warning' },
    );
  });

  it('applyCopy 500 surfaces generic error snackbar', async () => {
    mockCopyProductConfig.mockReturnValue({
      unwrap: () => Promise.reject({ status: 500 }),
    });
    const { result } = renderHook(() => useEditView(), { wrapper });

    await act(async () => {
      await result.current.applyCopy('src-id', 'colors');
    });

    expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
      expect.stringContaining('Failed to save product configuration'),
      { variant: 'error' },
    );
  });
});
