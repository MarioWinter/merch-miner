import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import { hydrateAuth, authService } from './services/authService';
import { clearAuth } from './store/authSlice';
import { useAppDispatch, useAppSelector } from './store/hooks';
import PrivateRoute from './components/PrivateRoute';
import AppLayout from './components/AppLayout';
import LoginPage from './views/auth/login/LoginPage';
import RegisterPage from './views/auth/register/RegisterPage';
import ActivatePage from './views/auth/activate/ActivatePage';
import PasswordResetPage from './views/auth/password-reset/PasswordResetPage';
import PasswordConfirmPage from './views/auth/password-reset/PasswordConfirmPage';
import SettingsLayout from './views/settings/SettingsLayout';
import ProfileSection from './views/settings/profile/ProfileSection';
import BillingSection from './views/settings/billing/BillingSection';
import WorkspaceSection from './views/settings/workspace/WorkspaceSection';
import InviteAcceptView from './views/invite/InviteAcceptView';

// Placeholder — replaced when dashboard is built (PROJ-12)
const DashboardPlaceholder = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await authService.logout();
    } catch {
      // proceed even if backend call fails
    } finally {
      dispatch(clearAuth());
      navigate('/login', { replace: true });
    }
  };

  return (
    <Box sx={{ p: 5 }}>
      <Typography variant="h5" gutterBottom>
        Dashboard
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Authenticated{user ? ` as ${user.email}` : ''}. Dashboard coming soon (PROJ-12).
      </Typography>
      <Button
        variant="outlined"
        color="error"
        startIcon={loggingOut ? <CircularProgress size={16} color="inherit" /> : <LogoutIcon />}
        onClick={handleLogout}
        disabled={loggingOut}
        aria-label="Log out"
      >
        {loggingOut ? 'Logging out…' : 'Log out'}
      </Button>
    </Box>
  );
}


const App = () => {
  useEffect(() => {
    hydrateAuth();
  }, []);

  return (
    <Routes>
      {/* Public auth routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/activate" element={<ActivatePage />} />
      <Route path="/password-reset" element={<PasswordResetPage />} />
      <Route path="/password-reset/confirm" element={<PasswordConfirmPage />} />
      <Route path="/workspaces/invite/accept" element={<InviteAcceptView />} />

      {/* Protected routes — all wrapped with AppLayout */}
      <Route element={<PrivateRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPlaceholder />} />
          <Route path="/dashboard" element={<DashboardPlaceholder />} />

          {/* Settings routes */}
          <Route path="/settings" element={<SettingsLayout />}>
            <Route index element={<Navigate to="/settings/profile" replace />} />
            <Route path="profile" element={<ProfileSection />} />
            <Route path="billing" element={<BillingSection />} />
            <Route path="workspace" element={<WorkspaceSection />} />
          </Route>
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
