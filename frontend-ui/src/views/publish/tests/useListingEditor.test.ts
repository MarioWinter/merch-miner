import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Listing } from '../types';

// ---- Mocks ----

const mockEnqueueSnackbar = vi.fn();
vi.mock('notistack', () => ({
  useSnackbar: () => ({ enqueueSnackbar: mockEnqueueSnackbar }),
}));

const stableT = (key: string, opts?: { defaultValue?: string }) =>
  opts?.defaultValue ?? key;
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: stableT }),
}));

// RTK Query mock hooks
const mockGenerateMutation = vi.fn();
const mockUpdateMutation = vi.fn();
const mockTranslateMutation = vi.fn();
const mockTmCheckMutation = vi.fn();
const mockLazyExport = vi.fn();

const mockGetListingResult: {
  data: Listing | null;
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  refetch: () => void;
} = {
  data: null,
  isLoading: false,
  isFetching: false,
  error: null,
  refetch: vi.fn(),
};

vi.mock('@/store/publishSlice', () => ({
  useGetListingQuery: () => mockGetListingResult,
  useGenerateListingMutation: () => [
    mockGenerateMutation,
    { isLoading: false },
  ],
  useUpdateListingMutation: () => [mockUpdateMutation, { isLoading: false }],
  useTranslateListingMutation: () => [
    mockTranslateMutation,
    { isLoading: false },
  ],
  useTmCheckMutation: () => [mockTmCheckMutation, { isLoading: false }],
  useLazyExportListingQuery: () => [mockLazyExport, { isLoading: false }],
}));

import { useListingEditor } from '../hooks/useListingEditor';

// ---- Fixtures ----

