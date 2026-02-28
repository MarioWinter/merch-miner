import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { hydrateAuth } from './services/authService';
import PrivateRoute from './components/PrivateRoute';
import LoginPage from './views/auth/login/LoginPage';
import RegisterPage from './views/auth/register/RegisterPage';
import ActivatePage from './views/auth/activate/ActivatePage';
import PasswordResetPage from './views/auth/password-reset/PasswordResetPage';
import PasswordConfirmPage from './views/auth/password-reset/PasswordConfirmPage';

// Placeholder — replaced when dashboard is built (PROJ-9)
const DashboardPlaceholder = () => (
  <div style={{ padding: 40 }}>
    <h2>Dashboard</h2>
    <p>Authenticated. Dashboard coming soon (PROJ-9).</p>
  </div>
);

function App() {
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

      {/* Protected routes */}
      <Route element={<PrivateRoute />}>
        <Route path="/" element={<DashboardPlaceholder />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
