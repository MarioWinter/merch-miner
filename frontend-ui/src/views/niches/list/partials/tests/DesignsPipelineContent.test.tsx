import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/utils/test-utils';

// Mock RTK Query hooks ---------------------------------------------------
const mockSend = vi.fn();
const mockNavigate = vi.fn();
const mockFetchBoard = vi.fn();

vi.mock('@/store/designSlice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/store/designSlice')>();
  return {
    ...actual,
    useListProjectsQuery: () => ({
      data: {
        results: [
          {
            id: 'p1',
            name: 'Project Alpha',
            niche: 'n1',
            design_count: 3,
            thumbnail: null,
            niche_name: null,
          },
        ],
      },
      isLoading: false,
    }),
    useLazyGetProjectBoardQuery: () => [
      (...args: unknown[]) => {
        mockFetchBoard(...args);
        return {
          unwrap: () =>
            Promise.resolve({
              designs: [
                { id: 'd1', status: 'approved' },
                { id: 'd2', status: 'pending' },
                { id: 'd3', status: 'approved' },
              ],
            }),
        };
      },
      {},
    ],
  };
});

vi.mock('@/hooks/useSendDesignsToListings', () => ({
  default: () => ({
    send: mockSend,
    isSending: false,
    pendingConfirm: null,
    confirmPending: vi.fn(),
    cancelPending: vi.fn(),
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

import { DesignsPipelineContent } from '../DesignsPipelineContent';

describe('DesignsPipelineContent — Send to Listings (PROJ-9 Phase O AC-172)', () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockNavigate.mockReset();
    mockFetchBoard.mockReset();
  });

  it('renders project rows for the niche', () => {
    renderWithProviders(<DesignsPipelineContent nicheId="n1" />);
    expect(screen.getByText('Project Alpha')).toBeInTheDocument();
  });

  it('clicking Send to Listings calls mutation with approved design ids and does NOT navigate to /listings', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DesignsPipelineContent nicheId="n1" />);

    const sendBtn = screen.getByRole('button', { name: /Send to Listings/i });
    await user.click(sendBtn);

    await waitFor(() => expect(mockSend).toHaveBeenCalledTimes(1));
    expect(mockSend).toHaveBeenCalledWith(['d1', 'd3']);
    // Navigate must NOT have been called with the legacy /listings query
    expect(mockNavigate).not.toHaveBeenCalledWith(expect.stringMatching(/^\/listings/));
  });
});
