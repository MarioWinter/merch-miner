import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../../../utils/test-utils';

// Mock RTK Query hooks used by the modal — keeps the test fast + deterministic
const mockSaveSnippet = vi.fn();

vi.mock('@/store/nicheSlice', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useListNichesQuery: () => ({
      data: {
        count: 1,
        next: null,
        previous: null,
        results: [
          {
            id: 'niche-1',
            workspace: 'ws-1',
            name: 'Cats',
            notes: '',
            status: 'data_entry',
            potential_rating: null,
            research_status: null,
            research_run_id: null,
            research_progress: null,
            position: 0,
            assigned_to: null,
            created_by: 1,
            created_at: '',
            updated_at: '',
            idea_count: 0,
            approved_idea_count: 0,
          },
        ],
      },
      isLoading: false,
    }),
  };
});

vi.mock('@/store/searchSlice', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useSaveSnippetToNicheMutation: () => [mockSaveSnippet, { isLoading: false }],
  };
});

import SaveToNicheModal from '../SaveToNicheModal';

describe('SaveToNicheModal', () => {
  beforeEach(() => {
    mockSaveSnippet.mockReset();
  });

  it('renders title + description + preview when open', () => {
    renderWithProviders(
      <SaveToNicheModal
        open
        onClose={() => {}}
        selectedText="Some interesting snippet from the web"
        saveAs="keywords"
      />,
    );

    expect(screen.getByText('Save to Niche')).toBeInTheDocument();
    // Preview text rendered
    expect(screen.getByText(/Some interesting snippet/)).toBeInTheDocument();
    // Action buttons
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('disables Save until a niche is picked', () => {
    renderWithProviders(
      <SaveToNicheModal
        open
        onClose={() => {}}
        selectedText="hello world"
        saveAs="notes"
      />,
    );
    const saveBtn = screen.getByRole('button', { name: 'Save' });
    expect(saveBtn).toBeDisabled();
  });

  it('does not render when closed', () => {
    renderWithProviders(
      <SaveToNicheModal
        open={false}
        onClose={() => {}}
        selectedText="hidden"
        saveAs="keywords"
      />,
    );
    expect(screen.queryByText('Save to Niche')).not.toBeInTheDocument();
  });
});
