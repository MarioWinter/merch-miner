// PROJ-34 Phase 13e — VisualDescriptionField unit tests.
// Required multiline TextField that drives the Architect "Visual Description"
// slot. Helper text reminds the user of the ≥6 concrete-details rule.

import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import VisualDescriptionField from '../VisualDescriptionField';

describe('VisualDescriptionField', () => {
  it('renders with placeholder and helper text when empty', () => {
    renderWithProviders(
      <VisualDescriptionField value="" onChange={vi.fn()} />,
    );
    expect(
      screen.getByPlaceholderText(
        /a stylized illustration of \[SUBJECT\] in \[PERSPECTIVE\]/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Describe the illustration: subject, perspective, 6\+ concrete details/i,
      ),
    ).toBeInTheDocument();
  });

  it('shows the required marker on the label', () => {
    renderWithProviders(
      <VisualDescriptionField value="" onChange={vi.fn()} />,
    );
    // MUI renders the label both as an outer <label> and inside the
    // <fieldset><legend> mirror, so look up only the outer one.
    const label = document.querySelector('label');
    expect(label).not.toBeNull();
    expect(label?.textContent ?? '').toMatch(/Visual Description/i);
    // Required asterisk is added by MUI for `required`.
    expect(label?.textContent ?? '').toMatch(/\*/);
  });

  it('fires onChange with the new value', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <VisualDescriptionField value="" onChange={onChange} />,
    );
    const textarea = screen.getByPlaceholderText(/stylized illustration/i);
    fireEvent.change(textarea, {
      target: {
        value:
          'a stylized illustration of a school bus driver in three-quarter view, wearing a vintage cap',
      },
    });
    expect(onChange).toHaveBeenCalledWith(
      'a stylized illustration of a school bus driver in three-quarter view, wearing a vintage cap',
    );
  });

  it('reflects the current value via the rendered TextField', () => {
    renderWithProviders(
      <VisualDescriptionField
        value="centered cartoon taco with sunglasses"
        onChange={vi.fn()}
      />,
    );
    expect(
      screen.getByDisplayValue('centered cartoon taco with sunglasses'),
    ).toBeInTheDocument();
  });
});
