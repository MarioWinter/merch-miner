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

import { renderWithProviders } from '../../../../utils/test-utils';
import { BackgroundColorPicker } from '../partials/BackgroundColorPicker';


afterEach(() => {
  vi.clearAllMocks();
});

describe('BackgroundColorPicker', () => {
  it('renders all three color options', () => {
    renderWithProviders(
      <BackgroundColorPicker value="light_gray" onChange={vi.fn()} />,
    );
    expect(screen.getByLabelText('Light Gray')).toBeInTheDocument();
    expect(screen.getByLabelText('Neon Pink')).toBeInTheDocument();
    expect(screen.getByLabelText('Neon Green')).toBeInTheDocument();
  });

  it('renders label text', () => {
    renderWithProviders(
      <BackgroundColorPicker value="light_gray" onChange={vi.fn()} />,
    );
    expect(screen.getByText('Background Color')).toBeInTheDocument();
  });

  it('has light_gray selected by default', () => {
    renderWithProviders(
      <BackgroundColorPicker value="light_gray" onChange={vi.fn()} />,
    );
    const lightGrayBtn = screen.getByLabelText('Light Gray');
    expect(lightGrayBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls onChange with neon_pink when selected', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <BackgroundColorPicker value="light_gray" onChange={onChange} />,
    );
    fireEvent.click(screen.getByLabelText('Neon Pink'));
    expect(onChange).toHaveBeenCalledWith('neon_pink');
  });

  it('calls onChange with neon_green when selected', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <BackgroundColorPicker value="light_gray" onChange={onChange} />,
    );
    fireEvent.click(screen.getByLabelText('Neon Green'));
    expect(onChange).toHaveBeenCalledWith('neon_green');
  });

  it('shows neon_pink as pressed when value is neon_pink', () => {
    renderWithProviders(
      <BackgroundColorPicker value="neon_pink" onChange={vi.fn()} />,
    );
    const pinkBtn = screen.getByLabelText('Neon Pink');
    expect(pinkBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('disables all buttons when disabled prop is true', () => {
    renderWithProviders(
      <BackgroundColorPicker value="light_gray" onChange={vi.fn()} disabled />,
    );
    expect(screen.getByLabelText('Light Gray')).toBeDisabled();
    expect(screen.getByLabelText('Neon Pink')).toBeDisabled();
    expect(screen.getByLabelText('Neon Green')).toBeDisabled();
  });

  it('does not call onChange when disabled', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <BackgroundColorPicker value="light_gray" onChange={onChange} disabled />,
    );
    fireEvent.click(screen.getByLabelText('Neon Pink'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('has accessible group label', () => {
    renderWithProviders(
      <BackgroundColorPicker value="light_gray" onChange={vi.fn()} />,
    );
    expect(screen.getByRole('group', { name: /background color/i })).toBeInTheDocument();
  });
});
