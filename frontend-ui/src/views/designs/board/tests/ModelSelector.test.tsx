import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { ModelSelector } from '../partials/ModelSelector';
import { renderWithProviders } from '@/utils/test-utils';

const DEFAULT_MODEL = 'google/gemini-3.1-flash-preview-image-generation' as const;

describe('ModelSelector', () => {
  it('renders with label text', () => {
    renderWithProviders(
      <ModelSelector value={DEFAULT_MODEL} onChange={vi.fn()} />,
    );
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getAllByText('AI Model').length).toBeGreaterThan(0);
  });

  it('shows the current value as display text', () => {
    renderWithProviders(
      <ModelSelector value={DEFAULT_MODEL} onChange={vi.fn()} />,
    );
    expect(screen.getByText('Nano Banana 2 (Gemini 3.1 Flash)')).toBeInTheDocument();
  });

  it('shows GPT-5 Image when value is gpt-5-image', () => {
    renderWithProviders(
      <ModelSelector value="openai/gpt-5-image" onChange={vi.fn()} />,
    );
    expect(screen.getByText('GPT-5 Image')).toBeInTheDocument();
  });

  it('opens dropdown and shows all model options', () => {
    renderWithProviders(
      <ModelSelector value={DEFAULT_MODEL} onChange={vi.fn()} />,
    );
    fireEvent.mouseDown(screen.getByRole('combobox'));
    const listbox = within(screen.getByRole('listbox'));
    expect(listbox.getByText('Nano Banana 2 (Gemini 3.1 Flash)')).toBeInTheDocument();
    expect(listbox.getByText('GPT-5 Image')).toBeInTheDocument();
    expect(listbox.getByText('Flux 1.1 Pro')).toBeInTheDocument();
    expect(listbox.getByText('Seedream 4.5')).toBeInTheDocument();
  });

  it('calls onChange when a different model is selected', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <ModelSelector value={DEFAULT_MODEL} onChange={onChange} />,
    );
    fireEvent.mouseDown(screen.getByRole('combobox'));
    fireEvent.click(within(screen.getByRole('listbox')).getByText('GPT-5 Image'));
    expect(onChange).toHaveBeenCalledWith('openai/gpt-5-image');
  });

  it('disables select when disabled prop is true', () => {
    renderWithProviders(
      <ModelSelector value={DEFAULT_MODEL} onChange={vi.fn()} disabled />,
    );
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-disabled', 'true');
  });
});
