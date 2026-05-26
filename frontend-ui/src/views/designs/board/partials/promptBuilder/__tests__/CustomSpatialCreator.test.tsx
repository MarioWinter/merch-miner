// PROJ-34 Phase 13f part B — CustomSpatialCreator wizard unit tests.
// Covers: upload happy-path, oversize rejection, wrong-mime rejection,
// analyze populates the textfield, forbidden-terms error UX, save call,
// name-conflict inline error.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/* eslint-disable @typescript-eslint/no-explicit-any */
const {
  fa,
  mockAnalyze,
  mockCreate,
  mockBoard,
  analyzeState,
} = vi.hoisted(() => ({
  fa: (n: string) => ({
    reducerPath: n,
    reducer: () => ({}),
    middleware: () => (x: any) => (a: any) => x(a),
    util: { resetApiState: () => ({ type: 'noop' }) },
  }),
  mockAnalyze: vi.fn(),
  mockCreate: vi.fn(),
  mockBoard: vi.fn(),
  analyzeState: { isLoading: false, error: undefined as unknown },
}));

vi.mock('@/store/nicheSlice', () => ({
  nicheApi: fa('nicheApi'),
  useListNichesQuery: () => ({ data: { results: [] }, isLoading: false }),
}));
vi.mock('@/store/ideaSlice', () => ({ ideaApi: fa('ideaApi') }));
vi.mock('@/store/researchSlice', () => ({ researchApi: fa('researchApi') }));
vi.mock('@/store/designSlice', () => ({
  designApi: fa('designApi'),
  useAnalyzeSpatialMutation: () => [mockAnalyze, analyzeState],
  useCreateCustomSpatialMutation: () => [mockCreate, { isLoading: false }],
  useGetProjectBoardQuery: mockBoard,
}));
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
import CustomSpatialCreator from '../CustomSpatialCreator';

// jsdom doesn't implement createObjectURL.
beforeAll(() => {
  if (!('createObjectURL' in URL)) {
    // @ts-expect-error — patching jsdom global.
    URL.createObjectURL = vi.fn(() => 'blob:mock');
  }
});

afterEach(() => {
  vi.clearAllMocks();
  mockAnalyze.mockReset();
  mockCreate.mockReset();
  mockBoard.mockReset();
  analyzeState.isLoading = false;
  analyzeState.error = undefined;
});

const baseProps = {
  workspaceId: 'ws-1',
  projectId: 'proj-1',
  onCreated: vi.fn(),
  onCancel: vi.fn(),
};

const longPrompt =
  'A balanced two-row layout with a large illustration above and a single ' +
  'centred slogan below, framed by a thin oval border on a neutral background.';

