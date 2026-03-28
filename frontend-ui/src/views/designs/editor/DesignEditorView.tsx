import { Box, Typography } from '@mui/material';
import ConstructionIcon from '@mui/icons-material/Construction';
/**
 * Design Editor (Post-Processing Pipeline) — Phase B3 scaffold.
 * Konva.js canvas, pipeline toolbar, batch thumbnail strip.
 * Full implementation deferred to Phase B iteration.
 */
export const DesignEditorView = () => {

  return (
    <Box
      sx={{
        py: 8,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1,
      }}
    >
      <ConstructionIcon sx={{ fontSize: 64, color: 'text.disabled' }} />
      <Typography variant="h5" color="text.secondary">
        Design Editor
      </Typography>
      <Typography variant="body2" color="text.disabled">
        Post-processing pipeline with Konva.js canvas coming soon (Phase B).
      </Typography>
    </Box>
  );
};

export default DesignEditorView;
