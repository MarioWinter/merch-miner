import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import workspaceReducer from './workspaceSlice';
import collectedItemsReducer from './collectedItemsSlice';
import { nicheApi } from './nicheSlice';
import { researchApi } from './researchSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    workspace: workspaceReducer,
    collectedItems: collectedItemsReducer,
    [nicheApi.reducerPath]: nicheApi.reducer,
    [researchApi.reducerPath]: researchApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .concat(nicheApi.middleware)
      .concat(researchApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
