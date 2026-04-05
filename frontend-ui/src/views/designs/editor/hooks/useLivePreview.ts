import { useEffect, useRef, useState, useCallback } from 'react';

import type { PipelineTool, BatchImage } from '../types';
import { useClientProcessing } from './useClientProcessing';

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

export interface UseLivePreviewResult {
  previewUrl: string | null;
  isProcessing: boolean;
}

interface EnabledToolSnapshot {
  name: string;
  params: Record<string, unknown>;
}

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

const DEBOUNCE_MS = 500;

/**
 * Extract a stable snapshot of enabled tools for comparison.
 * Only includes tool name + params (order matters).
 */
const buildSnapshot = (tools: PipelineTool[]): EnabledToolSnapshot[] =>
  tools
    .filter((t) => t.enabled)
    .map(({ name, params }) => ({ name, params }));

/**
 * Deep-compare two tool snapshots (serialization-based).
 */
const snapshotsEqual = (a: EnabledToolSnapshot[], b: EnabledToolSnapshot[]): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

// -----------------------------------------------------------------
// Hook
// -----------------------------------------------------------------

/**
 * Computes a live preview for the currently selected editor image
 * by running the enabled pipeline tools client-side.
 *
 * - Debounces param changes by 300ms (covers slider drags)
 * - Cancels stale computations when inputs change
 * - Revokes old Object URLs to avoid memory leaks
 */
export const useLivePreview = (
  selectedImage: BatchImage | null,
  enabledTools: PipelineTool[],
): UseLivePreviewResult => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const { processImage } = useClientProcessing();

  // Track the latest request so we can discard stale results
  const requestIdRef = useRef(0);
  // Track the previous Object URL so we can revoke it
  const prevUrlRef = useRef<string | null>(null);
  // Debounce timer
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Previous snapshot for shallow bail-out
  const prevSnapshotRef = useRef<EnabledToolSnapshot[]>([]);
  // Track previous image ID to detect image switches
  const prevImageIdRef = useRef<string | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    // No image or no enabled tools -> clear preview
    const snapshot = buildSnapshot(enabledTools);
    if (!selectedImage || snapshot.length === 0) {
      cleanup();
      if (prevUrlRef.current) {
        URL.revokeObjectURL(prevUrlRef.current);
        prevUrlRef.current = null;
      }
      setPreviewUrl(null);
      setIsProcessing(false);
      prevSnapshotRef.current = [];
      return;
    }

    // Detect image switch — reset preview immediately so old image doesn't linger
    const imageChanged = selectedImage.id !== prevImageIdRef.current;
    prevImageIdRef.current = selectedImage.id;

    if (imageChanged) {
      // Clear stale preview from previous image
      if (prevUrlRef.current) {
        URL.revokeObjectURL(prevUrlRef.current);
        prevUrlRef.current = null;
      }
      setPreviewUrl(null);
      // Force recompute by resetting snapshot
      prevSnapshotRef.current = [];
    }

    // Bail out if nothing actually changed (same image + same tools)
    if (!imageChanged && snapshotsEqual(snapshot, prevSnapshotRef.current)) {
      return;
    }
    prevSnapshotRef.current = snapshot;

    // Bump request ID to invalidate any in-flight processing
    const currentRequestId = ++requestIdRef.current;

    // Clear previous debounce
    cleanup();
    setIsProcessing(true);

    timerRef.current = setTimeout(async () => {
      try {
        // Build a temporary BatchImage using the ORIGINAL source (not processedUrl)
        // so the preview always starts fresh from the original
        const sourceImage: BatchImage = {
          ...selectedImage,
          processedUrl: undefined,
          status: 'idle',
        };

        const result = await processImage(sourceImage, enabledTools);

        // Discard if a newer request has started
        if (requestIdRef.current !== currentRequestId) {
          // Clean up the result we won't use
          if (result.processedUrl) URL.revokeObjectURL(result.processedUrl);
          return;
        }

        // Revoke the previous preview URL with a delay so the canvas has time
        // to load the new image before the old one becomes invalid (prevents jumping)
        const oldUrl = prevUrlRef.current;
        const newUrl = result.processedUrl ?? null;
        prevUrlRef.current = newUrl;
        setPreviewUrl(newUrl);
        if (oldUrl) {
          setTimeout(() => URL.revokeObjectURL(oldUrl), 500);
        }
      } catch {
        // On error, clear preview
        if (requestIdRef.current === currentRequestId) {
          setPreviewUrl(null);
        }
      } finally {
        if (requestIdRef.current === currentRequestId) {
          setIsProcessing(false);
        }
      }
    }, DEBOUNCE_MS);

    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedImage?.id, selectedImage?.previewUrl, enabledTools, processImage, cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
      if (prevUrlRef.current) {
        URL.revokeObjectURL(prevUrlRef.current);
        prevUrlRef.current = null;
      }
    };
  }, [cleanup]);

  return { previewUrl, isProcessing };
};
