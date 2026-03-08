import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { SnackbarProvider } from 'notistack';
import authReducer from '../../../../store/authSlice';
import workspaceReducer from '../../../../store/workspaceSlice';
import { profileService } from '../../../../services/profileService';
import ProfileSection from '../ProfileSection';
import '../../../../i18n';

vi.mock('../../../../services/profileService', () => ({
  profileService: {
    getProfile: vi.fn(),
    patchProfile: vi.fn(),
    uploadAvatar: vi.fn(),
    changePassword: vi.fn(),
  },
}));

const mockGetProfile = vi.mocked(profileService.getProfile);
const mockPatchProfile = vi.mocked(profileService.patchProfile);
const mockUploadAvatar = vi.mocked(profileService.uploadAvatar);

function renderProfile() {
  const store = configureStore({
    reducer: { auth: authReducer, workspace: workspaceReducer },
  });
  render(
    <Provider store={store}>
      <MemoryRouter>
        <SnackbarProvider>
          <ProfileSection />
        </SnackbarProvider>
      </MemoryRouter>
    </Provider>
  );
  return { store };
}

const mockProfile = {
  id: 1,
  email: 'test@example.com',
  username: 'testuser',
  first_name: 'Jane',
  last_name: 'Doe',
  date_joined: '2024-01-01T00:00:00Z',
  avatar_url: null,
};

describe('ProfileSection', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows skeleton while loading', () => {
    mockGetProfile.mockImplementation(() => new Promise(() => {}));
    renderProfile();
    // No heading visible during loading skeleton
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('renders profile fields after load', async () => {
    mockGetProfile.mockResolvedValueOnce(mockProfile);
    renderProfile();

    await waitFor(() =>
      expect(screen.getByDisplayValue('testuser')).toBeInTheDocument()
    );
    expect(screen.getByDisplayValue('Jane')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Doe')).toBeInTheDocument();
    expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument();
  });

  it('shows error alert when profile fails to load', async () => {
    mockGetProfile.mockRejectedValueOnce(new Error('500'));
    renderProfile();

    await waitFor(() =>
      expect(screen.getByRole('alert')).toBeInTheDocument()
    );
  });

  it('calls patchProfile and shows success snackbar on save', async () => {
    mockGetProfile.mockResolvedValueOnce(mockProfile);
    mockPatchProfile.mockResolvedValueOnce({
      ...mockProfile,
      first_name: 'Updated',
    });

    renderProfile();
    await waitFor(() =>
      expect(screen.getByDisplayValue('Jane')).toBeInTheDocument()
    );

    const firstNameInput = screen.getByDisplayValue('Jane');
    await userEvent.clear(firstNameInput);
    await userEvent.type(firstNameInput, 'Updated');

    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() =>
      expect(mockPatchProfile).toHaveBeenCalledWith(
        expect.objectContaining({ first_name: 'Updated' })
      )
    );
    await waitFor(() =>
      expect(screen.getByText(/profile updated/i)).toBeInTheDocument()
    );
  });

  it('rejects avatar file larger than 2MB', async () => {
    mockGetProfile.mockResolvedValueOnce(mockProfile);

    renderProfile();
    await waitFor(() =>
      expect(screen.getByDisplayValue('testuser')).toBeInTheDocument()
    );

    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const bigFile = new File(['x'.repeat(3 * 1024 * 1024)], 'big.jpg', {
      type: 'image/jpeg',
    });
    await userEvent.upload(fileInput, bigFile);

    await waitFor(() =>
      expect(screen.getByText(/under 2mb/i)).toBeInTheDocument()
    );
    expect(mockUploadAvatar).not.toHaveBeenCalled();
  });
});
