import { useCallback, useState } from 'react';

export type DrawerMode = 'create' | 'edit';

export interface DrawerState {
  open: boolean;
  mode: DrawerMode;
  selectedId: string | null;
}

export interface UseNicheDrawerReturn {
  drawerState: DrawerState;
  openCreate: () => void;
  openEdit: (id: string) => void;
  closeDrawer: () => void;
}

const INITIAL_STATE: DrawerState = {
  open: false,
  mode: 'create',
  selectedId: null,
};

export const useNicheDrawer = (): UseNicheDrawerReturn => {
  const [drawerState, setDrawerState] = useState<DrawerState>(INITIAL_STATE);

  const openCreate = useCallback(() => {
    setDrawerState({ open: true, mode: 'create', selectedId: null });
  }, []);

  const openEdit = useCallback((id: string) => {
    setDrawerState({ open: true, mode: 'edit', selectedId: id });
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerState((prev) => ({ ...prev, open: false }));
  }, []);

  return { drawerState, openCreate, openEdit, closeDrawer };
};
