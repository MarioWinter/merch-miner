import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../../utils/test-utils';
import { AdaptationModal } from '../partials/AdaptationModal';
import { makeIdea, makeSuggestion } from './fixtures';

// Mock useNicheSuggestions hook
const mockAutoSelectTop5 = vi.fn(() => ['niche-2', 'niche-3']);
vi.mock('../hooks/useNicheSuggestions', () => ({
  useNicheSuggestions: () => ({
    suggestions: [
      {
        niche_id: 'niche-2',
        niche_name: 'Cat Lovers',
        compatibility_score: 85,
        shared_patterns: ['Metaphor'],
        already_adapted: false,
      },
      {
        niche_id: 'niche-3',
        niche_name: 'Bird Watchers',
        compatibility_score: 72,
        shared_patterns: [],
        already_adapted: false,
      },
    ],
    isLoading: false,
    availableNiches: [
      makeSuggestion({ niche_id: 'niche-2', niche_name: 'Cat Lovers' }),
      makeSuggestion({ niche_id: 'niche-3', niche_name: 'Bird Watchers' }),
    ],
    autoSelectTop5: mockAutoSelectTop5,
  }),
}));

// Mock NicheSuggestionList
vi.mock('../partials/NicheSuggestionList', () => ({
  NicheSuggestionList: ({
    suggestions,
    onToggle,
  }: {
    suggestions: { niche_id: string; niche_name: string }[];
    selectedIds: Set<string>;
    onToggle: (id: string) => void;
    isLoading: boolean;
  }) => (
    <div data-testid="niche-suggestion-list">
      {suggestions.map((s) => (
        <button key={s.niche_id} onClick={() => onToggle(s.niche_id)}>
          {s.niche_name}
        </button>
      ))}
    </div>
  ),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('AdaptationModal', () => {
  const sourceIdea = makeIdea({ slogan_text: 'Adapt this slogan' });

  it('does not render when closed', () => {
    renderWithProviders(
      <AdaptationModal
        open={false}
        onClose={vi.fn()}
        sourceIdea={sourceIdea}
        onConfirm={vi.fn()}
        isTriggering={false}
      />,
    );
    expect(screen.queryByText('Select Target Niches')).not.toBeInTheDocument();
  });

  it('renders dialog title when open', () => {
    renderWithProviders(
      <AdaptationModal
        open={true}
        onClose={vi.fn()}
        sourceIdea={sourceIdea}
        onConfirm={vi.fn()}
        isTriggering={false}
      />,
    );
    expect(screen.getByText('Select Target Niches')).toBeInTheDocument();
  });

  it('shows source slogan text', () => {
    renderWithProviders(
      <AdaptationModal
        open={true}
        onClose={vi.fn()}
        sourceIdea={sourceIdea}
        onConfirm={vi.fn()}
        isTriggering={false}
      />,
    );
    expect(screen.getByText(/Adapt this slogan/)).toBeInTheDocument();
  });

  it('shows niche suggestion list', () => {
    renderWithProviders(
      <AdaptationModal
        open={true}
        onClose={vi.fn()}
        sourceIdea={sourceIdea}
        onConfirm={vi.fn()}
        isTriggering={false}
      />,
    );
    expect(screen.getByTestId('niche-suggestion-list')).toBeInTheDocument();
  });

  it('shows auto-select button', () => {
    renderWithProviders(
      <AdaptationModal
        open={true}
        onClose={vi.fn()}
        sourceIdea={sourceIdea}
        onConfirm={vi.fn()}
        isTriggering={false}
      />,
    );
    expect(screen.getByText('Auto-Select Top 5')).toBeInTheDocument();
  });

  it('shows no research warning when suggestions lack shared_patterns', () => {
    renderWithProviders(
      <AdaptationModal
        open={true}
        onClose={vi.fn()}
        sourceIdea={sourceIdea}
        onConfirm={vi.fn()}
        isTriggering={false}
      />,
    );
    expect(
      screen.getByText(/Some niches have no research data/),
    ).toBeInTheDocument();
  });

  it('disables confirm button when no niches selected', () => {
    renderWithProviders(
      <AdaptationModal
        open={true}
        onClose={vi.fn()}
        sourceIdea={sourceIdea}
        onConfirm={vi.fn()}
        isTriggering={false}
      />,
    );
    const confirmBtn = screen.getByText(/Adapt \(0\)/).closest('button');
    expect(confirmBtn).toBeDisabled();
  });

  it('enables confirm button after selecting a niche', () => {
    renderWithProviders(
      <AdaptationModal
        open={true}
        onClose={vi.fn()}
        sourceIdea={sourceIdea}
        onConfirm={vi.fn()}
        isTriggering={false}
      />,
    );
    // Select a niche via the mocked suggestion list
    fireEvent.click(screen.getByText('Cat Lovers'));
    const confirmBtn = screen.getByText(/Adapt \(1\)/).closest('button');
    expect(confirmBtn).not.toBeDisabled();
  });

  it('calls onConfirm with selected niche IDs', () => {
    const onConfirm = vi.fn();
    renderWithProviders(
      <AdaptationModal
        open={true}
        onClose={vi.fn()}
        sourceIdea={sourceIdea}
        onConfirm={onConfirm}
        isTriggering={false}
      />,
    );
    fireEvent.click(screen.getByText('Cat Lovers'));
    fireEvent.click(screen.getByText(/Adapt \(1\)/).closest('button')!);
    expect(onConfirm).toHaveBeenCalledWith(['niche-2']);
  });

  it('calls onClose when cancel clicked', () => {
    const onClose = vi.fn();
    renderWithProviders(
      <AdaptationModal
        open={true}
        onClose={onClose}
        sourceIdea={sourceIdea}
        onConfirm={vi.fn()}
        isTriggering={false}
      />,
    );
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('disables buttons when isTriggering is true', () => {
    renderWithProviders(
      <AdaptationModal
        open={true}
        onClose={vi.fn()}
        sourceIdea={sourceIdea}
        onConfirm={vi.fn()}
        isTriggering={true}
      />,
    );
    expect(screen.getByText('Cancel').closest('button')).toBeDisabled();
  });
});
