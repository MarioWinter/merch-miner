import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
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
import PromptBuilderDialog from '../partials/PromptBuilderDialog';
import type { ProjectIdea, PromptPreset } from '../../gallery/types';

// -----------------------------------------------------------------
// Test data factories
// -----------------------------------------------------------------

const makeIdea = (overrides: Partial<ProjectIdea> = {}): ProjectIdea => ({
  id: 'idea-1',
  slogan_text: 'Dogs are awesome',
  signal_type: null,
  market_confidence: null,
  emotional_archetype: '',
  pattern_used: '',
  why_it_works: '',
  niche_name: null,
  position: 0,
  reference_products: [],
  design_count: 0,
  ...overrides,
});

const makePreset = (overrides: Partial<PromptPreset> = {}): PromptPreset => ({
  id: 'preset-1',
  name: 'My Preset',
  source_config: {
    concept: { promptTitle: 'Saved', selectedSloganId: null, mainSubject: 'dogs', contentType: '', mood: '' },
  },
  created_at: '2026-04-10T12:00:00Z',
  ...overrides,
});

// -----------------------------------------------------------------
// Default props
// -----------------------------------------------------------------

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  ideas: [] as ProjectIdea[],
  references: [],
  sources: {
    niche: false,
    keywords: false,
    research: false,
    slogan: false,
    reference: false,
    image: false,
  },
  selectedSloganId: null,
  imageUrl: null,
  variants: 1,
  preview: [],
  isPreviewLoading: false,
  isSaving: false,
  hasNiche: true,
  presets: [] as PromptPreset[],
  nicheKeywords: ['funny', 'dog', 'humor'],
  researchPreview: null,
  isResearchLoading: false,
  researchColors: [],
  sloganText: undefined,
  referenceProducts: [],
  toggleSource: vi.fn(),
  setSelectedSloganId: vi.fn(),
  setImageUrl: vi.fn(),
  setVariants: vi.fn(),
  fetchPreview: vi.fn(),
  applyPreset: vi.fn(),
  savePreset: vi.fn().mockResolvedValue(undefined),
  deletePreset: vi.fn().mockResolvedValue(undefined),
  buildAndSave: vi.fn().mockResolvedValue(undefined),
};

// -----------------------------------------------------------------
// Basic Dialog Tests
// -----------------------------------------------------------------

describe('PromptBuilderDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialog with title', () => {
    renderWithProviders(<PromptBuilderDialog {...defaultProps} />);
    expect(screen.getByText('Prompt Builder')).toBeInTheDocument();
  });

  it('renders close button', () => {
    renderWithProviders(<PromptBuilderDialog {...defaultProps} />);
    expect(screen.getByLabelText('Close')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(
      <PromptBuilderDialog {...defaultProps} onClose={onClose} />,
    );
    await user.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders all 8 tabs', () => {
    renderWithProviders(<PromptBuilderDialog {...defaultProps} />);
    const tablist = screen.getByRole('tablist');
    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs).toHaveLength(8);

    expect(screen.getByText('Concept')).toBeInTheDocument();
    expect(screen.getByText('Context')).toBeInTheDocument();
    expect(screen.getByText('Style')).toBeInTheDocument();
    expect(screen.getByText('Format')).toBeInTheDocument();
    expect(screen.getByText('Color')).toBeInTheDocument();
    expect(screen.getByText('Background')).toBeInTheDocument();
    expect(screen.getByText('Text')).toBeInTheDocument();
    expect(screen.getByText('Output')).toBeInTheDocument();
  });

  it('starts on Concept tab', () => {
    renderWithProviders(<PromptBuilderDialog {...defaultProps} />);
    const conceptTab = screen.getByRole('tab', { name: 'Concept' });
    expect(conceptTab).toHaveAttribute('aria-selected', 'true');
  });

  it('switches to Context tab when clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PromptBuilderDialog {...defaultProps} />);

    await user.click(screen.getByRole('tab', { name: 'Context' }));

    const contextTab = screen.getByRole('tab', { name: 'Context' });
    expect(contextTab).toHaveAttribute('aria-selected', 'true');
  });

  it('switches to Style tab when clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PromptBuilderDialog {...defaultProps} />);

    await user.click(screen.getByRole('tab', { name: 'Style' }));

    const styleTab = screen.getByRole('tab', { name: 'Style' });
    expect(styleTab).toHaveAttribute('aria-selected', 'true');
  });

  it('renders Generate Prompt button in footer', () => {
    renderWithProviders(<PromptBuilderDialog {...defaultProps} />);
    expect(screen.getByText('Generate Prompt')).toBeInTheDocument();
  });

  it('renders Cancel button in footer', () => {
    renderWithProviders(<PromptBuilderDialog {...defaultProps} />);
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('calls buildAndSave when Generate Prompt is clicked', async () => {
    const user = userEvent.setup();
    const buildAndSave = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <PromptBuilderDialog {...defaultProps} buildAndSave={buildAndSave} />,
    );
    await user.click(screen.getByText('Generate Prompt'));
    expect(buildAndSave).toHaveBeenCalledOnce();
  });

  it('disables Generate Prompt button when isSaving', () => {
    renderWithProviders(
      <PromptBuilderDialog {...defaultProps} isSaving />,
    );
    const btn = screen.getByText('Generate Prompt').closest('button');
    expect(btn).toBeDisabled();
  });

  it('does not render when open is false', () => {
    renderWithProviders(
      <PromptBuilderDialog {...defaultProps} open={false} />,
    );
    expect(screen.queryByText('Prompt Builder')).not.toBeInTheDocument();
  });

  it('has tabpanel with correct aria attributes', () => {
    renderWithProviders(<PromptBuilderDialog {...defaultProps} />);
    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAttribute('id', 'pb-tabpanel-concept');
    expect(panel).toHaveAttribute('aria-labelledby', 'pb-tab-concept');
  });

  it('updates tabpanel id when switching tabs', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PromptBuilderDialog {...defaultProps} />);

    await user.click(screen.getByRole('tab', { name: 'Format' }));

    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAttribute('id', 'pb-tabpanel-format');
    expect(panel).toHaveAttribute('aria-labelledby', 'pb-tab-format');
  });
});

