import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import PublishToolbar from '../partials/toolbar/PublishToolbar';
import type { BreadcrumbSegment, FileSystemTab, ViewMode } from '../types';

// ---------------------------------------------------------------------------
// Props — baseline toolbar state used across tests. `my_designs` tab keeps
// labels stable ("Collections", "Upload") so we don't chase tab-dependent
// copy changes in assertions.
// ---------------------------------------------------------------------------

const makeProps = (overrides: Record<string, unknown> = {}) => ({
  selectedCount: 0,
  totalCount: 12,
  hasSelection: false,
  onSelectAll: vi.fn(),
  onSelectNone: vi.fn(),
  viewMode: 'grid' as ViewMode,
  onViewModeChange: vi.fn(),
  searchQuery: '',
  onSearchChange: vi.fn(),
  activeTab: 'my_designs' as FileSystemTab,
  onTabChange: vi.fn(),
  cloudConnected: false,
  breadcrumbs: [] as BreadcrumbSegment[],
  onBreadcrumbNavigate: vi.fn(),
  transferCount: 0,
  onTransferClick: vi.fn(),
  onCollectionsOpen: vi.fn(),
  onCommandPaletteOpen: vi.fn(),
  onTemplateClick: vi.fn(),
  onUploadClick: vi.fn(),
  onPublishClick: vi.fn(),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PublishToolbar', () => {
  it('renders the selection counter, Collections button, view toggle, and search field', () => {
    renderWithProviders(<PublishToolbar {...makeProps()} />);

    // SelectCounter renders `<selected>/<total>` inside an aria-labelled Button.
    expect(
      screen.getByRole('button', { name: /select designs/i }),
    ).toHaveTextContent('0/12');

    // Named MUI Buttons in the primary row.
    expect(
      screen.getByRole('button', { name: /collections/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /choose action/i }),
    ).toBeInTheDocument();

    // View-mode ToggleButtonGroup — both buttons are visible.
    expect(
      screen.getByRole('button', { name: /list view/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /grid view/i }),
    ).toBeInTheDocument();

    // Search TextField — placeholder survives because the `t` stub returns
    // the defaultValue unchanged in the test i18n bundle.
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
  });

  it('fires onCollectionsOpen when the Collections button is clicked', () => {
    const onCollectionsOpen = vi.fn();
    renderWithProviders(
      <PublishToolbar {...makeProps({ onCollectionsOpen })} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /collections/i }));

    expect(onCollectionsOpen).toHaveBeenCalledTimes(1);
  });

  it('calls onViewModeChange with the selected mode when a view toggle is clicked', () => {
    const onViewModeChange = vi.fn();
    // Start in grid so clicking "List view" produces a non-null value (the
    // ToggleButtonGroup ignores null / same-value clicks).
    renderWithProviders(
      <PublishToolbar
        {...makeProps({ viewMode: 'grid', onViewModeChange })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /list view/i }));
    expect(onViewModeChange).toHaveBeenCalledWith('list');

    // Start a fresh render in list mode to test the inverse transition.
    const onViewModeChange2 = vi.fn();
    renderWithProviders(
      <PublishToolbar
        {...makeProps({ viewMode: 'list', onViewModeChange: onViewModeChange2 })}
      />,
    );
    fireEvent.click(screen.getAllByRole('button', { name: /grid view/i })[1]);
    expect(onViewModeChange2).toHaveBeenCalledWith('grid');
  });

  // -------------------------------------------------------------------------
  // E2 — Toolbar extras: 2-row layout, tab switch wiring, breadcrumb path.
  // These assertions complement the basic composition tests above by covering
  // the full toolbar shell (Row 1 actions + Row 2 tabs/breadcrumbs).
  // -------------------------------------------------------------------------

  it('renders both toolbar rows — primary actions plus tabs + breadcrumbs', () => {
    // Pass a breadcrumb path so Row 2's BreadcrumbNav region is populated.
    renderWithProviders(
      <PublishToolbar
        {...makeProps({
          breadcrumbs: [
            { id: null, label: 'Home' },
            { id: 'folder-1', label: 'Summer' },
          ],
        })}
      />,
    );

    // Row 1 marker — the Collections button only exists on the primary row.
    expect(
      screen.getByRole('button', { name: /collections/i }),
    ).toBeInTheDocument();

    // Row 2 marker — FileSystemTabs exposes role="tab" for both entries.
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toHaveTextContent(/my designs/i);
    expect(tabs[1]).toHaveTextContent(/cloud storage/i);

    // Row 2 marker — BreadcrumbNav is identified by its aria-label region.
    const breadcrumbs = screen.getByLabelText(/breadcrumb navigation/i);
    expect(breadcrumbs).toBeInTheDocument();
    expect(breadcrumbs).toHaveTextContent(/home/i);
    expect(breadcrumbs).toHaveTextContent(/summer/i);
  });

  it('fires onTabChange when switching between My Designs and Cloud Storage', () => {
    const onTabChange = vi.fn();
    renderWithProviders(
      <PublishToolbar
        {...makeProps({ activeTab: 'my_designs', onTabChange })}
      />,
    );

    // Click the Cloud Storage tab — handler fires with the new tab id.
    fireEvent.click(screen.getByRole('tab', { name: /cloud storage/i }));
    expect(onTabChange).toHaveBeenLastCalledWith('cloud_storage');

    // Click back to My Designs — handler fires with the original id.
    fireEvent.click(screen.getByRole('tab', { name: /my designs/i }));
    expect(onTabChange).toHaveBeenLastCalledWith('my_designs');
    expect(onTabChange).toHaveBeenCalledTimes(2);
  });

  it('BreadcrumbNav renders the full folder path when segments are passed', () => {
    const segments = [
      { id: null, label: 'Home' },
      { id: 'folder-1', label: 'Summer' },
      { id: 'folder-2', label: 'Slogans' },
    ];
    renderWithProviders(
      <PublishToolbar {...makeProps({ breadcrumbs: segments })} />,
    );

    const region = screen.getByLabelText(/breadcrumb navigation/i);
    for (const s of segments) {
      expect(region).toHaveTextContent(s.label);
    }
  });
});
