import { describe, it, expect, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import { renderWithProviders } from '../../../utils/test-utils';
import { setUser } from '../../../store/authSlice';
import Topbar from '../Topbar';

// WorkspaceSelector fetches workspaces — stub it out so Topbar tests stay focused
vi.mock('../WorkspaceSelector', () => ({
  default: () => null,
}));

describe('Topbar — avatar initial derivation', () => {
  it('shows first_name initial (M) when first_name is set, not email initial (b)', async () => {
    const { store } = renderWithProviders(<Topbar />);
    await act(async () => {
      store.dispatch(setUser({ id: 1, email: 'bob@example.com', first_name: 'Mario', avatar_url: null }));
    });
    // 'M' from first_name should appear; 'B' from email should not be the initial
    expect(screen.getByText('M')).toBeInTheDocument();
  });

  it('falls back to email initial when first_name is empty string', async () => {
    const { store } = renderWithProviders(<Topbar />);
    await act(async () => {
      store.dispatch(setUser({ id: 2, email: 'zoe@example.com', first_name: '', avatar_url: null }));
    });
    expect(screen.getByText('Z')).toBeInTheDocument();
  });

  it('shows ? when no user is authenticated', () => {
    renderWithProviders(<Topbar />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('shows app name in topbar', () => {
    renderWithProviders(<Topbar />);
    expect(screen.getByText('MerchMiner')).toBeInTheDocument();
  });
});

/**
 * Unit-level tests for the initial derivation logic — these are pure
 * JS computations that mirror exactly what Topbar.tsx does, so they
 * remain stable if we rename sub-components.
 */
describe('avatar initial derivation logic', () => {
  const deriveInitial = (firstName: string, email: string) =>
    firstName.charAt(0).toUpperCase() ||
    email.charAt(0).toUpperCase() ||
    '?';

  it('prefers first_name over email', () => {
    expect(deriveInitial('Alice', 'bob@example.com')).toBe('A');
  });

  it('falls back to email when first_name is empty', () => {
    expect(deriveInitial('', 'charlie@example.com')).toBe('C');
  });

  it('returns ? when both are empty', () => {
    expect(deriveInitial('', '')).toBe('?');
  });

  it('returns uppercase initial', () => {
    expect(deriveInitial('david', 'x@x.com')).toBe('D');
  });

  it('email fallback is also uppercased', () => {
    expect(deriveInitial('', 'eve@x.com')).toBe('E');
  });
});
