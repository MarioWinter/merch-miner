import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';

/* eslint-disable @typescript-eslint/no-explicit-any */
const { fa } = vi.hoisted(() => ({
  fa: (n: string) => ({ reducerPath: n, reducer: () => ({}), middleware: () => (x: any) => (a: any) => x(a), util: { resetApiState: () => ({ type: 'noop' }) } }),
}));
vi.mock('@/store/nicheSlice', () => ({ nicheApi: fa('nicheApi'), useListNichesQuery: () => ({ data: { results: [] }, isLoading: false }) }));
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
vi.mock('@/store/collectedProductsSlice', () => ({ collectedProductsApi: fa('collectedProductsApi') }));

import { renderWithProviders } from '../../../utils/test-utils';
import { InlineAddBar } from '../partials/InlineAddBar';
import type { UseIdeaInlineAddReturn } from '../hooks/useInlineAdd';

const makeInlineAdd = (
  overrides?: Partial<UseIdeaInlineAddReturn>,
): UseIdeaInlineAddReturn => ({
  isActive: false,
  isCreating: false,
  error: null,
  activate: vi.fn(),
  cancel: vi.fn(),
  submit: vi.fn(),
  ...overrides,
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('InlineAddBar', () => {
  it('renders inactive state with placeholder text', () => {
    renderWithProviders(<InlineAddBar inlineAdd={makeInlineAdd()} />);
    expect(screen.getByText('Add new slogan...')).toBeInTheDocument();
  });

  it('calls activate on click in inactive state', () => {
    const activate = vi.fn();
    renderWithProviders(
      <InlineAddBar inlineAdd={makeInlineAdd({ activate })} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add new slogan...' }));
    expect(activate).toHaveBeenCalledOnce();
  });

  it('renders text field when active', () => {
    renderWithProviders(
      <InlineAddBar inlineAdd={makeInlineAdd({ isActive: true })} />,
    );
    expect(
      screen.getByPlaceholderText('Add new slogan...'),
    ).toBeInTheDocument();
  });

  it('renders Add button when active', () => {
    renderWithProviders(
      <InlineAddBar inlineAdd={makeInlineAdd({ isActive: true })} />,
    );
    expect(screen.getByText('New Idea')).toBeInTheDocument();
  });

  it('renders cancel button when active', () => {
    renderWithProviders(
      <InlineAddBar inlineAdd={makeInlineAdd({ isActive: true })} />,
    );
    expect(screen.getByLabelText('Cancel')).toBeInTheDocument();
  });

  it('shows error text when error is set', () => {
    renderWithProviders(
      <InlineAddBar
        inlineAdd={makeInlineAdd({
          isActive: true,
          error: 'Failed to create idea',
        })}
      />,
    );
    expect(screen.getByText('Failed to create idea')).toBeInTheDocument();
  });

  it('shows batch hint helper text when no error', () => {
    renderWithProviders(
      <InlineAddBar inlineAdd={makeInlineAdd({ isActive: true })} />,
    );
    expect(
      screen.getByText(
        'Shift+Enter for new line. Each line creates a separate idea.',
      ),
    ).toBeInTheDocument();
  });

  it('disables Add button when text is empty', () => {
    renderWithProviders(
      <InlineAddBar inlineAdd={makeInlineAdd({ isActive: true })} />,
    );
    const addBtn = screen.getByText('New Idea').closest('button');
    expect(addBtn).toBeDisabled();
  });

  it('disables text field when isCreating is true', () => {
    renderWithProviders(
      <InlineAddBar
        inlineAdd={makeInlineAdd({ isActive: true, isCreating: true })}
      />,
    );
    const input = screen.getByPlaceholderText('Add new slogan...');
    expect(input).toBeDisabled();
  });
});
