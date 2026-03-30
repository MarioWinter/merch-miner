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
import { IdeaCard } from '../partials/IdeaCard';
import { makeIdea, makeOrphanIdea } from './fixtures';

const defaultHandlers = {
  onApprove: vi.fn(),
  onReject: vi.fn(),
  onImprove: vi.fn(),
  onAdapt: vi.fn(),
  onDelete: vi.fn(),
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('IdeaCard', () => {
  it('renders slogan text', () => {
    renderWithProviders(
      <IdeaCard idea={makeIdea()} {...defaultHandlers} />,
    );
    expect(screen.getByText('Life is better with a dog')).toBeInTheDocument();
  });

  it('renders status chip', () => {
    renderWithProviders(
      <IdeaCard idea={makeIdea({ status: 'approved' })} {...defaultHandlers} />,
    );
    expect(screen.getByText('Approved')).toBeInTheDocument();
  });

  it('renders signal type badge when present', () => {
    renderWithProviders(
      <IdeaCard idea={makeIdea({ signal_type: 'self' })} {...defaultHandlers} />,
    );
    expect(screen.getByLabelText('Signal type: self')).toBeInTheDocument();
  });

  it('renders market confidence badge when present', () => {
    renderWithProviders(
      <IdeaCard idea={makeIdea({ market_confidence: 'High' })} {...defaultHandlers} />,
    );
    expect(screen.getByLabelText('Market confidence: High')).toBeInTheDocument();
  });

  it('renders pattern chip when present', () => {
    renderWithProviders(
      <IdeaCard idea={makeIdea({ pattern_used: 'Metaphor' })} {...defaultHandlers} />,
    );
    expect(screen.getByText('Metaphor')).toBeInTheDocument();
  });

  it('renders why_it_works text', () => {
    renderWithProviders(
      <IdeaCard idea={makeIdea({ why_it_works: 'Appeals to pet lovers' })} {...defaultHandlers} />,
    );
    expect(screen.getByText('Appeals to pet lovers')).toBeInTheDocument();
  });

  it('renders niche name chip for ideas with a niche', () => {
    renderWithProviders(
      <IdeaCard idea={makeIdea({ niche_name: 'Funny Dogs' })} {...defaultHandlers} />,
    );
    expect(screen.getByText('Funny Dogs')).toBeInTheDocument();
  });

  it('renders "No niche" chip for orphan ideas', () => {
    renderWithProviders(
      <IdeaCard idea={makeOrphanIdea()} {...defaultHandlers} />,
    );
    expect(screen.getByText('No niche')).toBeInTheDocument();
  });

  it('calls onApprove when approve button clicked', () => {
    const onApprove = vi.fn();
    renderWithProviders(
      <IdeaCard idea={makeIdea({ status: 'pending' })} {...defaultHandlers} onApprove={onApprove} />,
    );
    fireEvent.click(screen.getByLabelText('Approved'));
    expect(onApprove).toHaveBeenCalledOnce();
  });

  it('calls onReject when reject button clicked', () => {
    const onReject = vi.fn();
    renderWithProviders(
      <IdeaCard idea={makeIdea({ status: 'pending' })} {...defaultHandlers} onReject={onReject} />,
    );
    fireEvent.click(screen.getByLabelText('Rejected'));
    expect(onReject).toHaveBeenCalledOnce();
  });

  it('does not show approve button when already approved', () => {
    renderWithProviders(
      <IdeaCard idea={makeIdea({ status: 'approved' })} {...defaultHandlers} />,
    );
    expect(screen.queryByLabelText('Approved')).not.toBeInTheDocument();
  });

  it('does not show reject button when already rejected', () => {
    renderWithProviders(
      <IdeaCard idea={makeIdea({ status: 'rejected' })} {...defaultHandlers} />,
    );
    expect(screen.queryByLabelText('Rejected')).not.toBeInTheDocument();
  });

  it('calls onImprove when improve button clicked', () => {
    const onImprove = vi.fn();
    renderWithProviders(
      <IdeaCard idea={makeIdea()} {...defaultHandlers} onImprove={onImprove} />,
    );
    fireEvent.click(screen.getByLabelText('Improve'));
    expect(onImprove).toHaveBeenCalledOnce();
  });

  it('calls onAdapt when adapt button clicked (idea has niche)', () => {
    const onAdapt = vi.fn();
    renderWithProviders(
      <IdeaCard idea={makeIdea()} {...defaultHandlers} onAdapt={onAdapt} />,
    );
    fireEvent.click(screen.getByLabelText('Adapt'));
    expect(onAdapt).toHaveBeenCalledOnce();
  });

  it('disables adapt button for orphan ideas', () => {
    renderWithProviders(
      <IdeaCard idea={makeOrphanIdea()} {...defaultHandlers} />,
    );
    const buttons = screen.getAllByLabelText('Adapt');
    expect(buttons[0]).toBeDisabled();
  });

  it('calls onDelete when delete button clicked', () => {
    const onDelete = vi.fn();
    renderWithProviders(
      <IdeaCard idea={makeIdea()} {...defaultHandlers} onDelete={onDelete} />,
    );
    fireEvent.click(screen.getByLabelText('Delete'));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it('shows regenerate button only for rejected ideas with onRegenerate', () => {
    const onRegenerate = vi.fn();
    renderWithProviders(
      <IdeaCard
        idea={makeIdea({ status: 'rejected' })}
        {...defaultHandlers}
        onRegenerate={onRegenerate}
      />,
    );
    expect(screen.getByLabelText('Regenerate')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Regenerate'));
    expect(onRegenerate).toHaveBeenCalledOnce();
  });

  it('does not show regenerate button for non-rejected ideas', () => {
    renderWithProviders(
      <IdeaCard
        idea={makeIdea({ status: 'pending' })}
        {...defaultHandlers}
        onRegenerate={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText('Regenerate')).not.toBeInTheDocument();
  });

  it('renders checkbox when onToggleSelect is provided', () => {
    renderWithProviders(
      <IdeaCard
        idea={makeIdea()}
        {...defaultHandlers}
        isSelected={false}
        onToggleSelect={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Select idea')).toBeInTheDocument();
  });

  it('does not render checkbox when onToggleSelect not provided', () => {
    renderWithProviders(
      <IdeaCard idea={makeIdea()} {...defaultHandlers} />,
    );
    expect(screen.queryByLabelText('Select idea')).not.toBeInTheDocument();
  });

  it('has correct aria-label on root element', () => {
    renderWithProviders(
      <IdeaCard idea={makeIdea({ slogan_text: 'Test slogan' })} {...defaultHandlers} />,
    );
    expect(screen.getByRole('article')).toHaveAttribute(
      'aria-label',
      'Idea: Test slogan',
    );
  });
});
