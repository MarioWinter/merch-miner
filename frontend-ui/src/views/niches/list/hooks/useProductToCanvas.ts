import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import {
  useListProjectsQuery,
  useAddReferencesToProjectMutation,
} from '@/store/designSlice';
import type { DesignProjectListItem } from '@/views/designs/gallery/types';

interface UseProductToCanvasOptions {
  nicheId: string;
  nicheName?: string;
}

interface UseProductToCanvasReturn {
  /** Send one or more product IDs to canvas — resolves project via 0/1/N logic */
  sendToCanvas: (productIds: string[]) => void;
  /** True while the add-references mutation is in flight */
  isSending: boolean;
  /** ProjectNamingDialog state */
  dialogOpen: boolean;
  closeDialog: () => void;
  /** Callback for ProjectNamingDialog — after project is created/selected */
  handleProjectSelected: (projectId: string) => void;
  /** Props to pass to ProjectNamingDialog */
  dialogNicheId: string | null;
  dialogNicheName: string | undefined;
}

/**
 * Hook that implements the 0/1/N project resolution for "Send to Canvas".
 * - 0 projects for niche -> open ProjectNamingDialog (create mode)
 * - 1 project for niche -> add references directly
 * - N projects for niche -> open ProjectNamingDialog (select mode)
 */
export const useProductToCanvas = ({
  nicheId,
  nicheName,
}: UseProductToCanvasOptions): UseProductToCanvasReturn => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  const { data: projectData } = useListProjectsQuery();
  const [addReferences, { isLoading: isSending }] = useAddReferencesToProjectMutation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingProductIds, setPendingProductIds] = useState<string[]>([]);

  const nicheProjects = useMemo(
    () =>
      (projectData?.results ?? []).filter(
        (p: DesignProjectListItem) => p.niche === nicheId,
      ),
    [projectData, nicheId],
  );

  const addRefsToProject = useCallback(
    async (projectId: string, productIds: string[], projectName: string, isNew: boolean) => {
      try {
        const result = await addReferences({
          projectId,
          body: { product_ids: productIds },
        }).unwrap();

        const addedCount = result.created ?? productIds.length;
        enqueueSnackbar(
          t('niches.drawer.collectedProducts.addedToCanvas', {
            count: addedCount,
            project: projectName,
          }),
          { variant: 'success' },
        );

        if (isNew) {
          navigate(`/designs/${projectId}`);
        }
      } catch {
        enqueueSnackbar(
          t('niches.drawer.collectedProducts.addToCanvasFailed', 'Failed to add references'),
          { variant: 'error' },
        );
      }
    },
    [addReferences, enqueueSnackbar, t, navigate],
  );

  const sendToCanvas = useCallback(
    (productIds: string[]) => {
      if (productIds.length === 0) return;

      if (nicheProjects.length === 0) {
        // 0 projects -> open dialog to create
        setPendingProductIds(productIds);
        setDialogOpen(true);
      } else if (nicheProjects.length === 1) {
        // 1 project -> add directly
        const project = nicheProjects[0];
        void addRefsToProject(project.id, productIds, project.name, false);
      } else {
        // N projects -> open dialog to select
        setPendingProductIds(productIds);
        setDialogOpen(true);
      }
    },
    [nicheProjects, addRefsToProject],
  );

  const handleProjectSelected = useCallback(
    async (projectId: string) => {
      if (pendingProductIds.length === 0) return;

      // Find project name from existing projects or use nicheName
      const existingProject = nicheProjects.find((p) => p.id === projectId);
      const projectName = existingProject?.name ?? nicheName ?? 'Project';
      const isNew = !existingProject;

      await addRefsToProject(projectId, pendingProductIds, projectName, isNew);
      setPendingProductIds([]);
      setDialogOpen(false);
    },
    [pendingProductIds, nicheProjects, nicheName, addRefsToProject],
  );

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setPendingProductIds([]);
  }, []);

  return {
    sendToCanvas,
    isSending,
    dialogOpen,
    closeDialog,
    handleProjectSelected,
    dialogNicheId: nicheId,
    dialogNicheName: nicheName,
  };
};
