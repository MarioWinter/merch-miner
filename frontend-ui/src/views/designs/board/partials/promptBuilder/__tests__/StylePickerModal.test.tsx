// PROJ-34 Phase 13f.2 — StylePickerModal unit tests.
// Covers: 15-card render, multi-select toggle add+remove, footer count badge,
// and commit-callback shape (array of slugs).

import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/* eslint-disable @typescript-eslint/no-explicit-any */
const { fa } = vi.hoisted(() => ({
  fa: (n: string) => ({
    reducerPath: n,
    reducer: () => ({}),
    middleware: () => (x: any) => (a: any) => x(a),
    util: { resetApiState: () => ({ type: 'noop' }) },
  }),
}));
vi.mock('@/store/nicheSlice', () => ({
  nicheApi: fa('nicheApi'),
  useListNichesQuery: () => ({ data: { results: [] }, isLoading: false }),
}));
vi.mock('@/store/ideaSlice', () => ({ ideaApi: fa('ideaApi') }));
vi.mock('@/store/researchSlice', () => ({ researchApi: fa('researchApi') }));
vi.mock('@/store/designSlice', () => ({ designApi: fa('designApi') }));
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
import StylePickerModal from '../StylePickerModal';
import { STYLE_LIBRARY } from '../../../constants/styleLibrary';

afterEach(() => {
  vi.clearAllMocks();
});

const baseProps = {
  open: true,
  onClose: vi.fn(),
  selectedSlugs: [] as string[],
  onChange: vi.fn(),
};

describe('StylePickerModal', () => {
  it('renders all 16 style cards', () => {
    // Phase 13r added comic_book → 16 styles
    renderWithProviders(<StylePickerModal {...baseProps} />);
    expect(STYLE_LIBRARY.length).toBe(16);
    STYLE_LIBRARY.forEach((entry) => {
      // Each card exposes the label inside its CardActionArea aria-label.
      expect(
        screen.getByRole('button', { name: `Toggle ${entry.label}` }),
      ).toBeInTheDocument();
    });
  });

  it('toggling a card adds it to the local selection (footer count grows)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<StylePickerModal {...baseProps} />);

    // Footer starts at 0 selected
    expect(
      screen.getByRole('button', { name: /Use 0 selected/i }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: `Toggle ${STYLE_LIBRARY[0].label}` }),
    );
    expect(
      screen.getByRole('button', { name: /Use 1 selected/i }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: `Toggle ${STYLE_LIBRARY[1].label}` }),
    );
    expect(
      screen.getByRole('button', { name: /Use 2 selected/i }),
    ).toBeInTheDocument();
  });

  it('toggling an already-selected card removes it (count shrinks)', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <StylePickerModal {...baseProps} selectedSlugs={[STYLE_LIBRARY[0].slug]} />,
    );
    expect(
      screen.getByRole('button', { name: /Use 1 selected/i }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: `Toggle ${STYLE_LIBRARY[0].label}` }),
    );
    expect(
      screen.getByRole('button', { name: /Use 0 selected/i }),
    ).toBeInTheDocument();
  });

  it('commit fires onChange with the array of slugs and closes', async () => {
    const onChange = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <StylePickerModal
        {...baseProps}
        onChange={onChange}
        onClose={onClose}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: `Toggle ${STYLE_LIBRARY[2].label}` }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: `Toggle ${STYLE_LIBRARY[5].label}` }),
    );

    await user.click(screen.getByRole('button', { name: /Use 2 selected/i }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const arg = onChange.mock.calls[0][0];
    expect(Array.isArray(arg)).toBe(true);
    expect(arg).toEqual([STYLE_LIBRARY[2].slug, STYLE_LIBRARY[5].slug]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('commit button stays disabled when selection is unchanged', () => {
    renderWithProviders(
      <StylePickerModal
        {...baseProps}
        selectedSlugs={[STYLE_LIBRARY[0].slug]}
      />,
    );
    expect(
      screen.getByRole('button', { name: /Use 1 selected/i }),
    ).toBeDisabled();
  });
});
