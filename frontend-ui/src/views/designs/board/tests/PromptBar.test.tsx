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
import { PromptBar } from '../partials/PromptBar';
import { makeAiArtboard } from './fixtures';

const baseProps = {
  isExpanded: false,
  onExpand: vi.fn(),
  onCollapse: vi.fn(),
  prompt: '',
  onPromptChange: vi.fn(),
  model: 'google/gemini-3.1-flash-preview-image-generation' as const,
  onModelChange: vi.fn(),
  bgColor: 'light_gray' as const,
  onBgColorChange: vi.fn(),
  onGenerate: vi.fn(),
  isGenerating: false,
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('PromptBar', () => {
  it('renders collapsed state with placeholder', () => {
    renderWithProviders(<PromptBar {...baseProps} />);
    expect(screen.getByRole('button', { name: /open prompt bar/i })).toBeInTheDocument();
  });

  it('shows prompt text in collapsed state when prompt is set', () => {
    renderWithProviders(
      <PromptBar {...baseProps} prompt="A cool dog design" />,
    );
    expect(screen.getByText('A cool dog design')).toBeInTheDocument();
  });

  it('calls onExpand when collapsed bar is clicked', () => {
    const onExpand = vi.fn();
    renderWithProviders(
      <PromptBar {...baseProps} onExpand={onExpand} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /open prompt bar/i }));
    expect(onExpand).toHaveBeenCalledOnce();
  });

  it('renders expanded state with prompt input and controls', () => {
    renderWithProviders(
      <PromptBar {...baseProps} isExpanded prompt="test prompt" />,
    );
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getAllByText('AI Model').length).toBeGreaterThan(0);
    expect(screen.getByText('Background Color')).toBeInTheDocument();
  });

  it('pre-fills prompt text in expanded state', () => {
    renderWithProviders(
      <PromptBar {...baseProps} isExpanded prompt="A funny dog on a t-shirt" />,
    );
    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveValue('A funny dog on a t-shirt');
  });

  it('calls onPromptChange when typing in prompt', () => {
    const onPromptChange = vi.fn();
    renderWithProviders(
      <PromptBar {...baseProps} isExpanded onPromptChange={onPromptChange} />,
    );
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'new prompt' },
    });
    expect(onPromptChange).toHaveBeenCalledWith('new prompt');
  });

  it('calls onCollapse when close button clicked', () => {
    const onCollapse = vi.fn();
    renderWithProviders(
      <PromptBar {...baseProps} isExpanded onCollapse={onCollapse} />,
    );
    fireEvent.click(screen.getByLabelText(/close prompt bar/i));
    expect(onCollapse).toHaveBeenCalledOnce();
  });

  it('shows "Generate" text on button by default', () => {
    renderWithProviders(
      <PromptBar {...baseProps} isExpanded prompt="some prompt" />,
    );
    expect(screen.getByText('Generate')).toBeInTheDocument();
  });

  it('shows "Regenerate" text when isRegenerate is true', () => {
    renderWithProviders(
      <PromptBar {...baseProps} isExpanded prompt="prompt" isRegenerate />,
    );
    expect(screen.getByText('Regenerate')).toBeInTheDocument();
  });

  it('shows "Generating..." text when isGenerating is true', () => {
    renderWithProviders(
      <PromptBar {...baseProps} isExpanded prompt="prompt" isGenerating />,
    );
    expect(screen.getByText('Generating...')).toBeInTheDocument();
  });

  it('disables generate button when prompt is empty', () => {
    renderWithProviders(
      <PromptBar {...baseProps} isExpanded prompt="" />,
    );
    expect(screen.getByLabelText(/generate/i)).toBeDisabled();
  });

  it('disables generate button when disabled prop is true', () => {
    renderWithProviders(
      <PromptBar {...baseProps} isExpanded prompt="prompt" disabled />,
    );
    expect(screen.getByLabelText(/generate/i)).toBeDisabled();
  });

  it('calls onGenerate when generate button clicked', () => {
    const onGenerate = vi.fn();
    renderWithProviders(
      <PromptBar {...baseProps} isExpanded prompt="valid prompt" onGenerate={onGenerate} />,
    );
    fireEvent.click(screen.getByText('Generate'));
    expect(onGenerate).toHaveBeenCalledOnce();
  });

  it('shows prompt builder accordion when promptAnalysis is provided', () => {
    renderWithProviders(
      <PromptBar
        {...baseProps}
        isExpanded
        prompt="prompt"
        promptAnalysis={{
          text_dna: 'text analysis',
          visual: 'visual analysis',
        }}
      />,
    );
    expect(screen.getByText('Prompt builder')).toBeInTheDocument();
  });

  it('does not show prompt builder when no analysis data', () => {
    renderWithProviders(
      <PromptBar {...baseProps} isExpanded prompt="prompt" />,
    );
    expect(screen.queryByText('Prompt builder')).not.toBeInTheDocument();
  });

  it('shows source thumbnail when sourceArtboard has imageUrl', () => {
    const source = makeAiArtboard({ imageUrl: 'https://example.com/source.png' });
    renderWithProviders(
      <PromptBar {...baseProps} isExpanded prompt="prompt" sourceArtboard={source} />,
    );
    expect(screen.getByAltText(/source image/i)).toBeInTheDocument();
  });
});
