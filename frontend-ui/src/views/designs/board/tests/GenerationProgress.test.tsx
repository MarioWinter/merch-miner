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
import RegenerateOverlay from '../partials/RegenerateOverlay';
import { makeDesignRun } from './fixtures';

afterEach(() => {
  vi.clearAllMocks();
});

describe('SkeletonPulse (generation progress visual)', () => {
  // SkeletonPulse uses react-konva which doesn't render in JSDOM.
  // We verify the module can be imported correctly.
  it('module exports default component', async () => {
    const mod = await import('../partials/SkeletonPulse');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

describe('RegenerateOverlay', () => {
  it('renders regenerate button with correct label', () => {
    renderWithProviders(
      <RegenerateOverlay
        screenX={100}
        screenY={200}
        onRegenerate={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Regenerate')).toBeInTheDocument();
    expect(screen.getByText('Regenerate')).toBeInTheDocument();
  });

  it('calls onRegenerate when clicked', () => {
    const onRegenerate = vi.fn();
    renderWithProviders(
      <RegenerateOverlay
        screenX={100}
        screenY={200}
        onRegenerate={onRegenerate}
      />,
    );
    fireEvent.click(screen.getByText('Regenerate'));
    expect(onRegenerate).toHaveBeenCalledOnce();
  });

  it('positions button at given screen coordinates', () => {
    renderWithProviders(
      <RegenerateOverlay
        screenX={250}
        screenY={400}
        onRegenerate={vi.fn()}
      />,
    );
    const btn = screen.getByLabelText('Regenerate');
    expect(btn).toHaveStyle({ left: '250px', top: '400px' });
  });
});

describe('Generation run status data', () => {
  it('pending run has status pending', () => {
    const run = makeDesignRun({ status: 'pending', completed_at: null });
    expect(run.status).toBe('pending');
    expect(run.completed_at).toBeNull();
  });

  it('running run has status running', () => {
    const run = makeDesignRun({ status: 'running', completed_at: null });
    expect(run.status).toBe('running');
  });

  it('completed run has completed_at timestamp', () => {
    const run = makeDesignRun({ status: 'completed' });
    expect(run.status).toBe('completed');
    expect(run.completed_at).toBeTruthy();
  });

  it('failed run has error_message', () => {
    const run = makeDesignRun({
      status: 'failed',
      error_message: 'Content policy violation',
      completed_at: null,
    });
    expect(run.status).toBe('failed');
    expect(run.error_message).toBe('Content policy violation');
  });
});