describe('CustomSpatialCreator', () => {
  it('step 1 upload — accepts a valid JPG and enables Next', async () => {
    mockBoard.mockReturnValue({ data: { references: [], designs: [] } });
    const user = userEvent.setup();
    renderWithProviders(<CustomSpatialCreator {...baseProps} />);

    // Locate the hidden <input type='file'> via the upload drop zone region.
    const dropZone = screen.getByLabelText(/Upload image drop zone/i);
    const input = dropZone.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'pic.jpg', { type: 'image/jpeg' });

    await user.upload(input, file);

    // Preview alt text rendered.
    expect(screen.getByAltText(/Selected upload preview/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Next/i })).toBeEnabled();
  });

  it('step 1 upload — rejects an oversize file', async () => {
    mockBoard.mockReturnValue({ data: { references: [], designs: [] } });
    const user = userEvent.setup();
    renderWithProviders(<CustomSpatialCreator {...baseProps} />);

    const dropZone = screen.getByLabelText(/Upload image drop zone/i);
    const input = dropZone.querySelector('input[type="file"]') as HTMLInputElement;
    const big = new File([new Uint8Array(11 * 1024 * 1024)], 'big.jpg', {
      type: 'image/jpeg',
    });

    await user.upload(input, big);

    expect(screen.getByRole('alert')).toHaveTextContent(/Max 10 MB/i);
    expect(screen.getByRole('button', { name: /Next/i })).toBeDisabled();
  });

  it('step 1 upload — rejects a non-image mime', () => {
    mockBoard.mockReturnValue({ data: { references: [], designs: [] } });
    renderWithProviders(<CustomSpatialCreator {...baseProps} />);

    const dropZone = screen.getByLabelText(/Upload image drop zone/i);
    const input = dropZone.querySelector('input[type="file"]') as HTMLInputElement;
    const bad = new File(['gif87a'], 'pic.gif', { type: 'image/gif' });
    // userEvent.upload enforces the input's `accept` attribute (silently
    // drops the gif). Use fireEvent to bypass that and exercise the
    // component-level mime guard directly.
    Object.defineProperty(input, 'files', { value: [bad], configurable: true });
    fireEvent.change(input);

    expect(screen.getByRole('alert')).toHaveTextContent(/JPG, PNG, or WebP/i);
  });

  it('step 2 — populates TextField with analyze response', async () => {
    mockBoard.mockReturnValue({ data: { references: [], designs: [] } });
    mockAnalyze.mockReturnValue({
      unwrap: () => Promise.resolve({ prompt_text: longPrompt, model: 'm' }),
    });
    const user = userEvent.setup();
    renderWithProviders(<CustomSpatialCreator {...baseProps} />);

    const dropZone = screen.getByLabelText(/Upload image drop zone/i);
    const input = dropZone.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File(['x'], 'pic.jpg', { type: 'image/jpeg' }));
    await user.click(screen.getByRole('button', { name: /Next/i }));

    expect(await screen.findByDisplayValue(longPrompt)).toBeInTheDocument();
  });

  it('step 2 — shows forbidden-terms alert on 422', async () => {
    mockBoard.mockReturnValue({ data: { references: [], designs: [] } });
    // Pre-seed the analyze hook's `error` slot so when step 2 mounts the
    // component sees the rejected mutation state. The actual mutation
    // promise still resolves to keep the effect's .catch quiet.
    analyzeState.error = {
      status: 422,
      data: {
        error: 'spatial_analysis_failed',
        forbidden_terms: ['red', 'vintage'],
      },
    };
    mockAnalyze.mockReturnValue({
      unwrap: () => Promise.reject(analyzeState.error),
    });
    const user = userEvent.setup();
    renderWithProviders(<CustomSpatialCreator {...baseProps} />);

    const dropZone = screen.getByLabelText(/Upload image drop zone/i);
    const input = dropZone.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File(['x'], 'pic.jpg', { type: 'image/jpeg' }));
    await user.click(screen.getByRole('button', { name: /Next/i }));

    expect(
      await screen.findByText(/Forbidden terms detected/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/red, vintage/i)).toBeInTheDocument();
  });

  it('step 3 — save calls createCustomSpatial mutation and onCreated', async () => {
    mockBoard.mockReturnValue({ data: { references: [], designs: [] } });
    mockAnalyze.mockReturnValue({
      unwrap: () => Promise.resolve({ prompt_text: longPrompt, model: 'm' }),
    });
    mockCreate.mockReturnValue({
      unwrap: () => Promise.resolve({ id: 'new-uuid', name: 'X' }),
    });
    const onCreated = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <CustomSpatialCreator {...baseProps} onCreated={onCreated} />,
    );

    // Step 1 → upload
    const dropZone = screen.getByLabelText(/Upload image drop zone/i);
    const input = dropZone.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File(['x'], 'pic.jpg', { type: 'image/jpeg' }));
    await user.click(screen.getByRole('button', { name: /Next/i }));

    // Step 2 → wait for textfield, then Next
    await screen.findByDisplayValue(longPrompt);
    await user.click(screen.getByRole('button', { name: /Next/i }));

    // Step 3 → type name + Save
    const nameInput = screen.getByLabelText(/^Name$/i);
    fireEvent.change(nameInput, { target: { value: 'My layout' } });
    await user.click(screen.getByRole('button', { name: /Save/i }));

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'My layout',
        prompt_text: longPrompt,
        source_kind: 'upload',
      }),
    );
    expect(onCreated).toHaveBeenCalledWith('new-uuid');
  });

  it('step 3 — name conflict surfaces inline error', async () => {
    mockBoard.mockReturnValue({ data: { references: [], designs: [] } });
    mockAnalyze.mockReturnValue({
      unwrap: () => Promise.resolve({ prompt_text: longPrompt, model: 'm' }),
    });
    mockCreate.mockReturnValue({
      unwrap: () =>
        Promise.reject({
          status: 400,
          data: { name: 'A custom spatial with that name already exists.' },
        }),
    });
    const user = userEvent.setup();
    renderWithProviders(<CustomSpatialCreator {...baseProps} />);

    const dropZone = screen.getByLabelText(/Upload image drop zone/i);
    const input = dropZone.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File(['x'], 'pic.jpg', { type: 'image/jpeg' }));
    await user.click(screen.getByRole('button', { name: /Next/i }));
    await screen.findByDisplayValue(longPrompt);
    await user.click(screen.getByRole('button', { name: /Next/i }));

    const nameInput = screen.getByLabelText(/^Name$/i);
    fireEvent.change(nameInput, { target: { value: 'Duplicate' } });
    await user.click(screen.getByRole('button', { name: /Save/i }));

    expect(await screen.findByText(/already used in this workspace/i)).toBeInTheDocument();
  });
});
