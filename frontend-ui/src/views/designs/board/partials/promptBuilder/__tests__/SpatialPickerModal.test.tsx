// PROJ-34 Phase 13f.1 — SpatialPickerModal unit tests.
// Covers: 36-card render, label-substring search filter, description-substring
// search filter, empty-state Custom tab, populated Custom tab, commit lifecycle.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/* eslint-disable @typescript-eslint/no-explicit-any */
const { fa, mockListCustom } = vi.hoisted(() => ({
  fa: (n: string) => ({
    reducerPath: n,
    reducer: () => ({}),
    middleware: () => (x: any) => (a: any) => x(a),
    util: { resetApiState: () => ({ type: 'noop' }) },
  }),
  mockListCustom: vi.fn(),
}));

vi.mock('@/store/nicheSlice', () => ({
  nicheApi: fa('nicheApi'),
  useListNichesQuery: () => ({ data: { results: [] }, isLoading: false }),
}));
vi.mock('@/store/ideaSlice', () => ({ ideaApi: fa('ideaApi') }));
vi.mock('@/store/researchSlice', () => ({ researchApi: fa('researchApi') }));
vi.mock('@/store/designSlice', () => ({
  designApi: fa('designApi'),
  useListCustomSpatialsQuery: mockListCustom,
}));
vi.mock('@/store/keywordSlice', () => ({ keywordApi: fa('keywordApi') }));
vi.mock('@/store/publishSlice', () => ({ publishApi: fa('publishApi') }));
vi.mock('@/store/dashboardSlice', () => ({ dashboardApi: fa('dashboardApi') }));
vi.mock('@/store/kanbanSlice', () => ({ kanbanApi: fa('kanbanApi') }));
vi.mock('@/store/notificationSlice', () => ({ notificationApi: fa('notificationApi') }));
vi.mock('@/store/searchSlice', () => ({ searchApi: fa('searchApi') }));
vi.mock('@/store/agentSlice', () => ({ agentApi: fa('agentApi') }));
vi.mock('@/store/collectedProductsSlice', () => ({
  collectedProductsApi: fa('collectedProductsApi'),
}));

import { renderWithProviders } from '@/utils/test-utils';
import SpatialPickerModal from '../SpatialPickerModal';
import { SPATIAL_OPTIONS } from '../../../constants/slotOptions';

afterEach(() => {
  vi.clearAllMocks();
  mockListCustom.mockReset();
});

const baseProps = {
  open: true,
  onClose: vi.fn(),
  value: undefined,
  onChange: vi.fn(),
};

describe('SpatialPickerModal', () => {
  it('renders all 36 built-in spatial cards on the Built-in tab', () => {
    mockListCustom.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<SpatialPickerModal {...baseProps} />);
    // Every entry's ui_label is unique in the SPATIAL_OPTIONS list, so each
    // card produces exactly one matching text node.
    SPATIAL_OPTIONS.forEach((entry) => {
      expect(screen.getByText(entry.ui_label)).toBeInTheDocument();
    });
  });

  it('search filters cards by ui_label substring', async () => {
    mockListCustom.mockReturnValue({ data: [], isLoading: false });
    const user = userEvent.setup();
    renderWithProviders(<SpatialPickerModal {...baseProps} />);

    const searchBox = screen.getByLabelText('Search spatial layouts');
    await user.type(searchBox, 'Hexagon');

    // Only the Hexagon Medallion card should remain.
    expect(screen.getByText('Hexagon Medallion')).toBeInTheDocument();
    expect(screen.queryByText('Vertical Stack')).not.toBeInTheDocument();
  });

  it('search filters cards by ui_description substring', async () => {
    mockListCustom.mockReturnValue({ data: [], isLoading: false });
    const user = userEvent.setup();
    renderWithProviders(<SpatialPickerModal {...baseProps} />);

    const searchBox = screen.getByLabelText('Search spatial layouts');
    // "perforated" only appears in the Postage Stamp description.
    await user.type(searchBox, 'perforated');

    expect(screen.getByText('Postage Stamp')).toBeInTheDocument();
    expect(screen.queryByText('Vertical Stack')).not.toBeInTheDocument();
  });

  it('Custom tab shows the empty state when the list query returns []', async () => {
    mockListCustom.mockReturnValue({ data: [], isLoading: false });
    const user = userEvent.setup();
    renderWithProviders(<SpatialPickerModal {...baseProps} />);

    await user.click(screen.getByRole('tab', { name: /Custom \(0\)/ }));
    expect(
      screen.getByText(/haven't created any custom spatial layouts yet/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Create your first/i }),
    ).toBeInTheDocument();
  });

  it('Custom tab renders entries when the list query returns rows', async () => {
    mockListCustom.mockReturnValue({
      data: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          name: 'My retro grid',
          prompt_text: 'Retro grid arrangement…',
          source_kind: 'upload',
          source_image_ref: '',
          is_unsafe: false,
          created_at: '2026-05-18T00:00:00Z',
          updated_at: '2026-05-18T00:00:00Z',
        },
      ],
      isLoading: false,
    });
    const user = userEvent.setup();
    renderWithProviders(<SpatialPickerModal {...baseProps} />);

    await user.click(screen.getByRole('tab', { name: /Custom \(1\)/ }));
    expect(screen.getByText('My retro grid')).toBeInTheDocument();
  });

  it('commits selection via the "Use selection" button and closes', async () => {
    mockListCustom.mockReturnValue({ data: [], isLoading: false });
    const onChange = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <SpatialPickerModal
        {...baseProps}
        onChange={onChange}
        onClose={onClose}
      />,
    );

    // Click the first built-in card.
    const firstCard = screen
      .getByRole('button', { name: `Select ${SPATIAL_OPTIONS[0].ui_label}` });
    fireEvent.click(firstCard);

    // The check overlay only appears for the selected card.
    const useBtn = screen.getByRole('button', { name: /Use selection/i });
    expect(useBtn).toBeEnabled();
    await user.click(useBtn);

    expect(onChange).toHaveBeenCalledWith(SPATIAL_OPTIONS[0].id);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('"Use selection" button stays disabled while no card differs from the value', () => {
    mockListCustom.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<SpatialPickerModal {...baseProps} />);
    expect(screen.getByRole('button', { name: /Use selection/i })).toBeDisabled();
  });

  it('renders 36 cards but the tabs label confirms the built-in count', () => {
    mockListCustom.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<SpatialPickerModal {...baseProps} />);
    const builtinTab = screen.getByRole('tab', { name: /Built-in \(36\)/ });
    expect(within(builtinTab).getByText(/Built-in \(36\)/)).toBeInTheDocument();
  });
});
