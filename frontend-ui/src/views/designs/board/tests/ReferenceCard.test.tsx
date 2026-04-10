import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../../utils/test-utils';
import ReferenceCard from '../partials/rightPanel/ReferenceCard';
import type { ProjectReference } from '../../gallery/types';

// ── Fixtures ───────────────────────────────────────────────────────
const makeReference = (overrides?: Partial<ProjectReference>): ProjectReference => ({
  id: 'ref-1',
  project: 'proj-1',
  source_product: 'prod-1',
  image_url: 'https://example.com/ref.jpg',
  title: 'Cool Dog Shirt',
  asin: 'B0EXAMPLE1',
  prompt_analysis: null,
  position: 0,
  added_at: '2026-04-10T10:00:00Z',
  ...overrides,
});

// ── Tests ──────────────────────────────────────────────────────────
describe('ReferenceCard', () => {
  const defaultProps = {
    onUseAsReference: vi.fn(),
    onAnalyze: vi.fn(),
    onUseAsPrompt: vi.fn(),
    onRemove: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders title and ASIN chip', () => {
    renderWithProviders(
      <ReferenceCard
        {...defaultProps}
        reference={makeReference()}
      />,
    );
    expect(screen.getByText('Cool Dog Shirt')).toBeInTheDocument();
    expect(screen.getByText('B0EXAMPLE1')).toBeInTheDocument();
  });

  it('renders "Untitled" when title is empty', () => {
    renderWithProviders(
      <ReferenceCard
        {...defaultProps}
        reference={makeReference({ title: '' })}
      />,
    );
    expect(screen.getByText('Untitled')).toBeInTheDocument();
  });

  it('calls onUseAsReference with image_url', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ReferenceCard
        {...defaultProps}
        reference={makeReference()}
      />,
    );

    await user.click(screen.getByLabelText('Use as Reference'));
    expect(defaultProps.onUseAsReference).toHaveBeenCalledWith(
      'https://example.com/ref.jpg',
    );
  });

  it('calls onAnalyze with reference object', async () => {
    const user = userEvent.setup();
    const ref = makeReference();
    renderWithProviders(
      <ReferenceCard {...defaultProps} reference={ref} />,
    );

    await user.click(screen.getByLabelText('Analyze'));
    expect(defaultProps.onAnalyze).toHaveBeenCalledWith(ref);
  });

  it('disables analyze button when isAnalyzing', () => {
    renderWithProviders(
      <ReferenceCard
        {...defaultProps}
        reference={makeReference()}
        isAnalyzing
      />,
    );

    const analyzeBtn = screen.getByLabelText('Analyze');
    expect(analyzeBtn).toBeDisabled();
  });

  it('calls onRemove with reference id', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ReferenceCard
        {...defaultProps}
        reference={makeReference()}
      />,
    );

    await user.click(screen.getByLabelText('Remove'));
    expect(defaultProps.onRemove).toHaveBeenCalledWith('ref-1');
  });

  it('does not show "Use as Prompt" button when no analysis', () => {
    renderWithProviders(
      <ReferenceCard
        {...defaultProps}
        reference={makeReference({ prompt_analysis: null })}
      />,
    );

    expect(screen.queryByLabelText('Use as Prompt')).not.toBeInTheDocument();
  });

  it('shows "Use as Prompt" button when analysis exists', () => {
    renderWithProviders(
      <ReferenceCard
        {...defaultProps}
        reference={makeReference({
          prompt_analysis: { summary: 'A funny design with a dog' },
        })}
      />,
    );

    expect(screen.getByLabelText('Use as Prompt')).toBeInTheDocument();
  });

  it('calls onUseAsPrompt with analysis summary text', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ReferenceCard
        {...defaultProps}
        reference={makeReference({
          prompt_analysis: { summary: 'A funny design with a dog' },
        })}
      />,
    );

    await user.click(screen.getByLabelText('Use as Prompt'));
    expect(defaultProps.onUseAsPrompt).toHaveBeenCalledWith(
      'A funny design with a dog',
    );
  });

  it('toggles analysis text visibility on click', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ReferenceCard
        {...defaultProps}
        reference={makeReference({
          prompt_analysis: { summary: 'Detailed analysis text here' },
        })}
      />,
    );

    // Initially collapsed
    expect(screen.getByText('Show analysis')).toBeInTheDocument();

    // Click to expand
    await user.click(screen.getByText('Show analysis'));
    expect(screen.getByText('Hide analysis')).toBeInTheDocument();
    expect(screen.getByText('Detailed analysis text here')).toBeInTheDocument();
  });
});
