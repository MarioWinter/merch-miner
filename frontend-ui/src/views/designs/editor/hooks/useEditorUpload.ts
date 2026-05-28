import { useCallback } from 'react';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { useUploadDesignToProjectMutation } from '@/store/designSlice';
import type { BatchImage } from '../types';

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

interface UseEditorUploadParams {
  projectId: string;
  setBatchImages: React.Dispatch<React.SetStateAction<BatchImage[]>>;
}

interface UseEditorUploadReturn {
  /** Upload an array of BatchImage entries (with file) to the backend */
  uploadFiles: (images: BatchImage[]) => void;
}

// -----------------------------------------------------------------
// Hook
// -----------------------------------------------------------------

export const useEditorUpload = ({
  projectId,
  setBatchImages,
}: UseEditorUploadParams): UseEditorUploadReturn => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [uploadDesign] = useUploadDesignToProjectMutation();

  const uploadFiles = useCallback(
    (images: BatchImage[]) => {
      if (!projectId) return;

      for (const img of images) {
        if (!img.file) continue;

        uploadDesign({ projectId, file: img.file })
          .unwrap()
          .then((design) => {
            // Replace blob URL with persistent server URL
            URL.revokeObjectURL(img.previewUrl);
            setBatchImages((prev) =>
              prev.map((bi) =>
                bi.id === img.id
                  ? {
                      ...bi,
                      previewUrl: design.image_file ?? bi.previewUrl,
                      designId: design.id,
                    }
                  : bi,
              ),
            );
          })
          .catch(() => {
            enqueueSnackbar(
              t('design.editor.uploadFailed', { name: img.name }),
              { variant: 'error' },
            );
            // Keep blob URL as fallback — user sees the image but it won't persist
          });
      }
    },
    [projectId, uploadDesign, setBatchImages, enqueueSnackbar, t],
  );

  return { uploadFiles };
};
