import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import workspaceReducer from './workspaceSlice';
import collectedItemsReducer from './collectedItemsSlice';
import chatBarReducer from './chatBarSlice';
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

export const store = configureStore({
  reducer: {
    auth: authReducer,
    workspace: workspaceReducer,
    collectedItems: collectedItemsReducer,
    chatBar: chatBarReducer,
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
      .concat(collectedProductsApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