// -----------------------------------------------------------------
// Slogan Selector in Concept Tab
// -----------------------------------------------------------------

describe('PromptBuilderDialog — Slogan Selector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders slogan selector label on Concept tab', () => {
    const ideas = [makeIdea()];
    renderWithProviders(
      <PromptBuilderDialog {...defaultProps} ideas={ideas} />,
    );
    expect(screen.getByText('Slogan from Pool')).toBeInTheDocument();
  });

  it('renders slogan select with label text', () => {
    const ideas = [makeIdea()];
    renderWithProviders(
      <PromptBuilderDialog {...defaultProps} ideas={ideas} />,
    );
    // InputLabel + Select both render "Select slogan"
    const matches = screen.getAllByText('Select slogan');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders Prompt Title and Main Subject fields on Concept tab', () => {
    renderWithProviders(<PromptBuilderDialog {...defaultProps} />);
    expect(screen.getByPlaceholderText('Give this prompt a name...')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Describe the main subject of your design...')).toBeInTheDocument();
  });

  it('allows typing in Main Subject field', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PromptBuilderDialog {...defaultProps} />);
    const mainSubject = screen.getByPlaceholderText('Describe the main subject of your design...');
    await user.click(mainSubject);
    await user.type(mainSubject, 'A funny dog');
    expect(mainSubject).toHaveValue('A funny dog');
  });
});

// -----------------------------------------------------------------
// Preset Bar UI
// -----------------------------------------------------------------

describe('PromptBuilderDialog — Preset Bar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders preset select with "Preset" label', () => {
    renderWithProviders(<PromptBuilderDialog {...defaultProps} />);
    expect(screen.getByLabelText('Preset')).toBeInTheDocument();
  });

  it('renders "Save as Preset" button', () => {
    renderWithProviders(<PromptBuilderDialog {...defaultProps} />);
    expect(screen.getByText('Save as Preset')).toBeInTheDocument();
  });

  it('shows name input when "Save as Preset" is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PromptBuilderDialog {...defaultProps} />);
    await user.click(screen.getByText('Save as Preset'));
    expect(screen.getByPlaceholderText('Preset name')).toBeInTheDocument();
  });

  it('shows Save button when name input is visible', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PromptBuilderDialog {...defaultProps} />);
    await user.click(screen.getByText('Save as Preset'));
    // "Save" button appears (distinct from footer "Generate Prompt")
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('disables Save button when preset name is empty', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PromptBuilderDialog {...defaultProps} />);
    await user.click(screen.getByText('Save as Preset'));
    const saveBtn = screen.getByRole('button', { name: 'Save' });
    expect(saveBtn).toBeDisabled();
  });

  it('enables Save button when preset name is typed', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PromptBuilderDialog {...defaultProps} />);
    await user.click(screen.getByText('Save as Preset'));
    const nameInput = screen.getByPlaceholderText('Preset name');
    await user.type(nameInput, 'Test Preset');
    const saveBtn = screen.getByRole('button', { name: 'Save' });
    expect(saveBtn).toBeEnabled();
  });

  it('calls savePreset with name when Save is clicked', async () => {
    const user = userEvent.setup();
    const savePreset = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <PromptBuilderDialog {...defaultProps} savePreset={savePreset} />,
    );
    await user.click(screen.getByText('Save as Preset'));
    const nameInput = screen.getByPlaceholderText('Preset name');
    await user.type(nameInput, 'My Style');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(savePreset).toHaveBeenCalledOnce();
    expect(savePreset).toHaveBeenCalledWith('My Style', expect.any(Object));
  });

  it('hides name input after successful save', async () => {
    const user = userEvent.setup();
    const savePreset = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <PromptBuilderDialog {...defaultProps} savePreset={savePreset} />,
    );
    await user.click(screen.getByText('Save as Preset'));
    const nameInput = screen.getByPlaceholderText('Preset name');
    await user.type(nameInput, 'Saved');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Preset name')).not.toBeInTheDocument();
    });
  });

  it('hides name input when Cancel is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PromptBuilderDialog {...defaultProps} />);
    await user.click(screen.getByText('Save as Preset'));
    expect(screen.getByPlaceholderText('Preset name')).toBeInTheDocument();
    // There are two Cancel buttons; the one in preset bar is the second
    const cancelButtons = screen.getAllByText('Cancel');
    await user.click(cancelButtons[0]);
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Preset name')).not.toBeInTheDocument();
    });
  });

  it('shows delete button when a preset is selected', async () => {
    const user = userEvent.setup();
    const presets = [makePreset()];
    renderWithProviders(
      <PromptBuilderDialog {...defaultProps} presets={presets} />,
    );
    // Open the preset select and pick one
    const presetSelect = screen.getByLabelText('Preset');
    await user.click(presetSelect);
    const option = await screen.findByText('My Preset');
    await user.click(option);
    // Delete button should now appear
    expect(screen.getByLabelText('Delete preset')).toBeInTheDocument();
  });

  it('calls deletePreset when delete button is clicked', async () => {
    const user = userEvent.setup();
    const presets = [makePreset()];
    const deletePreset = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <PromptBuilderDialog {...defaultProps} presets={presets} deletePreset={deletePreset} />,
    );
    const presetSelect = screen.getByLabelText('Preset');
    await user.click(presetSelect);
    const option = await screen.findByText('My Preset');
    await user.click(option);
    await user.click(screen.getByLabelText('Delete preset'));
    expect(deletePreset).toHaveBeenCalledWith('preset-1');
  });
});

