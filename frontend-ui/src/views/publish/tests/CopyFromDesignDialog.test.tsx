import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import type { DesignAsset } from '../types';
import CopyFromDesignDialog from '../partials/edit/CopyFromDesignDialog';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeDesign = (overrides: Partial<DesignAsset> = {}): DesignAsset => ({
  id: 'design-1',
  workspace: 'ws-1',
  file_name: 'front.png',
  file_url: '',
  source: 'upload',
  source_file_id: '',
  thumbnail_url: '',
  dimensions: { width: 1, height: 1 },
  file_size: 1,
  tags: [],
  listing: null,
  idea: null,
  niche: null,
  collection: null,
  round: 1,
  created_by: 'user-1',
  created_at: '',
  ...overrides,
});

const defaultDesigns: DesignAsset[] = [
  makeDesign({ id: 'design-1', file_name: 'active.png' }),
  makeDesign({ id: 'src-a', file_name: 'source-a.png', idea: 'idea-a' }),
  makeDesign({ id: 'src-b', file_name: 'source-b.png' }),
];

// ---------------------------------------------------------------------------
// Tests — dialog is dumb: it wires user intent (pick source + click Apply)
// to the onConfirm prop. 404 / success feedback is owned by useEditView
// and covered in useEditView.copy.test.ts.
// ---------------------------------------------------------------------------

describe('CopyFromDesignDialog', () => {
  let onConfirm: ReturnType<typeof vi.fn>;
  let onClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onConfirm = vi.fn();
    onClose = vi.fn();
  });

  it('renders the dialog + picker when open', () => {
    renderWithProviders(
      <CopyFromDesignDialog
        open
        scope="colors"
        designs={defaultDesigns}
        activeDesignId="design-1"
        isApplying={false}
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );

    // Title reflects the non-listing scope.
    expect(
      screen.getByRole('heading', { name: /copy colors from/i }),
    ).toBeInTheDocument();

    // Source designs (excluding the active one) appear as radios.
    expect(screen.getByText('source-a.png')).toBeInTheDocument();
    expect(screen.getByText('source-b.png')).toBeInTheDocument();
    // Active design is filtered out.
    expect(screen.queryByText('active.png')).not.toBeInTheDocument();

    // Apply + Cancel buttons present.
    expect(
      screen.getByRole('button', { name: /^apply$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^cancel$/i }),
    ).toBeInTheDocument();
  });

  it('Apply fires onConfirm with (sourceDesignId, scope) for scope=colors', () => {
    renderWithProviders(
      <CopyFromDesignDialog
        open
        scope="colors"
        designs={defaultDesigns}
        activeDesignId="design-1"
        isApplying={false}
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );

    // First selectable source (src-a) is pre-selected when the dialog opens.
    // Switch to src-b to prove the radio change flows through.
    fireEvent.click(screen.getByRole('radio', { name: /source-b\.png/i }));

    fireEvent.click(screen.getByRole('button', { name: /^apply$/i }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith('src-b', 'colors');
  });

  it('forwards the chosen scope (fit_types) through onConfirm', () => {
    renderWithProviders(
      <CopyFromDesignDialog
        open
        scope="fit_types"
        designs={defaultDesigns}
        activeDesignId="design-1"
        isApplying={false}
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );

    // Title reflects the fit_types scope.
    expect(
      screen.getByRole('heading', { name: /copy fit types from/i }),
    ).toBeInTheDocument();

    // User picks a source + applies — scope is forwarded verbatim.
    fireEvent.click(screen.getByRole('radio', { name: /source-a\.png/i }));
    fireEvent.click(screen.getByRole('button', { name: /^apply$/i }));

    expect(onConfirm).toHaveBeenCalledWith('src-a', 'fit_types');
  });

  it('Cancel button calls onClose', () => {
    renderWithProviders(
      <CopyFromDesignDialog
        open
        scope="prices"
        designs={defaultDesigns}
        activeDesignId="design-1"
        isApplying={false}
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('Apply is disabled when there are no selectable sources', () => {
    // Only the active design in the list — nothing left to copy from.
    renderWithProviders(
      <CopyFromDesignDialog
        open
        scope="colors"
        designs={[makeDesign({ id: 'design-1', file_name: 'solo.png' })]}
        activeDesignId="design-1"
        isApplying={false}
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );

    // i18n resolves `publish.copyFrom.noSources` — assert on the visible copy.
    expect(
      screen.getByText(/no other designs available to copy from/i),
    ).toBeInTheDocument();

    const applyBtn = screen.getByRole('button', { name: /^apply$/i });
    expect(applyBtn).toBeDisabled();
  });

  it('disables Apply + Cancel while a copy is in flight (isApplying=true)', () => {
    renderWithProviders(
      <CopyFromDesignDialog
        open
        scope="colors"
        designs={defaultDesigns}
        activeDesignId="design-1"
        isApplying
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );

    const applyBtn = screen.getByRole('button', { name: /applying/i });
    expect(applyBtn).toBeDisabled();
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeDisabled();
  });

  it('does not render the selectable list when closed', () => {
    const { container } = renderWithProviders(
      <CopyFromDesignDialog
        open={false}
        scope="colors"
        designs={defaultDesigns}
        activeDesignId="design-1"
        isApplying={false}
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );

    // MUI Dialog unmounts its body when closed — no heading in the DOM.
    expect(
      within(container).queryByRole('heading', { name: /copy colors from/i }),
    ).not.toBeInTheDocument();
  });
});
