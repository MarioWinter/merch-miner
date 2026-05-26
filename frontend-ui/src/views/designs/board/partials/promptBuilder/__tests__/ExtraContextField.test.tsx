// PROJ-34 Phase 13e — ExtraContextField unit tests.
// Optional, free-text multiline TextField; appended verbatim before tech specs.

import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import ExtraContextField from '../ExtraContextField';

describe('ExtraContextField', () => {
  it('renders with placeholder when empty', () => {
    renderWithProviders(<ExtraContextField value="" onChange={vi.fn()} />);
    const textarea = screen.getByPlaceholderText(
      /Optional custom additions appended verbatim before the tech specs/i,
    );
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveValue('');
  });

  it('fires onChange when the user types', () => {
    const onChange = vi.fn();
    renderWithProviders(<ExtraContextField value="" onChange={onChange} />);
    const textarea = screen.getByPlaceholderText(
      /Optional custom additions/i,
    );
    fireEvent.change(textarea, { target: { value: 'avoid red palette' } });
    expect(onChange).toHaveBeenCalledWith('avoid red palette');
  });

  it('reflects the current value', () => {
    renderWithProviders(
      <ExtraContextField value="prefer pastel tones" onChange={vi.fn()} />,
    );
    expect(screen.getByDisplayValue('prefer pastel tones')).toBeInTheDocument();
  });
});
