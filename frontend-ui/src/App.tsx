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
import { isRegistrationEnabled } from './utils/isRegistrationEnabled';
import { useVerifyActiveBatch } from './views/designs/board/hooks/useVerifyActiveBatch';
import { useGlobalUpscaleNotifications } from './hooks/useGlobalUpscaleNotifications';


const App = () => {
  useEffect(() => {
    hydrateAuth();
  }, []);

  // PROJ-27 — verify localStorage-rehydrated activeBatchId is still active
  // server-side; clear if 404 / terminal so the topbar pill doesn't show stale.
  useVerifyActiveBatch();

  // FIX-canvas-editor-bugs-and-image-gen Phase B — global completion snackbar
  // for single-design upscales. Mounted here (and ONLY here) so a finished
  // upscale surfaces even when the user has navigated away from the workspace.
  useGlobalUpscaleNotifications();

  // PROJ-31 — pre-auth flag: registration is the one gate that fires BEFORE
  // login, so the entitlement system (`useCan`) cannot apply. Single ENV
  // helper, no admin override needed (route is unreachable for admins anyway
  // via Django Admin onboarding flow).
  const registrationEnabled = isRegistrationEnabled();

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

          {/* Settings routes — all 4 sections render on ONE scrollable page.
              Legacy sub-paths redirect to the single page with the right hash
              so deep-links from elsewhere in the app keep working. */}
          <Route path="/settings" element={<SettingsLayout />} />
          <Route path="/settings/profile" element={<Navigate to="/settings#profile" replace />} />
          <Route path="/settings/billing" element={<Navigate to="/settings#billing" replace />} />
          <Route path="/settings/workspace" element={<Navigate to="/settings#workspace" replace />} />
          <Route path="/settings/usage" element={<Navigate to="/settings#usage" replace />} />
        </Route>
      </Route>

      {/* Fallback — redirect unknown routes to dashboard; PrivateRoute handles auth guard */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