// -----------------------------------------------------------------
// Integration: Prompt Builder E2E Flow
// -----------------------------------------------------------------

describe('PromptBuilderDialog — E2E Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('navigates tabs, fills fields, saves preset, and generates prompt', async () => {
    const user = userEvent.setup();
    const buildAndSave = vi.fn().mockResolvedValue(undefined);
    const savePreset = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    const ideas = [
      makeIdea({ id: 'idea-1', slogan_text: 'Dogs are awesome' }),
      makeIdea({ id: 'idea-2', slogan_text: 'Cat lovers unite' }),
    ];

    renderWithProviders(
      <PromptBuilderDialog
        {...defaultProps}
        ideas={ideas}
        onClose={onClose}
        buildAndSave={buildAndSave}
        savePreset={savePreset}
      />,
    );

    // Step 1: On Concept tab — fill Prompt Title
    const titleInput = screen.getByPlaceholderText('Give this prompt a name...');
    await user.type(titleInput, 'My Dog Design');
    expect(titleInput).toHaveValue('My Dog Design');

    // Step 2: Fill Main Subject
    const subjectInput = screen.getByPlaceholderText('Describe the main subject of your design...');
    await user.type(subjectInput, 'A playful golden retriever');
    expect(subjectInput).toHaveValue('A playful golden retriever');

    // Step 3: Navigate to Context tab
    await user.click(screen.getByRole('tab', { name: 'Context' }));
    expect(screen.getByRole('tab', { name: 'Context' })).toHaveAttribute('aria-selected', 'true');

    // Step 4: Navigate to Style tab
    await user.click(screen.getByRole('tab', { name: 'Style' }));
    expect(screen.getByRole('tab', { name: 'Style' })).toHaveAttribute('aria-selected', 'true');

    // Step 5: Navigate to Format tab
    await user.click(screen.getByRole('tab', { name: 'Format' }));
    expect(screen.getByRole('tab', { name: 'Format' })).toHaveAttribute('aria-selected', 'true');

    // Step 6: Navigate to Output tab
    await user.click(screen.getByRole('tab', { name: 'Output' }));
    expect(screen.getByRole('tab', { name: 'Output' })).toHaveAttribute('aria-selected', 'true');

    // Step 7: Save as Preset
    await user.click(screen.getByText('Save as Preset'));
    const nameInput = screen.getByPlaceholderText('Preset name');
    await user.type(nameInput, 'Dog Style');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(savePreset).toHaveBeenCalledWith('Dog Style', expect.any(Object));

    // Step 8: Click "Generate Prompt" to build and save
    await user.click(screen.getByText('Generate Prompt'));
    expect(buildAndSave).toHaveBeenCalledOnce();
  });

  it('saves preset via Enter key in name input', async () => {
    const user = userEvent.setup();
    const savePreset = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <PromptBuilderDialog {...defaultProps} savePreset={savePreset} />,
    );
    await user.click(screen.getByText('Save as Preset'));
    const nameInput = screen.getByPlaceholderText('Preset name');
    await user.type(nameInput, 'Quick Save{Enter}');
    expect(savePreset).toHaveBeenCalledWith('Quick Save', expect.any(Object));
  });

  it('closes name input via Escape key', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PromptBuilderDialog {...defaultProps} />);
    await user.click(screen.getByText('Save as Preset'));
    expect(screen.getByPlaceholderText('Preset name')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Preset name')).not.toBeInTheDocument();
    });
  });
});
