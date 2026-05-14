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
 * Drag-handle resize for the right drawer. Stepless (no snap), clamped to
 * `[DRAWER_WIDTH_MIN, DRAWER_WIDTH_MAX]`, persisted under
 * `chatBar.drawerWidth` in localStorage.
 */
export const useDrawerResize = () => {
  const dispatch = useAppDispatch();
  const width = useAppSelector((s) => s.chatBar.drawerWidth);

  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef<number>(width);
  const liveWidthRef = useRef<number>(width);

  useEffect(() => {
    const persisted = localStorage.getItem(STORAGE_KEY);
    if (persisted == null) return;
    const v = parseInt(persisted, 10);
    if (Number.isFinite(v)) {
      dispatch(setDrawerWidth(clamp(v)));
    } else {
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
    // Handle is on the drawer's left edge — pointer LEFT widens the drawer.
    const dx = e.clientX - startXRef.current;
    const newWidth = clamp(startWidthRef.current - dx);
    liveWidthRef.current = newWidth;
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
      const paper = document.getElementById('mpd-drawer-paper');
      if (paper) paper.style.width = '';
    },
    [dispatch],
  );

  return { width, onPointerDown, onPointerMove, onPointerUp };
};
