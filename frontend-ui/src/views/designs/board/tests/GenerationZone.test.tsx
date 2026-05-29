import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
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
import GenerationZone from '../partials/GenerationZone';
import type { DesignModel } from '../types';
import type { BackgroundColor } from '../types';

const defaultProps = {
  prompt: '',
  onPromptChange: vi.fn(),
  model: 'google/gemini-3.1-flash-preview-image-generation' as DesignModel,
  onModelChange: vi.fn(),
  bgColor: 'light_gray' as BackgroundColor,
  onBgColorChange: vi.fn(),
  imageCount: 1,
  onImageCountChange: vi.fn(),
  onGenerate: vi.fn(),
  isGenerating: false,
  isParallel: false,
  onParallelToggle: vi.fn(),
};

describe('GenerationZone', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders model selector with current model label', () => {
    renderWithProviders(<GenerationZone {...defaultProps} />);
    expect(screen.getByLabelText('AI Model')).toBeInTheDocument();
    // The select should show the model label
    expect(screen.getByText('Nano Banana 2')).toBeInTheDocument();
  });

  it('renders two selectors in the controls grid', () => {
    const { container } = renderWithProviders(<GenerationZone {...defaultProps} />);
    // Model + BG color selectors render as MuiSelect inputs
    const selects = container.querySelectorAll('.MuiSelect-select');
    expect(selects.length).toBeGreaterThanOrEqual(2);
  });

  it('renders generate button', () => {
    renderWithProviders(<GenerationZone {...defaultProps} prompt="A dog" />);
    expect(screen.getByLabelText('Generate')).toBeInTheDocument();
  });

  it('disables generate button when prompt is empty', () => {
    renderWithProviders(<GenerationZone {...defaultProps} prompt="" />);
    const btn = screen.getByLabelText('Generate');
    expect(btn).toBeDisabled();
  });

  it('calls onGenerate when generate button is clicked', async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn();
    renderWithProviders(
      <GenerationZone {...defaultProps} prompt="A funny cat" onGenerate={onGenerate} />,
    );
    await user.click(screen.getByLabelText('Generate'));
    expect(onGenerate).toHaveBeenCalledOnce();
  });

  it('shows "Generating..." when isGenerating is true', () => {
    renderWithProviders(
      <GenerationZone {...defaultProps} prompt="test" isGenerating />,
    );
    expect(screen.getByText('Generating...')).toBeInTheDocument();
  });

  it('renders parallel prompts switch', () => {
    renderWithProviders(<GenerationZone {...defaultProps} />);
    expect(screen.getByLabelText('Parallel prompts')).toBeInTheDocument();
  });

  it('calls onParallelToggle when switch is clicked', async () => {
    const user = userEvent.setup();
    const onParallelToggle = vi.fn();
    renderWithProviders(
      <GenerationZone {...defaultProps} onParallelToggle={onParallelToggle} />,
    );
    // ParallelPromptsRow renders the Switch + a label Typography
    // Click the label text to toggle (the label calls onToggle(!isParallel) on click)
    await user.click(screen.getByText('Parallel Prompts'));
    expect(onParallelToggle).toHaveBeenCalledWith(true);
  });

  it('renders prompt textarea', () => {
    renderWithProviders(<GenerationZone {...defaultProps} />);
    expect(screen.getByLabelText('Design prompt')).toBeInTheDocument();
  });

  it('updates the textarea on input and syncs to onPromptChange on blur', () => {
    // PERF — onPromptChange no longer fires on every keystroke; the
    // textarea keeps a local buffer and the parent is only notified on
    // blur. See GenerationZone.tsx comment on `handlePromptBlur`.
    const onPromptChange = vi.fn();
    renderWithProviders(
      <GenerationZone {...defaultProps} onPromptChange={onPromptChange} />,
    );
    const textarea = screen.getByPlaceholderText(/describe your design/i);
    fireEvent.change(textarea, { target: { value: 'A funny dog' } });
    // Mid-typing: the textarea shows the new value but the parent
    // hasn't been notified yet.
    expect(textarea).toHaveValue('A funny dog');
    expect(onPromptChange).not.toHaveBeenCalled();
    // Blur flushes the buffered value to the parent.
    fireEvent.blur(textarea);
    expect(onPromptChange).toHaveBeenCalledWith('A funny dog');
  });

  it('renders reference image indicator when sourceImageUrl is set', () => {
    renderWithProviders(
      <GenerationZone
        {...defaultProps}
        sourceImageUrl="https://example.com/ref.jpg"
      />,
    );
    expect(screen.getByText('Generating with reference image')).toBeInTheDocument();
    const thumb = screen.getByAltText('');
    expect(thumb).toHaveAttribute('src', 'https://example.com/ref.jpg');
  });

  it('does not render reference indicator when sourceImageUrl is null', () => {
    renderWithProviders(
      <GenerationZone {...defaultProps} sourceImageUrl={null} />,
    );
    expect(
      screen.queryByText('Generating with reference image'),
    ).not.toBeInTheDocument();
  });

  it('calls onClearSourceImage when clear button is clicked', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    renderWithProviders(
      <GenerationZone
        {...defaultProps}
        sourceImageUrl="https://example.com/ref.jpg"
        onClearSourceImage={onClear}
      />,
    );
    await user.click(screen.getByLabelText('Clear reference image'));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it('renders images slider', () => {
    renderWithProviders(<GenerationZone {...defaultProps} />);
    expect(screen.getByLabelText('Number of images')).toBeInTheDocument();
    expect(screen.getByText('Images')).toBeInTheDocument();
  });

  it('renders resolution slider', () => {
    renderWithProviders(
      <GenerationZone
        {...defaultProps}
        aspectRatio="1:1"
        onAspectRatioChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Resolution')).toBeInTheDocument();
    expect(screen.getByText('Res.')).toBeInTheDocument();
  });

  it('renders mode selector when onModeChange is provided', () => {
    renderWithProviders(
      <GenerationZone
        {...defaultProps}
        mode="text_to_image"
        onModeChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Mode')).toBeInTheDocument();
  });

  it('renders generation controls zone with aria-label', () => {
    renderWithProviders(<GenerationZone {...defaultProps} />);
    expect(screen.getByLabelText('Generation controls')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // PROJ-34 Phase 9 — multi-prompt slider lock + split-button
  // -------------------------------------------------------------------------

  it('AC-38: locks the Images slider when isParallel + ≥2 parallelLineCount', () => {
    renderWithProviders(
      <GenerationZone
        {...defaultProps}
        isParallel
        parallelLineCount={3}
        prompt="A; B; C"
      />,
    );
    const slider = screen.getByLabelText('Number of images');
    expect(slider).toBeDisabled();
  });

  it('AC-38: leaves the Images slider enabled when only single prompt visible', () => {
    renderWithProviders(
      <GenerationZone
        {...defaultProps}
        isParallel
        parallelLineCount={1}
        prompt="Just one"
      />,
    );
    const slider = screen.getByLabelText('Number of images');
    expect(slider).not.toBeDisabled();
  });

  it('AC-36/37: surfaces split-button "Generate All" once ≥2 `;`-split prompts in parallel mode', () => {
    const onGenerateAll = vi.fn();
    renderWithProviders(
      <GenerationZone
        {...defaultProps}
        prompt="A; B"
        isParallel
        parallelLineCount={2}
        onGenerateAll={onGenerateAll}
      />,
    );
    // The split-button wraps Generate + a chevron — the count appears in
    // the dropdown menu, so we at least verify the chevron exists.
    expect(
      screen.getByLabelText('More generate options'),
    ).toBeInTheDocument();
  });
});
