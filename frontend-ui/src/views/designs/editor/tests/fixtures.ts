import type { BatchImage, PipelineTool, ExportSettings } from '../types';

// -----------------------------------------------------------------
// Batch Image Fixtures
// -----------------------------------------------------------------

export const makeBatchImage = (
  overrides?: Partial<BatchImage>,
): BatchImage => ({
  id: 'img-1',
  file: null,
  previewUrl: 'blob:http://localhost/preview-1',
  name: 'design-1.png',
  status: 'idle',
  width: 4500,
  height: 5400,
  fileSize: 1024000,
  ...overrides,
});

export const makeBatchImages = (count: number): BatchImage[] =>
  Array.from({ length: count }, (_, i) =>
    makeBatchImage({
      id: `img-${i + 1}`,
      name: `design-${i + 1}.png`,
      previewUrl: `blob:http://localhost/preview-${i + 1}`,
      status: i === 0 ? 'idle' : i === 1 ? 'completed' : i === 2 ? 'processing' : 'error',
    }),
  );

export const makeProcessedBatchImage = (
  overrides?: Partial<BatchImage>,
): BatchImage =>
  makeBatchImage({
    status: 'completed',
    processedUrl: 'blob:http://localhost/processed-1',
    originalUrl: 'blob:http://localhost/original-1',
    designId: 'design-uuid-1',
    ...overrides,
  });

// -----------------------------------------------------------------
// Pipeline Tool Fixtures
// -----------------------------------------------------------------

export const makePipelineTool = (
  overrides?: Partial<PipelineTool>,
): PipelineTool => ({
  id: 'tool-1',
  name: 'trim',
  params: {},
  enabled: true,
  condition: null,
  ...overrides,
});

export const makePipelineTools = (): PipelineTool[] => [
  makePipelineTool({ id: 'tool-1', name: 'color_removal' }),
  makePipelineTool({ id: 'tool-2', name: 'trim' }),
  makePipelineTool({ id: 'tool-3', name: 'resize' }),
];

// -----------------------------------------------------------------
// Export Settings Fixture
// -----------------------------------------------------------------

export const makeExportSettings = (
  overrides?: Partial<ExportSettings>,
): ExportSettings => ({
  format: 'png',
  dpi: 300,
  compression: 80,
  overwriteOriginal: false,
  ...overrides,
});
