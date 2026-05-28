/**
 * FIX (Item 3, Phase 2) — SendButton Stop/Send toggle.
 *
 * Verifies the icon swap + click-routing contract:
 *   - isStreaming=false → SendIcon, click → onSubmit
 *   - isStreaming=true  → StopIcon, click → onStop
 *   - same button slot (size/role) in both states
 */
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/utils/test-utils';
import SendButton from '../SendButton';

describe('SendButton (FIX Item 3 — Send/Stop toggle)', () => {
  it('renders SendIcon when not streaming and invokes onSubmit on click', async () => {
    const onSubmit = vi.fn();
    const onStop = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <SendButton
        isStreaming={false}
        isEmpty={false}
        onSubmit={onSubmit}
        onStop={onStop}
      />,
    );
    const btn = screen.getByTestId('chat-input-send-button');
    expect(btn).toHaveAttribute('data-mode', 'send');
    expect(btn).toHaveAttribute('aria-label', 'Send');
    expect(btn).not.toBeDisabled();
    // SendIcon presence — MUI icons render an <svg data-testid="SendIcon" />
    // because each icon has a defined displayName. Match aria/data-mode instead
    // for robustness across versions.
    expect(btn.querySelector('[data-testid="SendIcon"]')).not.toBeNull();
    expect(btn.querySelector('[data-testid="StopIcon"]')).toBeNull();

    await user.click(btn);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onStop).not.toHaveBeenCalled();
  });

  it('renders StopIcon when streaming and invokes onStop on click', async () => {
    const onSubmit = vi.fn();
    const onStop = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <SendButton
        isStreaming={true}
        isEmpty={true}
        onSubmit={onSubmit}
        onStop={onStop}
      />,
    );
    const btn = screen.getByTestId('chat-input-send-button');
    expect(btn).toHaveAttribute('data-mode', 'stop');
    expect(btn).toHaveAttribute('aria-label', 'Stop generating');
    // While streaming the button MUST remain clickable even though `isEmpty`
    // would normally disable it — the Stop affordance has to work after
    // submission.
    expect(btn).not.toBeDisabled();
    expect(btn.querySelector('[data-testid="StopIcon"]')).not.toBeNull();
    expect(btn.querySelector('[data-testid="SendIcon"]')).toBeNull();

    await user.click(btn);
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('keeps the same accessible role (button) across both states', () => {
    const { rerender } = renderWithProviders(
      <SendButton isStreaming={false} isEmpty={false} />,
    );
    const sendBtn = screen.getByRole('button');
    expect(sendBtn).toHaveAttribute('data-mode', 'send');
    expect(sendBtn.tagName).toBe('BUTTON');

    rerender(<SendButton isStreaming={true} isEmpty={false} />);
    const stopBtn = screen.getByRole('button');
    expect(stopBtn).toHaveAttribute('data-mode', 'stop');
    expect(stopBtn.tagName).toBe('BUTTON');
  });

  it('disabled-prop gates only the Send mode; Stop mode ignores it', async () => {
    const onSubmit = vi.fn();
    const onStop = vi.fn();
    const user = userEvent.setup();
    const { rerender } = renderWithProviders(
      <SendButton
        isStreaming={false}
        isEmpty={false}
        disabled={true}
        onSubmit={onSubmit}
        onStop={onStop}
      />,
    );
    const btn = screen.getByTestId('chat-input-send-button');
    expect(btn).toBeDisabled();
    // userEvent refuses to click disabled elements (pointer-events: none) —
    // that's exactly the contract we want; assertion-only is sufficient.
    expect(onSubmit).not.toHaveBeenCalled();

    rerender(
      <SendButton
        isStreaming={true}
        isEmpty={false}
        disabled={true}
        onSubmit={onSubmit}
        onStop={onStop}
      />,
    );
    const stopBtn = screen.getByTestId('chat-input-send-button');
    expect(stopBtn).not.toBeDisabled();
    await user.click(stopBtn);
    expect(onStop).toHaveBeenCalledTimes(1);
  });
});
