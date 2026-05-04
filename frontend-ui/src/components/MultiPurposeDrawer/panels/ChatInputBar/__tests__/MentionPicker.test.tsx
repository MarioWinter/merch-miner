/**
 * PROJ-20 Phase 3.3 — MentionPicker tests
 *
 * Strategy: render the picker directly with stable props (no useMentionTrigger).
 * The Floating-UI portal mounts into document.body; we query by testid.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import MentionPicker, {
  type MentionPickerNiche,
} from '../partials/MentionPicker';

const niches: MentionPickerNiche[] = [
  { id: 'n-1', name: 'Halloween', slug: 'halloween' },
  { id: 'n-2', name: 'Christmas', slug: 'christmas' },
  { id: 'n-3', name: 'Easter', slug: 'easter' },
];

const baseRect = new DOMRect(100, 200, 0, 20);

const baseProps = {
  open: true,
  anchorRect: baseRect,
  query: '',
  niches,
  activeIndex: 0,
  isLoading: false,
  onSelect: vi.fn(),
  onClose: vi.fn(),
  onCreateNiche: vi.fn(),
  onHoverIndex: vi.fn(),
};

describe('MentionPicker (PROJ-20 Phase 3.3)', () => {
  it('renders nothing when closed', () => {
    renderWithProviders(<MentionPicker {...baseProps} open={false} />);
    expect(screen.queryByTestId('mention-picker')).not.toBeInTheDocument();
  });

  it('renders all niches when open with no query', () => {
    renderWithProviders(<MentionPicker {...baseProps} />);
    expect(screen.getByTestId('mention-picker')).toBeInTheDocument();
    expect(screen.getByText('Halloween')).toBeInTheDocument();
    expect(screen.getByText('Christmas')).toBeInTheDocument();
    expect(screen.getByText('Easter')).toBeInTheDocument();
  });

  it('highlights the active row via aria-selected and data-testid', () => {
    renderWithProviders(<MentionPicker {...baseProps} activeIndex={1} />);
    const row1 = screen.getByTestId('mention-picker-row-1');
    expect(row1).toHaveAttribute('aria-selected', 'true');
    const row0 = screen.getByTestId('mention-picker-row-0');
    expect(row0).toHaveAttribute('aria-selected', 'false');
  });

  it('calls onSelect when a row is clicked', () => {
    const onSelect = vi.fn();
    renderWithProviders(
      <MentionPicker {...baseProps} onSelect={onSelect} />,
    );
    fireEvent.click(screen.getByTestId('mention-picker-row-1'));
    expect(onSelect).toHaveBeenCalledWith(niches[1]);
  });

  it('calls onHoverIndex when a row is hovered', () => {
    const onHoverIndex = vi.fn();
    renderWithProviders(
      <MentionPicker {...baseProps} onHoverIndex={onHoverIndex} />,
    );
    fireEvent.mouseEnter(screen.getByTestId('mention-picker-row-2'));
    expect(onHoverIndex).toHaveBeenCalledWith(2);
  });

  it('shows loading state with spinner when isLoading=true', () => {
    renderWithProviders(
      <MentionPicker {...baseProps} isLoading niches={[]} />,
    );
    expect(screen.getByTestId('mention-picker-loading')).toBeInTheDocument();
  });

  it('shows empty state with query when no matches', () => {
    renderWithProviders(
      <MentionPicker {...baseProps} niches={[]} query="zzz" />,
    );
    expect(screen.getByTestId('mention-picker-empty')).toBeInTheDocument();
    expect(screen.getByText(/zzz/)).toBeInTheDocument();
  });

  it('shows no-niches state with create CTA when no query AND no niches', () => {
    renderWithProviders(
      <MentionPicker {...baseProps} niches={[]} query="" />,
    );
    expect(screen.getByTestId('mention-picker-no-niches')).toBeInTheDocument();
    expect(screen.getByTestId('mention-picker-create-niche')).toBeInTheDocument();
  });

  it('calls onCreateNiche when CTA is clicked in empty no-niches state', () => {
    const onCreateNiche = vi.fn();
    renderWithProviders(
      <MentionPicker
        {...baseProps}
        niches={[]}
        query=""
        onCreateNiche={onCreateNiche}
      />,
    );
    fireEvent.click(screen.getByTestId('mention-picker-create-niche'));
    expect(onCreateNiche).toHaveBeenCalled();
  });

  it('Escape key on the picker calls onClose', () => {
    const onClose = vi.fn();
    renderWithProviders(<MentionPicker {...baseProps} onClose={onClose} />);
    fireEvent.keyDown(screen.getByTestId('mention-picker'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('renders slug under the niche name', () => {
    renderWithProviders(<MentionPicker {...baseProps} />);
    expect(screen.getByText('@halloween')).toBeInTheDocument();
  });
});
