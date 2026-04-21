import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { renderWithProviders } from '@/utils/test-utils';
import {
  mbaListingSchema,
  mbaListingDefaultValues,
  MBA_LISTING_CHAR_LIMITS,
  type MbaListingFormValues,
} from '../schemas/mbaListingSchema';
import ListingField from '../partials/edit/ListingField';

// ---------------------------------------------------------------------------
// Test harness — wraps ListingField in a real react-hook-form instance so the
// Controller binding resolves correctly. Callers seed the initial value via
// defaultValues to drive the counter + severity assertions.
// ---------------------------------------------------------------------------

interface HarnessProps {
  initialValue?: string;
  onOptionsClick?: (context: string) => void;
  onAiImprove?: (value: string) => void;
  fieldName?: 'title' | 'description';
}

const Harness = ({
  initialValue = '',
  onOptionsClick,
  onAiImprove,
  fieldName = 'title',
}: HarnessProps) => {
  const { control } = useForm<MbaListingFormValues>({
    resolver: zodResolver(mbaListingSchema),
    defaultValues: { ...mbaListingDefaultValues, [fieldName]: initialValue },
    mode: 'onChange',
  });
  return (
    <ListingField
      name={fieldName}
      control={control}
      maxChars={MBA_LISTING_CHAR_LIMITS[fieldName]}
      label={fieldName === 'title' ? 'Title' : 'Description'}
      context={fieldName}
      onOptionsClick={onOptionsClick}
      onAiImprove={onAiImprove}
    />
  );
};

// Helper — find the char-counter Typography by its `x/max` text signature.
const getCounter = (max: number) =>
  screen.getByText(new RegExp(`^\\d+/${max}$`));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ListingField', () => {
  it('renders the char counter as `current/max`', () => {
    // Seed 5 chars against the title limit (60) so the counter reads `5/60`.
    renderWithProviders(<Harness initialValue="Hello" fieldName="title" />);

    const counter = getCounter(MBA_LISTING_CHAR_LIMITS.title);
    expect(counter).toHaveTextContent(`5/${MBA_LISTING_CHAR_LIMITS.title}`);
  });

  it('updates the counter as the user types', async () => {
    renderWithProviders(<Harness fieldName="title" />);
    const input = screen.getByRole('textbox', { name: /title/i });

    // Counter starts at 0/60, jumps to 5/60 after typing.
    expect(getCounter(MBA_LISTING_CHAR_LIMITS.title)).toHaveTextContent(
      `0/${MBA_LISTING_CHAR_LIMITS.title}`,
    );
    await userEvent.type(input, 'ABCDE');
    expect(getCounter(MBA_LISTING_CHAR_LIMITS.title)).toHaveTextContent(
      `5/${MBA_LISTING_CHAR_LIMITS.title}`,
    );
  });

  it('tints the counter amber at >=90% and red at >=100% of the limit', () => {
    const max = MBA_LISTING_CHAR_LIMITS.title; // 60

    // ---- NORMAL (<90%) -----------------------------------------------------
    // getSeverity: length < floor(max * 0.9) → 'normal' → color = text.disabled.
    const { unmount: unmountNormal } = renderWithProviders(
      <Harness initialValue={'A'.repeat(10)} fieldName="title" />,
    );
    const normalCounter = getCounter(max);
    // MUI resolves `text.disabled` via the CSS var — colour must NOT match
    // the error or warning token classes for the amber/red branches.
    expect(normalCounter).toHaveTextContent(`10/${max}`);
    const normalColor = getComputedStyle(normalCounter).color;
    unmountNormal();

    // ---- AMBER (>=90%, <100%) ---------------------------------------------
    // length = 54 → floor(max*0.9)=54 → 'amber' branch.
    const { unmount: unmountAmber } = renderWithProviders(
      <Harness initialValue={'A'.repeat(54)} fieldName="title" />,
    );
    const amberCounter = getCounter(max);
    expect(amberCounter).toHaveTextContent(`54/${max}`);
    const amberColor = getComputedStyle(amberCounter).color;
    // Amber should differ from normal.
    expect(amberColor).not.toBe(normalColor);
    unmountAmber();

    // ---- RED (>= max) ------------------------------------------------------
    // length = 60 → 'red' branch.
    renderWithProviders(
      <Harness initialValue={'A'.repeat(max)} fieldName="title" />,
    );
    const redCounter = getCounter(max);
    expect(redCounter).toHaveTextContent(`${max}/${max}`);
    const redColor = getComputedStyle(redCounter).color;
    // Red tier should differ from both normal and amber.
    expect(redColor).not.toBe(normalColor);
    expect(redColor).not.toBe(amberColor);
  });

  it('renders the AI Improve button which forwards value to onAiImprove on click', async () => {
    const onAiImprove = vi.fn();
    renderWithProviders(
      <Harness
        initialValue="Hello World"
        fieldName="title"
        onAiImprove={onAiImprove}
      />,
    );

    // The AI Improve IconButton is always in the DOM when the callback is
    // provided — opacity toggles are a visual affordance, not a mount gate.
    // Multiple labels match the same button (Tooltip title + aria-label), so
    // we grab the first one.
    const improveBtn = screen.getAllByRole('button', { name: /ai improve/i })[0];
    expect(improveBtn).toBeInTheDocument();

    fireEvent.click(improveBtn);
    expect(onAiImprove).toHaveBeenCalledWith('Hello World');
  });

  it('invokes onOptionsClick with the field context when the Options ⊙ button is clicked', () => {
    const onOptionsClick = vi.fn();
    renderWithProviders(
      <Harness
        initialValue=""
        fieldName="description"
        onOptionsClick={onOptionsClick}
      />,
    );

    // SectionHeader renders OptionsButton with aria-label "<title> options".
    const optionsBtn = screen.getByRole('button', {
      name: /description options/i,
    });
    fireEvent.click(optionsBtn);
    expect(onOptionsClick).toHaveBeenCalledWith('description');
  });
});
