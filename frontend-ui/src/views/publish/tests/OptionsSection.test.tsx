import { describe, it, expect } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { renderWithProviders } from '@/utils/test-utils';
import {
  mbaListingDefaultValues,
  mbaListingSchema,
  type MbaListingFormValues,
} from '../schemas/mbaListingSchema';
import OptionsSection from '../partials/edit/OptionsSection';

// ---------------------------------------------------------------------------
// Harness — wraps OptionsSection in a real react-hook-form instance so the
// Controller bindings resolve correctly.
// ---------------------------------------------------------------------------

interface HarnessProps {
  defaultValues?: Partial<MbaListingFormValues>;
}

const Harness = ({ defaultValues }: HarnessProps) => {
  const { control } = useForm<MbaListingFormValues>({
    resolver: zodResolver(mbaListingSchema),
    defaultValues: { ...mbaListingDefaultValues, ...defaultValues },
    mode: 'onChange',
  });
  const availability = useWatch({ control, name: 'availability' });
  const publishMode = useWatch({ control, name: 'publish_mode' });
  return (
    <>
      <OptionsSection control={control} />
      {/* Emit the watched values as data-attrs so tests can assert on the
          controlled form state without needing full RHF introspection. */}
      <div
        data-testid="HarnessState"
        data-availability={availability}
        data-publish-mode={publishMode}
      />
    </>
  );
};

// ---------------------------------------------------------------------------
// Tests — Phase P9
// ---------------------------------------------------------------------------

describe('OptionsSection — Phase P9 (replaces OptionsTrademarksTabs)', () => {
  it('renders Availability + Publish radios and nothing else — no Tabs chrome, no Trademarks', () => {
    renderWithProviders(<Harness />);
    expect(screen.getByTestId('OptionsSection')).toBeInTheDocument();
    // Both radio groups present.
    expect(
      screen.getByRole('radiogroup', { name: /availability/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('radiogroup', { name: /publish/i }),
    ).toBeInTheDocument();
    // No MUI Tabs wrapper, no Trademarks remnants.
    expect(screen.queryByRole('tab', { name: /trademarks/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/run tm check/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/trademark/i)).not.toBeInTheDocument();
  });

  it('marks the Availability radio matching the form default (public)', () => {
    renderWithProviders(<Harness />);
    expect(
      screen.getByRole('radio', { name: /public/i }),
    ).toBeChecked();
    expect(
      screen.getByRole('radio', { name: /private/i }),
    ).not.toBeChecked();
  });

  it('selecting Private flips the form state', () => {
    renderWithProviders(<Harness />);
    fireEvent.click(screen.getByRole('radio', { name: /private/i }));
    expect(screen.getByTestId('HarnessState')).toHaveAttribute(
      'data-availability',
      'private',
    );
  });

  it('selecting Draft flips publish_mode', () => {
    renderWithProviders(<Harness defaultValues={{ publish_mode: 'live' }} />);
    fireEvent.click(screen.getByRole('radio', { name: /draft/i }));
    expect(screen.getByTestId('HarnessState')).toHaveAttribute(
      'data-publish-mode',
      'draft',
    );
  });
});
