import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import workspaceReducer from './workspaceSlice';
import collectedItemsReducer from './collectedItemsSlice';
import chatBarReducer from './chatBarSlice';
import attachmentsReducer from './attachmentsSlice';
import upscaleReducer from './upscaleSlice';
import { nicheApi } from './nicheSlice';
import { researchApi } from './researchSlice';
import { ideaApi } from './ideaSlice';
import { designApi } from './designSlice';
import { keywordApi } from './keywordSlice';
import { publishApi } from './publishSlice';
import { dashboardApi } from './dashboardSlice';
import { kanbanApi } from './kanbanSlice';
import { notificationApi } from './notificationSlice';
import { searchApi } from './searchSlice';
import { agentApi } from './agentSlice';
import { collectedProductsApi } from './collectedProductsSlice';
import { upscaleApi } from './upscaleApi';
import { searchHistoryApi } from './searchHistorySlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    workspace: workspaceReducer,
    collectedItems: collectedItemsReducer,
    chatBar: chatBarReducer,
    attachments: attachmentsReducer,
    upscale: upscaleReducer,
    [nicheApi.reducerPath]: nicheApi.reducer,
    [researchApi.reducerPath]: researchApi.reducer,
    [ideaApi.reducerPath]: ideaApi.reducer,
    [designApi.reducerPath]: designApi.reducer,
    [keywordApi.reducerPath]: keywordApi.reducer,
    [publishApi.reducerPath]: publishApi.reducer,
    [dashboardApi.reducerPath]: dashboardApi.reducer,
    [kanbanApi.reducerPath]: kanbanApi.reducer,
    [notificationApi.reducerPath]: notificationApi.reducer,
    [searchApi.reducerPath]: searchApi.reducer,
    [agentApi.reducerPath]: agentApi.reducer,
    [collectedProductsApi.reducerPath]: collectedProductsApi.reducer,
    [upscaleApi.reducerPath]: upscaleApi.reducer,
    [searchHistoryApi.reducerPath]: searchHistoryApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .concat(nicheApi.middleware)
      .concat(researchApi.middleware)
      .concat(ideaApi.middleware)
      .concat(designApi.middleware)
      .concat(keywordApi.middleware)
      .concat(publishApi.middleware)
      .concat(dashboardApi.middleware)
      .concat(kanbanApi.middleware)
      .concat(notificationApi.middleware)
      .concat(searchApi.middleware)
      .concat(agentApi.middleware)
      .concat(collectedProductsApi.middleware)
      .concat(upscaleApi.middleware)
      .concat(searchHistoryApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

/**
 * Reset every RTK Query cache. Called from the logout flow so the next
 * user signing in on the same browser does not see the previous user's
 * cached data (Design Forge projects, Niche list, Publish queue, etc.).
 *
 * Add new createApi() slices here when introducing them — otherwise their
 * cache will leak across logout.
 */
export const resetAllRtkApiCaches = (dispatch: AppDispatch) => {
  dispatch(nicheApi.util.resetApiState());
  dispatch(researchApi.util.resetApiState());
  dispatch(ideaApi.util.resetApiState());
  dispatch(designApi.util.resetApiState());
  dispatch(keywordApi.util.resetApiState());
  dispatch(publishApi.util.resetApiState());
  dispatch(dashboardApi.util.resetApiState());
  dispatch(kanbanApi.util.resetApiState());
  dispatch(notificationApi.util.resetApiState());
  dispatch(searchApi.util.resetApiState());
  dispatch(agentApi.util.resetApiState());
  dispatch(collectedProductsApi.util.resetApiState());
  dispatch(upscaleApi.util.resetApiState());
  dispatch(searchHistoryApi.util.resetApiState());
};
