import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../../utils/test-utils';
import TopbarChipSelector from '../TopbarChipSelector';

const OPTIONS = [
  { id: '1', label: 'Alpha' },
  { id: '2', label: 'Beta' },
];

describe('TopbarChipSelector', () => {
  it('renders the placeholder when value is null', () => {
    renderWithProviders(
      <TopbarChipSelector
        value={null}
        placeholder="Pick"
        options={OPTIONS}
        onChange={() => {}}
        menuId="m"
        testId="t"
      />,
    );
    expect(screen.getByTestId('t')).toHaveTextContent('Pick');
  });

  it('renders the selected label when value matches an option', () => {
    renderWithProviders(
      <TopbarChipSelector
        value="2"
        placeholder="Pick"
        options={OPTIONS}
        onChange={() => {}}
        menuId="m"
        testId="t"
      />,
    );
    expect(screen.getByTestId('t')).toHaveTextContent('Beta');
  });

  it('opens the menu on click and fires onChange with the right id', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <TopbarChipSelector
        value={null}
        placeholder="Pick"
        options={OPTIONS}
        onChange={onChange}
        menuId="m"
        testId="t"
      />,
    );
    fireEvent.click(screen.getByTestId('t'));
    fireEvent.click(screen.getByText('Alpha'));
    expect(onChange).toHaveBeenCalledWith('1');
  });

  it('renders a skeleton when loading', () => {
    renderWithProviders(
      <TopbarChipSelector
        value={null}
        placeholder="Pick"
        options={[]}
        onChange={() => {}}
        loading
        menuId="m"
        testId="t"
      />,
    );
    expect(screen.queryByTestId('t')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Pick')).toBeInTheDocument();
  });

  it('shows the empty label when options is empty', () => {
    renderWithProviders(
      <TopbarChipSelector
        value={null}
        placeholder="Pick"
        options={[]}
        emptyLabel="Nothing here"
        onChange={() => {}}
        menuId="m"
        testId="t"
      />,
    );
    fireEvent.click(screen.getByTestId('t'));
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });
});
