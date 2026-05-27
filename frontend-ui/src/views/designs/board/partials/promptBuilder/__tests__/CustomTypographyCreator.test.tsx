// PROJ-34 Phase 13t-m — CustomTypographyCreator wizard unit tests.
// Covers: upload happy-path, oversize rejection, wrong-mime rejection,
// analyze populates the textfield, forbidden-terms error UX, save call,
// name-conflict inline error. Mirrors the CustomSpatialCreator.test.tsx
// patterns 1:1 modulo the typography API hooks and error codes.

import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/* eslint-disable @typescript-eslint/no-explicit-any */
const {
  fa,
  mockAnalyze,
  mockCreate,
  mockDelete,
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
  mockDelete: vi.fn(),
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
vi.mock('@/services/customTypographyApi', () => ({
  customTypographyApi: fa('customTypographyApi'),
  useAnalyzeTypographyMutation: () => [mockAnalyze, analyzeState],
  useCreateCustomTypographyMutation: () => [mockCreate, { isLoading: false }],
  useListCustomTypographiesQuery: () => ({ data: [], isLoading: false }),
  useDeleteCustomTypographyMutation: () => [mockDelete, { isLoading: false }],
}));

import { renderWithProviders } from '@/utils/test-utils';
import CustomTypographyCreator from '../CustomTypographyCreator';

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
  mockDelete.mockReset();
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
  'A bold, condensed sans-serif headline paired with a clean monospaced ' +
  'sub-line; high contrast between weights gives a poster-like rhythm.';

describe('CustomTypographyCreator', () => {
  it('step 1 upload — accepts a valid JPG and enables Next', async () => {
    mockBoard.mockReturnValue({ data: { references: [], designs: [] } });
    const user = userEvent.setup();
    renderWithProviders(<CustomTypographyCreator {...baseProps} />);

    const dropZone = screen.getByLabelText(/Upload image drop zone/i);
    const input = dropZone.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'pic.jpg', { type: 'image/jpeg' });

    await user.upload(input, file);

    expect(screen.getByAltText(/Selected upload preview/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Next/i })).toBeEnabled();
  });

  it('step 1 upload — rejects an oversize file', async () => {
    mockBoard.mockReturnValue({ data: { references: [], designs: [] } });
    const user = userEvent.setup();
    renderWithProviders(<CustomTypographyCreator {...baseProps} />);

    const dropZone = screen.getByLabelText(/Upload image drop zone/i);
    const input = dropZone.querySelector('input[type="file"]') as HTMLInputElement;
    const big = new File([new Uint8Array(11 * 1024 * 1024)], 'big.jpg', {
      type: 'image/jpeg',
    });

    await user.upload(input, big);

    expect(screen.getByRole('alert')).toHaveTextContent(/max 10 MB/i);
    expect(screen.getByRole('button', { name: /Next/i })).toBeDisabled();
  });

  it('step 1 upload — rejects a non-image mime', () => {
    mockBoard.mockReturnValue({ data: { references: [], designs: [] } });
    renderWithProviders(<CustomTypographyCreator {...baseProps} />);

    const dropZone = screen.getByLabelText(/Upload image drop zone/i);
    const input = dropZone.querySelector('input[type="file"]') as HTMLInputElement;
    const bad = new File(['gif87a'], 'pic.gif', { type: 'image/gif' });
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
    renderWithProviders(<CustomTypographyCreator {...baseProps} />);

    const dropZone = screen.getByLabelText(/Upload image drop zone/i);
    const input = dropZone.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File(['x'], 'pic.jpg', { type: 'image/jpeg' }));
    await user.click(screen.getByRole('button', { name: /Next/i }));

    expect(await screen.findByDisplayValue(longPrompt)).toBeInTheDocument();
  });

  it('step 2 — shows forbidden-terms alert on 422', async () => {
    mockBoard.mockReturnValue({ data: { references: [], designs: [] } });
    analyzeState.error = {
      status: 422,
      data: {
        error: 'typography_analysis_failed',
        forbidden_terms: ['neon', 'pixel'],
      },
    };
    mockAnalyze.mockReturnValue({
      unwrap: () => Promise.reject(analyzeState.error),
    });
    const user = userEvent.setup();
    renderWithProviders(<CustomTypographyCreator {...baseProps} />);

    const dropZone = screen.getByLabelText(/Upload image drop zone/i);
    const input = dropZone.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File(['x'], 'pic.jpg', { type: 'image/jpeg' }));
    await user.click(screen.getByRole('button', { name: /Next/i }));

    expect(
      await screen.findByText(/Forbidden terms detected/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/neon, pixel/i)).toBeInTheDocument();
  });

  it('step 3 — save calls createCustomTypography mutation and onCreated', async () => {
    mockBoard.mockReturnValue({ data: { references: [], designs: [] } });
    mockAnalyze.mockReturnValue({
      unwrap: () => Promise.resolve({ prompt_text: longPrompt, model: 'm' }),
    });
    mockCreate.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          id: 'new-uuid',
          name: 'X',
          prompt_text: longPrompt,
        }),
    });
    const onCreated = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <CustomTypographyCreator {...baseProps} onCreated={onCreated} />,
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
    fireEvent.change(nameInput, { target: { value: 'My typography' } });
    await user.click(screen.getByRole('button', { name: /^Save$/i }));

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'My typography',
        prompt_text: longPrompt,
        source_kind: 'upload',
      }),
    );
    // onCreated receives the new entry's prompt_text (not its id) so the
    // parent TypographyPickerModal can auto-select by its value-by-text
    // semantics.
    expect(onCreated).toHaveBeenCalledWith(longPrompt);
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
          data: { name: 'A custom typography with that name already exists.' },
        }),
    });
    const user = userEvent.setup();
    renderWithProviders(<CustomTypographyCreator {...baseProps} />);

    const dropZone = screen.getByLabelText(/Upload image drop zone/i);
    const input = dropZone.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File(['x'], 'pic.jpg', { type: 'image/jpeg' }));
    await user.click(screen.getByRole('button', { name: /Next/i }));
    await screen.findByDisplayValue(longPrompt);
    await user.click(screen.getByRole('button', { name: /Next/i }));

    const nameInput = screen.getByLabelText(/^Name$/i);
    fireEvent.change(nameInput, { target: { value: 'Duplicate' } });
    await user.click(screen.getByRole('button', { name: /^Save$/i }));

    expect(
      await screen.findByText(/already used in this workspace/i),
    ).toBeInTheDocument();
  });

  it('step 2 — analyzer-unavailable (502) shows retry CTA', async () => {
    mockBoard.mockReturnValue({ data: { references: [], designs: [] } });
    analyzeState.error = { status: 502, data: { error: 'analyzer_unavailable' } };
    // Note the backend error code is 'analyzer_unavailable' (no nested
    // typography_unclear / typography_analysis_failed), so the generic
    // !errCode branch in Step2Analyze renders.
    analyzeState.error = { status: 502, data: {} };
    mockAnalyze.mockReturnValue({
      unwrap: () => Promise.reject(analyzeState.error),
    });
    const user = userEvent.setup();
    renderWithProviders(<CustomTypographyCreator {...baseProps} />);

    const dropZone = screen.getByLabelText(/Upload image drop zone/i);
    const input = dropZone.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File(['x'], 'pic.jpg', { type: 'image/jpeg' }));
    await user.click(screen.getByRole('button', { name: /Next/i }));

    expect(
      await screen.findByText(/Analyzer unavailable/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
  });
});
