import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';

/* eslint-disable @typescript-eslint/no-explicit-any */
const { fa } = vi.hoisted(() => ({
  fa: (n: string) => ({ reducerPath: n, reducer: () => ({}), middleware: () => (x: any) => (a: any) => x(a), util: { resetApiState: () => ({ type: 'noop' }) } }),
}));
vi.mock('@/store/nicheSlice', () => ({ nicheApi: fa('nicheApi'), useListNichesQuery: () => ({ data: { results: [] }, isLoading: false }) }));
vi.mock('@/store/ideaSlice', () => ({ ideaApi: fa('ideaApi') }));
vi.mock('@/store/researchSlice', () => ({ researchApi: fa('researchApi') }));
vi.mock('@/store/designSlice', () => ({ designApi: fa('designApi') }));
vi.mock('@/store/keywordSlice', () => ({ keywordApi: fa('keywordApi') }));
vi.mock('@/store/publishSlice', () => ({ publishApi: fa('publishApi') }));
vi.mock('@/store/dashboardSlice', () => ({ dashboardApi: fa('dashboardApi') }));
vi.mock('@/store/kanbanSlice', () => ({ kanbanApi: fa('kanbanApi') }));
vi.mock('@/store/notificationSlice', () => ({ notificationApi: fa('notificationApi') }));
vi.mock('@/store/searchSlice', () => ({ searchApi: fa('searchApi') }));
vi.mock('@/store/agentSlice', () => ({ agentApi: fa('agentApi') }));
vi.mock('@/store/collectedProductsSlice', () => ({ collectedProductsApi: fa('collectedProductsApi') }));

import { renderWithProviders } from '../../../../utils/test-utils';
import { PromptEditor } from '../partials/PromptEditor';

afterEach(() => {
  vi.clearAllMocks();
});

describe('PromptEditor', () => {
  it('renders text field with placeholder', () => {
    renderWithProviders(
      <PromptEditor value="" onChange={vi.fn()} />,
    );
    expect(screen.getByPlaceholderText('Describe the design you want to generate...')).toBeInTheDocument();
  });

  it('pre-fills value from props', () => {
    renderWithProviders(
      <PromptEditor value="A cool design prompt" onChange={vi.fn()} />,
    );
    expect(screen.getByDisplayValue('A cool design prompt')).toBeInTheDocument();
  });

  it('calls onChange when user types', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <PromptEditor value="" onChange={onChange} />,
    );
    fireEvent.change(screen.getByPlaceholderText('Describe the design you want to generate...'), {
      target: { value: 'new text' },
    });
    expect(onChange).toHaveBeenCalledWith('new text');
  });

  it('disables input when disabled prop is true', () => {
    renderWithProviders(
      <PromptEditor value="test" onChange={vi.fn()} disabled />,
    );
    expect(screen.getByPlaceholderText('Describe the design you want to generate...')).toBeDisabled();
  });

  it('does not show analysis breakdown when no analysis', () => {
    renderWithProviders(
      <PromptEditor value="" onChange={vi.fn()} />,
    );
    expect(screen.queryByText('7-Step Analysis Breakdown')).not.toBeInTheDocument();
  });

  it('does not show analysis breakdown for empty object', () => {
    renderWithProviders(
      <PromptEditor value="" onChange={vi.fn()} promptAnalysis={{}} />,
    );
    expect(screen.queryByText('7-Step Analysis Breakdown')).not.toBeInTheDocument();
  });

  it('shows analysis breakdown accordion when promptAnalysis has data', () => {
    renderWithProviders(
      <PromptEditor
        value=""
        onChange={vi.fn()}
        promptAnalysis={{
          text_dna: 'Text DNA content',
          visual: 'Visual analysis content',
        }}
      />,
    );
    expect(screen.getByText('7-Step Analysis Breakdown')).toBeInTheDocument();
  });

  it('shows analysis step content when accordion is expanded', () => {
    renderWithProviders(
      <PromptEditor
        value=""
        onChange={vi.fn()}
        promptAnalysis={{
          text_dna: 'Text DNA content',
          visual: 'Visual analysis result',
        }}
      />,
    );
    // Expand accordion
    fireEvent.click(screen.getByText('7-Step Analysis Breakdown'));
    expect(screen.getByText('Text DNA content')).toBeInTheDocument();
    expect(screen.getByText('Visual analysis result')).toBeInTheDocument();
  });

  it('shows step labels from i18n', () => {
    renderWithProviders(
      <PromptEditor
        value=""
        onChange={vi.fn()}
        promptAnalysis={{
          text_dna: 'content',
          final_prompt: 'final prompt text',
        }}
      />,
    );
    fireEvent.click(screen.getByText('7-Step Analysis Breakdown'));
    expect(screen.getByText('Text DNA')).toBeInTheDocument();
    expect(screen.getByText('Final Prompt')).toBeInTheDocument();
  });

  it('renders JSON-stringified analysis for object steps', () => {
    renderWithProviders(
      <PromptEditor
        value=""
        onChange={vi.fn()}
        promptAnalysis={{
          color: { primary: '#FF0000', secondary: '#00FF00' },
        }}
      />,
    );
    fireEvent.click(screen.getByText('7-Step Analysis Breakdown'));
    // JSON.stringify with 2-space indent
    expect(screen.getByText(/primary/)).toBeInTheDocument();
  });
});
