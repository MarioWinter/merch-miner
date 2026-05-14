import { useCallback, useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  setDrawerWidth,
  DRAWER_WIDTH_MIN,
  DRAWER_WIDTH_MAX,
  DRAWER_WIDTH_DEFAULT,
} from '@/store/chatBarSlice';

const STORAGE_KEY = 'chatBar.drawerWidth';

const clamp = (n: number): number =>
  Math.max(DRAWER_WIDTH_MIN, Math.min(DRAWER_WIDTH_MAX, n));

/**
 * Drag-handle resize hook for the right drawer.
 * - Drag from the drawer's left edge to change width.
 * - PROJ-29 Phase 1J follow-up: STEPLESS — no snap on release; the live
 *   pixel value is persisted directly.
 * - Width persists in localStorage under `chatBar.drawerWidth`. Restores
 *   on mount when the value parses as a finite number inside the
 *   `[DRAWER_WIDTH_MIN, DRAWER_WIDTH_MAX]` range.
 */
export const useDrawerResize = () => {
  const dispatch = useAppDispatch();
  const width = useAppSelector((s) => s.chatBar.drawerWidth);

  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef<number>(width);
  const liveWidthRef = useRef<number>(width);

  // Restore persisted width on mount.
  useEffect(() => {
    const persisted = localStorage.getItem(STORAGE_KEY);
    if (persisted == null) return;
    const v = parseInt(persisted, 10);
    if (Number.isFinite(v)) {
      dispatch(setDrawerWidth(clamp(v)));
    } else {
      // Corrupted entry — drop it so the next persist replaces with a valid one.
      localStorage.setItem(STORAGE_KEY, String(DRAWER_WIDTH_DEFAULT));
    }
  }, [dispatch]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      draggingRef.current = true;
      startXRef.current = e.clientX;
      startWidthRef.current = width;
      liveWidthRef.current = width;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [width],
  );

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (!draggingRef.current) return;
    // Drag-handle is on LEFT edge of right-anchored drawer.
    // Moving pointer LEFT (negative dx) → drawer wider.
    const dx = e.clientX - startXRef.current;
    const newWidth = clamp(startWidthRef.current - dx);
    liveWidthRef.current = newWidth;
    // Apply live preview via inline style on drawer paper.
    const paper = document.getElementById('mpd-drawer-paper');
    if (paper) paper.style.width = `${newWidth}px`;
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      const finalWidth = clamp(liveWidthRef.current);
      dispatch(setDrawerWidth(finalWidth));
      localStorage.setItem(STORAGE_KEY, String(finalWidth));
      // Clear inline override so Drawer slot styling takes over again.
      const paper = document.getElementById('mpd-drawer-paper');
      if (paper) paper.style.width = '';
    },
    [dispatch],
  );

  return { width, onPointerDown, onPointerMove, onPointerUp };
};
