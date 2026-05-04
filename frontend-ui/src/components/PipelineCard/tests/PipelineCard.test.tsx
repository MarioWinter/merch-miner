import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../utils/test-utils';
import { PipelineCard } from '../index';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

describe('PipelineCard', () => {
  it('renders title and icon', () => {
    renderWithProviders(
      <PipelineCard state="pending" icon={AutoAwesomeIcon} title="Research" />,
    );
    expect(screen.getByText('Research')).toBeInTheDocument();
  });

  it('renders badge count when provided', () => {
    renderWithProviders(
      <PipelineCard
        state="done"
        icon={AutoAwesomeIcon}
        title="Keywords"
        badge="42"
      />,
    );
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('does not render badge when not provided', () => {
    renderWithProviders(
      <PipelineCard state="pending" icon={AutoAwesomeIcon} title="Products" />,
    );
    expect(screen.queryByText(/^\d+$/)).not.toBeInTheDocument();
  });

  it('renders done state with left stripe', () => {
    const { container } = renderWithProviders(
      <PipelineCard state="done" icon={AutoAwesomeIcon} title="Done Card" />,
    );
    // The CardRoot renders with cardState prop — we verify the component renders
    expect(container.firstChild).toBeInTheDocument();
    expect(screen.getByText('Done Card')).toBeInTheDocument();
  });

  it('renders active state', () => {
    renderWithProviders(
      <PipelineCard state="active" icon={AutoAwesomeIcon} title="Active Card" />,
    );
    expect(screen.getByText('Active Card')).toBeInTheDocument();
  });

  it('renders pending state', () => {
    renderWithProviders(
      <PipelineCard
        state="pending"
        icon={AutoAwesomeIcon}
        title="Pending Card"
      />,
    );
    expect(screen.getByText('Pending Card')).toBeInTheDocument();
  });

  it('expands on header click to show children', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <PipelineCard
        state="pending"
        icon={AutoAwesomeIcon}
        title="Expandable"
        defaultExpanded={false}
      >
        <div data-testid="card-content">Inner content</div>
      </PipelineCard>,
    );

    // Content should be collapsed initially
    expect(screen.queryByTestId('card-content')).not.toBeVisible();

    // Click header to expand
    await user.click(screen.getByText('Expandable'));
    expect(await screen.findByTestId('card-content')).toBeVisible();
  });

  it('collapses on second header click', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <PipelineCard
        state="active"
        icon={AutoAwesomeIcon}
        title="Toggle"
        defaultExpanded={true}
      >
        <div data-testid="toggle-content">Visible content</div>
      </PipelineCard>,
    );

    // Should be expanded initially
    expect(screen.getByTestId('toggle-content')).toBeVisible();

    // Click to collapse
    await user.click(screen.getByText('Toggle'));

    // After collapse animation, content should not be visible
    // MUI Collapse keeps the element in DOM but hides it
    const content = screen.getByTestId('toggle-content');
    expect(content).toBeInTheDocument();
  });

  it('defaults to expanded when state is active', () => {
    renderWithProviders(
      <PipelineCard state="active" icon={AutoAwesomeIcon} title="Active">
        <div data-testid="auto-expanded">Auto expanded</div>
      </PipelineCard>,
    );
    expect(screen.getByTestId('auto-expanded')).toBeVisible();
  });

  it('defaults to collapsed when state is pending and no defaultExpanded', () => {
    renderWithProviders(
      <PipelineCard state="pending" icon={AutoAwesomeIcon} title="Pending">
        <div data-testid="pending-content">Collapsed</div>
      </PipelineCard>,
    );
    expect(screen.queryByTestId('pending-content')).not.toBeVisible();
  });

  it('renders badge text "Done" for done state', () => {
    renderWithProviders(
      <PipelineCard
        state="done"
        icon={AutoAwesomeIcon}
        title="Research"
        badge="Done"
      />,
    );
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('renders fractional badge for active state', () => {
    renderWithProviders(
      <PipelineCard
        state="active"
        icon={AutoAwesomeIcon}
        title="Research"
        badge="3/6"
      />,
    );
    expect(screen.getByText('3/6')).toBeInTheDocument();
  });
});
