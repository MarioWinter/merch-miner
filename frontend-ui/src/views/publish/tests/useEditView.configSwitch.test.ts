import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import type { DesignAsset, Listing } from '../types';

// ---------------------------------------------------------------------------
// Integration test — switching marketplace tab + switching active design
// should drive useGetProductConfigQuery to be called with the freshly
// selected (designId, marketplace_type) pair. We spy on the query hook
// itself and inspect the last args on each re-render.
// Mocks mirror useEditView.copy.test.ts patterns (flat, no importOriginal).
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

// Spy we interrogate after each state change. Captures full arg tuple so we
// can assert on both positional args (query args + options).
const mockGetProductConfigQuery = vi.fn(() => ({
  data: {
    id: 'cfg-1',
    design: 'design-1',
    marketplace_type: 'mba',
    products_config: [],
    created_at: '',
    updated_at: '',
  },
  isLoading: false,
  isFetching: false,
  error: null,
}));

const mockListGallery = vi.fn();

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

const defaultDesigns: DesignAsset[] = [
  makeDesign({ id: 'design-1', idea: 'idea-1' }),
  makeDesign({ id: 'design-2', idea: 'idea-2' }),
];

vi.mock('@/store/publishSlice', () => ({
  useListGalleryQuery: () => mockListGallery(),
  useLazyGetListingQuery: () => [vi.fn(), { isLoading: false }],
  useCopyProductConfigFromMutation: () => [vi.fn(), { isLoading: false }],
  useGetListingQuery: () => ({
    data: makeListing(),
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  }),
  useUpdateListingMutation: () => [vi.fn(), { isLoading: false }],
  useTranslateListingMutation: () => [vi.fn(), { isLoading: false }],
  useLazyExportListingQuery: () => [vi.fn(), { isLoading: false }],
  useConvertListingMutation: () => [vi.fn(), { isLoading: false }],
  useGetProductConfigQuery: (...args: unknown[]) =>
    mockGetProductConfigQuery(...(args as [])),
  useUpdateProductConfigMutation: () => [vi.fn(), { isLoading: false }],
  // Phase O2 — useEditFormState wiring
  useAiImproveListingMutation: () => [vi.fn(), { isLoading: false }],
  useGetMbaProductCatalogQuery: () => ({ data: [], isLoading: false }),
}));

// Phase O4 — useEditFormState reads user + workspace ids from Redux to
// scope the offline-queue storage key. Stub the typed hook so these
// tests don't need a real Provider.
vi.mock('@/store/hooks', () => ({
  useAppSelector: (
    selector: (state: {
      auth: { user: { id: number } | null };
      workspace: { activeWorkspaceId: string | null };
    }) => unknown,
  ) =>
    selector({
      auth: { user: { id: 1 } },
      workspace: { activeWorkspaceId: 'ws-test' },
    }),
}));

import { useEditView } from '../hooks/useEditView';

// ---------------------------------------------------------------------------
// Harness — ?designs=design-1,design-2 so `designs[]` has both. activeIndex
// starts at 0 ("design-1"), activeMarketplace starts at 'mba'.
// ---------------------------------------------------------------------------

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(
    MemoryRouter,
    { initialEntries: ['/publish/edit?designs=design-1,design-2'] },
    children,
  );

// Pull the query-args tuple from the LAST call to the spy. RTK signature:
// useGetProductConfigQuery(args, options) — we only care about args[0].
const lastQueryArgs = () => {
  const calls = mockGetProductConfigQuery.mock.calls;
  if (calls.length === 0) return null;
  const last = calls[calls.length - 1] as unknown as [
    { designId: string; marketplace_type: string },
    { skip?: boolean } | undefined,
  ];
  return last[0];
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useEditView — product config query re-keys on tab/design switch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListGallery.mockReturnValue({
      data: { results: defaultDesigns, count: defaultDesigns.length },
      isLoading: false,
    });
  });

  it('initial render queries product config for (design-1, mba)', () => {
    renderHook(() => useEditView(), { wrapper });

    // useGetProductConfigQuery was called at least once during mount.
    expect(mockGetProductConfigQuery).toHaveBeenCalled();
    expect(lastQueryArgs()).toEqual({
      designId: 'design-1',
      marketplace_type: 'mba',
    });
  });

  it('switching marketplace tab re-queries with the new marketplace_type', () => {
    const { result } = renderHook(() => useEditView(), { wrapper });

    // Baseline: mba.
    expect(lastQueryArgs()).toEqual({
      designId: 'design-1',
      marketplace_type: 'mba',
    });

    // Tab switch — public setter on the hook drives activeMarketplace state.
    act(() => {
      result.current.setActiveMarketplace('global');
    });

    expect(lastQueryArgs()).toEqual({
      designId: 'design-1',
      marketplace_type: 'global',
    });

    // Another switch to displate re-keys again.
    act(() => {
      result.current.setActiveMarketplace('displate');
    });

    expect(lastQueryArgs()).toEqual({
      designId: 'design-1',
      marketplace_type: 'displate',
    });
  });

  it('switching active design re-queries with the new designId', () => {
    const { result } = renderHook(() => useEditView(), { wrapper });

    // Baseline: design-1.
    expect(lastQueryArgs()).toEqual({
      designId: 'design-1',
      marketplace_type: 'mba',
    });

    // Switch to second design (index 1) — activeIndex setter drives the
    // `activeDesign` memo which feeds into useProductConfig args.
    act(() => {
      result.current.setActiveIndex(1);
    });

    expect(lastQueryArgs()).toEqual({
      designId: 'design-2',
      marketplace_type: 'mba',
    });
  });

  it('combined switch (design + marketplace) re-keys on each change', () => {
    const { result } = renderHook(() => useEditView(), { wrapper });

    act(() => {
      result.current.setActiveIndex(1);
    });
    expect(lastQueryArgs()).toEqual({
      designId: 'design-2',
      marketplace_type: 'mba',
    });

    act(() => {
      result.current.setActiveMarketplace('global');
    });
    expect(lastQueryArgs()).toEqual({
      designId: 'design-2',
      marketplace_type: 'global',
    });
  });
});
