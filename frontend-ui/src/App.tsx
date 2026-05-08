import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { hydrateAuth } from './services/authService';
import PrivateRoute from './components/PrivateRoute';
import AppLayout from './components/AppLayout';
import LoginPage from './views/auth/login/LoginPage';
import RegisterPage from './views/auth/register/RegisterPage';
import ActivatePage from './views/auth/activate/ActivatePage';
import PasswordResetPage from './views/auth/password-reset/PasswordResetPage';
import PasswordConfirmPage from './views/auth/password-reset/PasswordConfirmPage';
import SettingsLayout from './views/settings/SettingsLayout';
import InviteAcceptView from './views/invite/InviteAcceptView';
import NicheListView from './views/niches/list/NicheListView';
import NicheResearchView from './views/niches/research';
import AmazonResearchView from './views/amazon/research/AmazonResearchView';
import IdeaListView from './views/ideas/IdeaListView';
import ProjectGalleryView from './views/designs/gallery/ProjectGalleryView';
import DesignWorkspaceView from './views/designs/workspace/DesignWorkspaceView';
import KeywordResearchView from './views/amazon/keywords/research/KeywordResearchView';
import PublishView from './views/publish/PublishView';
import EditView from './views/publish/EditView';
import DashboardView from './views/dashboard/DashboardView';
import KanbanBoardView from './views/kanban/KanbanBoardView';
import ProductDetailPage from './views/amazon/research/detail/ProductDetailPage';
import SharedChatView from './views/shared/SharedChatView';
import ImprintPage from './views/legal/imprint/ImprintPage';
import PrivacyPage from './views/legal/privacy/PrivacyPage';
import { getStaticFlag } from './utils/getStaticFlag';
import { FEATURE_FLAGS } from './constants/featureFlags';
import { useVerifyActiveBatch } from './views/designs/board/hooks/useVerifyActiveBatch';


const App = () => {
  useEffect(() => {
    hydrateAuth();
  }, []);

  // PROJ-27 — verify localStorage-rehydrated activeBatchId is still active
  // server-side; clear if 404 / terminal so the topbar pill doesn't show stale.
  useVerifyActiveBatch();

  // PROJ-24 AC-22 — gate /register route via static flag (admin-override exempt per AC-20d).
  // Static evaluation at module/component-construction time → Vite tree-shakes when off.
  const registrationEnabled = getStaticFlag(FEATURE_FLAGS.REGISTRATION_ENABLED);

  return (
    <Routes>
      {/* Public auth routes */}
      <Route path="/login" element={<LoginPage />} />
      {registrationEnabled && (
        <Route path="/register" element={<RegisterPage />} />
      )}
      <Route path="/activate" element={<ActivatePage />} />
      <Route path="/password-reset" element={<PasswordResetPage />} />
      <Route path="/password-reset/confirm" element={<PasswordConfirmPage />} />
      <Route path="/workspaces/invite/accept" element={<InviteAcceptView />} />

      {/* PROJ-24 — public legal pages (no auth) */}
      <Route path="/legal/imprint" element={<ImprintPage />} />
      <Route path="/legal/privacy" element={<PrivacyPage />} />

      {/* PROJ-20 Phase 5.6 — public read-only chat viewer (no auth) */}
      <Route path="/shared/chat/:token" element={<SharedChatView />} />

      {/* Protected routes — all wrapped with AppLayout */}
      <Route element={<PrivateRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardView />} />
          <Route path="/dashboard" element={<DashboardView />} />
          <Route path="/niches" element={<NicheListView />} />
          <Route path="/niches/research" element={<NicheResearchView />} />
          <Route path="/amazon/research" element={<AmazonResearchView />} />
          <Route path="/amazon/research/product/:asin" element={<ProductDetailPage />} />
          <Route path="/amazon/keywords" element={<KeywordResearchView />} />
          <Route path="/slogans" element={<IdeaListView />} />
          <Route path="/designs" element={<ProjectGalleryView />} />
          <Route path="/designs/:projectId" element={<DesignWorkspaceView />} />
          <Route path="/publish" element={<PublishView />} />
          <Route path="/publish/edit" element={<EditView />} />
          <Route path="/kanban" element={<KanbanBoardView />} />

          {/* Settings routes */}
          <Route path="/settings" element={<SettingsLayout />}>
            <Route index element={<Navigate to="/settings/profile" replace />} />
            <Route path="profile" element={null} />
            <Route path="billing" element={null} />
            <Route path="workspace" element={null} />
            <Route path="usage" element={null} />
          </Route>
        </Route>
      </Route>

      {/* Fallback — redirect unknown routes to dashboard; PrivateRoute handles auth guard */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
