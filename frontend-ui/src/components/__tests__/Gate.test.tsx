/**
 * PROJ-31 — `<Gate>` component tests.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import Gate from '../Gate';
import authReducer, { setUser, type AuthUser } from '@/store/authSlice';

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

const renderWithFeatures = (ui: React.ReactNode, features: string[]) => {
  const store = configureStore({ reducer: { auth: authReducer } });
  store.dispatch(setUser({ ...baseUser, features }));
  return render(<Provider store={store}>{ui}</Provider>);
};

describe('<Gate>', () => {
  it('renders children when feature is granted', () => {
    renderWithFeatures(
      <Gate feature="niche.research">
        <span data-testid="protected">visible</span>
      </Gate>,
      ['niche.research'],
    );
    expect(screen.getByTestId('protected')).toBeInTheDocument();
  });

  it('hides children when feature is not granted (no fallback)', () => {
    renderWithFeatures(
      <Gate feature="admin.scraper-debug">
        <span data-testid="protected">visible</span>
      </Gate>,
      ['niche.research'],
    );
    expect(screen.queryByTestId('protected')).not.toBeInTheDocument();
  });

  it('renders fallback when feature is not granted and fallback prop provided', () => {
    renderWithFeatures(
      <Gate
        feature="admin.scraper-debug"
        fallback={<span data-testid="fallback">upgrade</span>}
      >
        <span data-testid="protected">visible</span>
      </Gate>,
      ['niche.research'],
    );
    expect(screen.queryByTestId('protected')).not.toBeInTheDocument();
    expect(screen.getByTestId('fallback')).toBeInTheDocument();
  });

  it('renders children for any feature when wildcard "*" is granted (superuser)', () => {
    renderWithFeatures(
      <Gate feature="does.not.exist">
        <span data-testid="protected">visible</span>
      </Gate>,
      ['*'],
    );
    expect(screen.getByTestId('protected')).toBeInTheDocument();
  });
});
