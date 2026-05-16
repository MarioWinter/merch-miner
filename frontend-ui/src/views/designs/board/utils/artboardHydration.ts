import type { ArtboardData, BackgroundColor, BoardLayout, CanvasElement, DesignModel } from '../types';
import {
  DEFAULT_ARTBOARD_HEIGHT,
  DEFAULT_ARTBOARD_WIDTH,
  nextArtboardLabel,
} from './artboardSizing';

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

export interface HydratableDesign {
  id: string;
  image_file: string | null;
  status: string;
  is_manual?: boolean;
  background_color?: string;
  generation_run?: {
    id?: string;
    prompt_used?: string;
    model_name?: string;
    status?: string;
  } | null;
}

// -----------------------------------------------------------------
// Hydration
// -----------------------------------------------------------------

/**
 * Build artboard state from API designs + saved layout.
 * `existingArtboards` preserves local state (dimensions, labels, positions)
 * that may not yet be persisted to the layout.
 */
export const hydrateDesigns = (
  designs: HydratableDesign[],
  savedLayout: BoardLayout | null,
  existingArtboards?: ArtboardData[],
): ArtboardData[] => {
  const layoutNodes = savedLayout?.nodes ?? [];
  const nodeMap = new Map(layoutNodes.map((n) => [n.id, n]));

  // Map existing artboards by both id AND designId
  const existingById = new Map<string, ArtboardData>();
  for (const ab of existingArtboards ?? []) {
    existingById.set(ab.id, ab);
    if (ab.designId) existingById.set(ab.designId, ab);
  }

  // Collect all existing labels
  const allLabels: string[] = [];
  for (const ab of existingArtboards ?? []) allLabels.push(ab.label);

  const designIds = new Set(designs.map((d) => d.id));

  // Build a map: pendingRunId -> skeleton, so we can absorb a skeleton into
  // its completed design artboard (keeps position, avoids duplicates).
  // Source 1: in-memory artboards (same-session generation).
  // Source 2: saved layout nodes (page-reload mid-generation).
  const skeletonByRunId = new Map<string, BoardLayoutNode>();
  for (const n of layoutNodes) {
    if (n.pendingRunId && n.isGenerating) skeletonByRunId.set(n.pendingRunId, n);
  }
  for (const ab of existingArtboards ?? []) {
    if (ab.pendingRunId && ab.isGenerating) {
      skeletonByRunId.set(ab.pendingRunId, {
        id: ab.id, x: ab.x, y: ab.y, label: ab.label,
        width: ab.width, height: ab.height,
        backgroundColor: ab.backgroundColor, opacity: ab.opacity,
        clipContent: ab.clipContent, layers: ab.layers ?? [],
        kind: ab.kind, isGenerating: ab.isGenerating,
        pendingRunId: ab.pendingRunId, promptUsed: ab.promptUsed,
      });
    }
  }
  // Mark which skeletons have been absorbed so we don't emit them twice.
  const absorbedSkeletonIds = new Set<string>();

  // Skeleton + failed-run artboards from saved layout that don't correspond
  // to a design yet (in-flight generation OR a failed run with no design).
  const skeletons: ArtboardData[] = layoutNodes
    .filter((n) => !designIds.has(n.id) && (n.isGenerating || n.hasError))
    .map((n) => ({
      id: n.id,
      label: n.label ?? 'AI: …',
      x: n.x,
      y: n.y,
      width: n.width ?? DEFAULT_ARTBOARD_WIDTH,
      height: n.height ?? DEFAULT_ARTBOARD_HEIGHT,
      imageUrl: null,
      kind: (n.kind ?? 'ai') as ArtboardData['kind'],
      sourceId: null,
      designId: null,
      opacity: n.opacity ?? 100,
      backgroundColor: n.backgroundColor ?? '#FFFFFF',
      clipContent: n.clipContent ?? false,
      isGenerating: Boolean(n.isGenerating),
      hasError: Boolean(n.hasError),
      pendingRunId: n.pendingRunId ?? null,
      promptUsed: n.promptUsed,
      layers: (n.layers ?? []) as CanvasElement[],
    }));

  const hydrated = designs.map((d, i) => {
    const run = d.generation_run;
    // Absorb a still-persisted skeleton when its run matches this design.
    const skeletonMatch = run?.id ? skeletonByRunId.get(run.id) : undefined;
    if (skeletonMatch) absorbedSkeletonIds.add(skeletonMatch.id);
    const saved = nodeMap.get(d.id) ?? skeletonMatch;
    const existing = existingById.get(d.id);
    const isAi = !!run && !d.is_manual;
    const promptText = run?.prompt_used ?? '';
    const imageUrl = d.image_file ?? null;

    // Priority: existing in-memory > saved layout > defaults
    const abWidth = existing?.width ?? saved?.width ?? DEFAULT_ARTBOARD_WIDTH;
    const abHeight = existing?.height ?? saved?.height ?? DEFAULT_ARTBOARD_HEIGHT;

    const savedLayers = existing?.layers ?? (saved?.layers ?? []) as CanvasElement[];

    // Auto-create image layer if artboard has imageUrl but no image element in layers
    let layers = savedLayers;
    if (imageUrl && !savedLayers.some((l) => l.type === 'image')) {
      const imgLayer: CanvasElement<'image'> = {
        id: `img_${d.id}`,
        type: 'image',
        x: 0,
        y: 0,
        width: abWidth,
        height: abHeight,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        opacity: 1,
        visible: true,
        locked: false,
        zIndex: 0,
        name: 'Image',
        props: { src: imageUrl, naturalWidth: abWidth, naturalHeight: abHeight },
      };
      layers = [imgLayer, ...savedLayers];
    }

    // Label priority: existing > saved layout > AI prefix > auto-increment
    let label = existing?.label ?? saved?.label;
    if (!label) {
      if (isAi) {
        label = `AI: ${promptText.slice(0, 30)}${promptText.length > 30 ? '...' : ''}`;
      } else {
        label = nextArtboardLabel(allLabels);
      }
    }
    allLabels.push(label);

    return {
      id: d.id,
      label,
      x: existing?.x ?? saved?.x ?? 80 + i * (DEFAULT_ARTBOARD_WIDTH + 60),
      y: existing?.y ?? saved?.y ?? 80,
      width: abWidth,
      height: abHeight,
      imageUrl,
      kind: isAi ? 'ai' as const : 'regular' as const,
      sourceId: existing?.sourceId ?? null,
      designId: d.id,
      opacity: existing?.opacity ?? saved?.opacity ?? 100,
      backgroundColor: existing?.backgroundColor ?? saved?.backgroundColor ?? '#FFFFFF',
      clipContent: existing?.clipContent ?? saved?.clipContent ?? false,
      promptUsed: run?.prompt_used,
      modelUsed: run?.model_name as DesignModel | undefined,
      bgColorUsed: d.background_color as BackgroundColor | undefined,
      layers,
    };
  });

  const remainingSkeletons = skeletons.filter((s) => !absorbedSkeletonIds.has(s.id));
  return [...hydrated, ...remainingSkeletons];
};

/**
 * Merge hydrated artboards with locally-added ones that have no matching design.
 * Prevents duplicates when uploaded artboards (id=ab_xxx, designId=uuid) match
 * a hydrated artboard (id=uuid). Also drops skeleton artboards whose run has
 * been absorbed into a hydrated design artboard.
 */
export const mergeWithLocalArtboards = (
  hydrated: ArtboardData[],
  currentArtboards: ArtboardData[],
  designIds: Set<string>,
  completedRunIds?: Set<string>,
): ArtboardData[] => {
  const runIds = completedRunIds ?? new Set<string>();
  const localOnly = currentArtboards.filter(
    (ab) =>
      !designIds.has(ab.id) &&
      !(ab.designId && designIds.has(ab.designId)) &&
      !(ab.pendingRunId && runIds.has(ab.pendingRunId)),
  );
  return [...hydrated, ...localOnly];
};
