import { useCallback, useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setDrawerWidth, type DrawerWidth } from '@/store/chatBarSlice';

const STEPS: DrawerWidth[] = [480, 768, 1200];
const STORAGE_KEY = 'chatBar.drawerWidth';

const snapToStep = (px: number): DrawerWidth => {
  // Snap to closest of 480/768/1200
  let nearest: DrawerWidth = STEPS[0];
  let minDist = Math.abs(px - STEPS[0]);
  for (const s of STEPS) {
    const d = Math.abs(px - s);
    if (d < minDist) {
      nearest = s;
      minDist = d;
    }
  }
  return nearest;
};

/**
 * Drag-handle resize hook for the right drawer.
 * - Dragging from left edge of drawer changes width
 * - Snaps to 480/768/1200 on release
 * - Persists final width in localStorage
 */
export const useDrawerResize = () => {
  const dispatch = useAppDispatch();
  const width = useAppSelector((s) => s.chatBar.drawerWidth);

  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef<number>(width);
  const liveWidthRef = useRef<number>(width);

  // Restore persisted width on mount
  useEffect(() => {
    const persisted = localStorage.getItem(STORAGE_KEY);
    if (persisted) {
      const v = parseInt(persisted, 10);
      if (STEPS.includes(v as DrawerWidth)) {
        dispatch(setDrawerWidth(v as DrawerWidth));
      }
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
    // Drag-handle is on LEFT edge of right-anchored drawer
    // Moving pointer LEFT (negative dx) → drawer wider
    const dx = e.clientX - startXRef.current;
    const newWidth = Math.max(380, Math.min(1400, startWidthRef.current - dx));
    liveWidthRef.current = newWidth;
    // Apply live preview via inline style on drawer paper
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
      const snapped = snapToStep(liveWidthRef.current);
      dispatch(setDrawerWidth(snapped));
      localStorage.setItem(STORAGE_KEY, String(snapped));
      // Clear inline override so Drawer slot styling takes over again
      const paper = document.getElementById('mpd-drawer-paper');
      if (paper) paper.style.width = '';
    },
    [dispatch],
  );

  return { width, onPointerDown, onPointerMove, onPointerUp };
};
