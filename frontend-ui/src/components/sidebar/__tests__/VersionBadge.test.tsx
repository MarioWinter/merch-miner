/**
 * FIX-dashboard Item 5 — `VersionBadge` superuser gating tests.
 *
 * Non-superuser → non-interactive pill (no button, no popover, no changelog drawer).
 * Superuser    → clickable trigger opens the version popover + changelog link.
 */
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import VersionBadge from '../VersionBadge';
import { renderWithProviders } from '@/utils/test-utils';
import { type AuthUser } from '@/store/authSlice';

const baseUser: AuthUser = {
  id: 1,
  email: 'u@test.com',
  first_name: '',
  avatar_url: null,
  is_staff: false,
  is_superuser: false,
  subscription_tier: 'free',
  features: [],
};

const preloadedAuth = (user: AuthUser) => ({
  auth: {
    user,
    isAuthenticated: true,
    loading: false,
    error: null,
  },
});

describe('VersionBadge — superuser gating', () => {
  it('renders a non-interactive pill for non-superusers (no button, no clickable trigger)', () => {
    renderWithProviders(<VersionBadge collapsed={false} />, {
      preloadedState: preloadedAuth({ ...baseUser, is_superuser: false }),
    });

    // The non-superuser branch renders a div with role="status" and no button.
    expect(screen.queryByRole('button', { name: /open version info/i })).toBeNull();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders the clickable trigger that opens the changelog link for superusers', async () => {
    const user = userEvent.setup();
    renderWithProviders(<VersionBadge collapsed={false} />, {
      preloadedState: preloadedAuth({ ...baseUser, is_superuser: true }),
    });

    const trigger = screen.getByRole('button', { name: /open version info/i });
    expect(trigger).toBeInTheDocument();

    await user.click(trigger);
    expect(await screen.findByRole('button', { name: /changelog/i })).toBeInTheDocument();
  });

  it('fails closed: missing auth.user (loading) renders non-interactive pill', () => {
    renderWithProviders(<VersionBadge collapsed={false} />, {
      preloadedState: {
        auth: { user: null, isAuthenticated: false, loading: true, error: null },
      },
    });

    expect(screen.queryByRole('button', { name: /open version info/i })).toBeNull();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