const makeListing = (overrides: Partial<Listing> = {}): Listing => ({
  id: 'listing-mba-1',
  idea: 'idea-1',
  design: 'design-1',
  marketplace_type: 'mba',
  round: 1,
  brand_name: 'BrandX',
  title: 'Vintage Cat Shirt',
  bullet_1: 'B1',
  bullet_2: 'B2',
  bullet_3: 'B3',
  bullet_4: 'B4',
  bullet_5: 'B5',
  description: 'Desc',
  backend_keywords: 'cat, vintage',
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

const makeFormValues = () => ({
  brand: 'BrandX',
  title: 'Title A',
  bullet_1: 'B1',
  bullet_2: 'B2',
  bullet_3: 'B3',
  bullet_4: 'B4',
  bullet_5: 'B5',
  description: 'Desc',
  backend_keywords: ['cat', 'vintage'],
  translations: {},
  auto_translate: false,
  availability: 'public' as const,
  publish_mode: 'live' as const,
});

// ---- Tests ----

describe('useListingEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockGetListingResult.data = null;
    mockGetListingResult.isLoading = false;
    mockGetListingResult.isFetching = false;
    mockGetListingResult.error = null;
  });

  it('skips query when ideaId is null', () => {
    const { result } = renderHook(() =>
      useListingEditor({
        ideaId: null,
        designId: null,
        marketplaceType: 'mba',
      }),
    );
    expect(result.current.listing).toBeNull();
    expect(result.current.listingNotFound).toBe(false);
  });

  it('exposes listing when loaded', () => {
    mockGetListingResult.data = makeListing();
    const { result } = renderHook(() =>
      useListingEditor({
        ideaId: 'idea-1',
        designId: 'design-1',
        marketplaceType: 'mba',
      }),
    );
    expect(result.current.listing?.id).toBe('listing-mba-1');
    expect(result.current.listing?.marketplace_type).toBe('mba');
  });

  it('reports notFound on 404 error', () => {
    mockGetListingResult.error = { status: 404, data: {} };
    const { result } = renderHook(() =>
      useListingEditor({
        ideaId: 'idea-1',
        designId: 'design-1',
        marketplaceType: 'global',
      }),
    );
    expect(result.current.listingNotFound).toBe(true);
    expect(result.current.listingError).toBeNull();
  });

  it('reports hard error on non-404', () => {
    mockGetListingResult.error = { status: 500, data: {} };
    const { result } = renderHook(() =>
      useListingEditor({
        ideaId: 'idea-1',
        designId: 'design-1',
        marketplaceType: 'mba',
      }),
    );
    expect(result.current.listingNotFound).toBe(false);
    expect(result.current.listingError).toEqual({ status: 500, data: {} });
  });

  it('handleGenerate passes marketplaceType to API', async () => {
    mockGenerateMutation.mockReturnValue({
      unwrap: () => Promise.resolve(makeListing({ marketplace_type: 'global' })),
    });
    const { result } = renderHook(() =>
      useListingEditor({
        ideaId: 'idea-1',
        designId: 'design-1',
        marketplaceType: 'global',
      }),
    );
    await act(async () => {
      await result.current.handleGenerate({ extraKeywords: 'summer' });
    });
    expect(mockGenerateMutation).toHaveBeenCalledWith({
      ideaId: 'idea-1',
      body: {
        design_id: 'design-1',
        extra_keywords: 'summer',
        language: undefined,
        marketplace_type: 'global',
      },
    });
  });

  it('handleGenerate shows duplicate warning on 409', async () => {
    mockGenerateMutation.mockReturnValue({
      unwrap: () => Promise.reject({ status: 409 }),
    });
    const { result } = renderHook(() =>
      useListingEditor({
        ideaId: 'idea-1',
        designId: 'design-1',
        marketplaceType: 'mba',
      }),
    );
    await act(async () => {
      const out = await result.current.handleGenerate();
      expect(out).toBeNull();
    });
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
      expect.stringContaining('already exists'),
      { variant: 'warning' },
    );
  });

  it('handleSave serializes form values and calls updateListing', async () => {
    mockGetListingResult.data = makeListing();
    mockUpdateMutation.mockReturnValue({
      unwrap: () => Promise.resolve(makeListing({ title: 'Updated' })),
    });
    const { result } = renderHook(() =>
      useListingEditor({
        ideaId: 'idea-1',
        designId: 'design-1',
        marketplaceType: 'mba',
      }),
    );
    await act(async () => {
      const updated = await result.current.handleSave(makeFormValues());
      expect(updated?.title).toBe('Updated');
    });
    expect(mockUpdateMutation).toHaveBeenCalledWith({
      id: 'listing-mba-1',
      body: expect.objectContaining({
        brand_name: 'BrandX',
        title: 'Title A',
        backend_keywords: 'cat, vintage',
        availability: 'public',
        publish_mode: 'live',
      }),
    });
  });

  it('handleSave warns when no listing loaded', async () => {
    const { result } = renderHook(() =>
      useListingEditor({
        ideaId: 'idea-1',
        designId: 'design-1',
        marketplaceType: 'mba',
      }),
    );
    await act(async () => {
      const out = await result.current.handleSave(makeFormValues());
      expect(out).toBeNull();
    });
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
      expect.stringContaining('Generate a listing'),
      { variant: 'warning' },
    );
    expect(mockUpdateMutation).not.toHaveBeenCalled();
  });

  it('scheduleAutoSave debounces and calls updateListing', async () => {
    mockGetListingResult.data = makeListing();
    mockUpdateMutation.mockReturnValue({
      unwrap: () => Promise.resolve(makeListing({ title: 'auto' })),
    });
    const { result } = renderHook(() =>
      useListingEditor({
        ideaId: 'idea-1',
        designId: 'design-1',
        marketplaceType: 'mba',
      }),
    );

    act(() => {
      result.current.scheduleAutoSave(makeFormValues());
    });
    expect(mockUpdateMutation).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(mockUpdateMutation).toHaveBeenCalledTimes(1);
  });

  it('cancelAutoSave prevents pending save', async () => {
    mockGetListingResult.data = makeListing();
    const { result } = renderHook(() =>
      useListingEditor({
        ideaId: 'idea-1',
        designId: 'design-1',
        marketplaceType: 'mba',
      }),
    );

    act(() => {
      result.current.scheduleAutoSave(makeFormValues());
      result.current.cancelAutoSave();
    });

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(mockUpdateMutation).not.toHaveBeenCalled();
  });

  it('scheduleAutoSave skips when no listing loaded', () => {
    mockGetListingResult.data = null;
    const { result } = renderHook(() =>
      useListingEditor({
        ideaId: 'idea-1',
        designId: 'design-1',
        marketplaceType: 'mba',
      }),
    );
    act(() => {
      result.current.scheduleAutoSave(makeFormValues());
    });
    vi.advanceTimersByTime(2000);
    expect(mockUpdateMutation).not.toHaveBeenCalled();
  });

  it('handleTranslate calls translate mutation with target listing id', async () => {
    mockGetListingResult.data = makeListing();
    mockTranslateMutation.mockReturnValue({
      unwrap: () => Promise.resolve({}),
    });
    const { result } = renderHook(() =>
      useListingEditor({
        ideaId: 'idea-1',
        designId: 'design-1',
        marketplaceType: 'mba',
      }),
    );
    await act(async () => {
      await result.current.handleTranslate(['de', 'fr']);
    });
    expect(mockTranslateMutation).toHaveBeenCalledWith({
      id: 'listing-mba-1',
      body: { target_languages: ['de', 'fr'] },
    });
  });

  it('handleTMCheck surfaces clean result', async () => {
    mockGetListingResult.data = makeListing();
    mockTmCheckMutation.mockReturnValue({
      unwrap: () => Promise.resolve({ is_clean: true, flagged_terms: [] }),
    });
    const { result } = renderHook(() =>
      useListingEditor({
        ideaId: 'idea-1',
        designId: 'design-1',
        marketplaceType: 'mba',
      }),
    );
    await act(async () => {
      const out = await result.current.handleTMCheck();
      expect(out?.is_clean).toBe(true);
    });
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
      expect.stringContaining('passed'),
      { variant: 'success' },
    );
  });
});
