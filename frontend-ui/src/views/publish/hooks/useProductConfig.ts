import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useGetProductConfigQuery,
  useUpdateProductConfigMutation,
} from '@/store/publishSlice';
import type {
  DesignProductConfig,
  MarketplaceConfig,
  MarketplaceType,
  PrintSide,
  UpdateProductConfigBody,
} from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UseProductConfigArgs {
  designId: string | null | undefined;
  marketplaceType: MarketplaceType;
}

export interface ProductConfigState {
  productTypes: string[];
  fitTypes: string[];
  printSide: PrintSide;
  colors: string[];
  marketplaces: MarketplaceConfig[];
}

const EMPTY_CONFIG: ProductConfigState = {
  productTypes: [],
  fitTypes: [],
  printSide: 'front',
  colors: [],
  marketplaces: [],
};

type RtkError = { status?: number; data?: unknown };

const isNotFound = (err: unknown): boolean =>
  Boolean(err && typeof err === 'object' && (err as RtkError).status === 404);

// Matches `AUTO_SAVE_DELAY_MS` in useListingEditor — same keystroke feel.
const AUTO_SAVE_DELAY_MS = 1200;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const toState = (config: DesignProductConfig | undefined): ProductConfigState => {
  if (!config) return EMPTY_CONFIG;
  return {
    productTypes: config.product_types ?? [],
    fitTypes: config.fit_types ?? [],
    printSide: config.print_side ?? 'front',
    colors: config.colors ?? [],
    marketplaces: config.marketplaces ?? [],
  };
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * F4 / G-Config — per-design product config.
 *
 * Backed by RTK Query (`getProductConfig` / `updateProductConfig`). 404 from
 * the GET endpoint is expected when no row exists yet — we map it to empty
 * defaults so the UI has sensible starting values without showing an error.
 *
 * Setters merge into a local optimistic snapshot so the UI feels instant, and
 * schedule a debounced PATCH. On unmount (or explicit `flush()`) any pending
 * save is flushed synchronously so design / marketplace switches don't drop
 * edits.
 */
export const useProductConfig = ({
  designId,
  marketplaceType,
}: UseProductConfigArgs) => {
  const skip = !designId;

  const {
    data,
    isLoading,
    isFetching,
    error,
  } = useGetProductConfigQuery(
    skip
      ? { designId: '', marketplace_type: marketplaceType }
      : { designId, marketplace_type: marketplaceType },
    { skip },
  );

  const notFound = Boolean(error) && isNotFound(error);
  const hasHardError = Boolean(error) && !notFound;

  const [updateConfig] = useUpdateProductConfigMutation();

  // ---- Optimistic local snapshot ----------------------------------------
  // Seeded from server data; each setter merges into it so we avoid a round
  // trip before the UI updates.
  const [optimistic, setOptimistic] = useState<ProductConfigState | null>(
    null,
  );

  // When server data changes (design switch, marketplace switch, fresh
  // fetch), reset the optimistic snapshot. We key on the identity of the
  // row so we don't clobber in-flight edits when RTK refetches the same row.
  const lastServerKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const key = `${designId ?? 'none'}|${marketplaceType}|${data?.id ?? (notFound ? 'none' : 'pending')}`;
    if (key === lastServerKeyRef.current) return;
    lastServerKeyRef.current = key;
    if (data) {
      setOptimistic(toState(data));
    } else if (notFound) {
      setOptimistic(EMPTY_CONFIG);
    } else if (skip) {
      setOptimistic(null);
    }
  }, [data, notFound, skip, designId, marketplaceType]);

  const config: ProductConfigState = useMemo(() => {
    if (optimistic) return optimistic;
    return toState(data);
  }, [optimistic, data]);

  // ---- Auto-save --------------------------------------------------------
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingBodyRef = useRef<UpdateProductConfigBody | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  const runSave = useCallback(async () => {
    if (!designId) return;
    const body = pendingBodyRef.current;
    if (!body) return;
    pendingBodyRef.current = null;
    setIsAutoSaving(true);
    try {
      await updateConfig({ designId, body }).unwrap();
    } catch {
      // Silent: consistent with listing auto-save.
    } finally {
      setIsAutoSaving(false);
    }
  }, [designId, updateConfig]);

  const scheduleSave = useCallback(
    (patch: Omit<UpdateProductConfigBody, 'marketplace_type'>) => {
      if (!designId) return;
      pendingBodyRef.current = {
        ...(pendingBodyRef.current ?? {}),
        ...patch,
        marketplace_type: marketplaceType,
      };
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      autoSaveTimerRef.current = setTimeout(() => {
        autoSaveTimerRef.current = null;
        void runSave();
      }, AUTO_SAVE_DELAY_MS);
    },
    [designId, marketplaceType, runSave],
  );

  const flush = useCallback(async () => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    await runSave();
  }, [runSave]);

  // Flush on unmount so tab/design switches don't drop pending edits.
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      // Fire-and-forget: unmount cannot await. Server will upsert whenever
      // it gets the body.
      void runSave();
    };
  }, [runSave]);

  // ---- Setters ----------------------------------------------------------
  const mergeLocal = useCallback(
    (patch: Partial<ProductConfigState>) => {
      setOptimistic((prev) => ({ ...(prev ?? EMPTY_CONFIG), ...patch }));
    },
    [],
  );

  const setProductTypes = useCallback(
    (productTypes: string[]) => {
      mergeLocal({ productTypes });
      scheduleSave({ product_types: productTypes });
    },
    [mergeLocal, scheduleSave],
  );

  const setFitTypes = useCallback(
    (fitTypes: string[]) => {
      mergeLocal({ fitTypes });
      scheduleSave({ fit_types: fitTypes });
    },
    [mergeLocal, scheduleSave],
  );

  const setPrintSide = useCallback(
    (printSide: PrintSide) => {
      mergeLocal({ printSide });
      scheduleSave({ print_side: printSide });
    },
    [mergeLocal, scheduleSave],
  );

  const setColors = useCallback(
    (colors: string[]) => {
      mergeLocal({ colors });
      scheduleSave({ colors });
    },
    [mergeLocal, scheduleSave],
  );

  const setMarketplaces = useCallback(
    (marketplaces: MarketplaceConfig[]) => {
      mergeLocal({ marketplaces });
      scheduleSave({ marketplaces });
    },
    [mergeLocal, scheduleSave],
  );

  return {
    config,
    isLoading,
    isFetching,
    loadError: hasHardError ? error : null,
    isAutoSaving,
    setProductTypes,
    setFitTypes,
    setPrintSide,
    setColors,
    setMarketplaces,
    flush,
  };
};

export type UseProductConfigReturn = ReturnType<typeof useProductConfig>;
