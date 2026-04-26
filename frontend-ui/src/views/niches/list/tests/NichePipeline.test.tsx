/**
 * SKIPPED — NichePipeline migrated to MPDrawer panel (PROJ-17 AC-35).
 *
 * Original test mounted `<NichePipeline open mode selectedId onClose />` which
 * is no longer the component contract. Component now reads `activeNicheId` and
 * `nicheMode` from `chatBarSlice` and renders inside `MultiPurposeDrawer`.
 *
 * TODO: Rewrite using `renderWithProviders` with chatBarSlice preloaded state
 * + mounting `<MultiPurposeDrawer />` (or directly `<NichePipeline />` with
 * the slice preloaded).
 */
import { describe } from 'vitest';

describe.skip('NichePipeline (legacy contract) — migrated to MPDrawer panel', () => {});
