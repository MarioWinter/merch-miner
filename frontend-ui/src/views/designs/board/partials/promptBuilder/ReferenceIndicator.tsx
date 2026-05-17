// PROJ-34 Phase 8 — read-only paperclip row mirroring the RightPanel
// reference. Hidden when no source image is set.

import { Stack, Tooltip, Typography } from '@mui/material';
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded';
import { styled } from '@mui/material/styles';

interface ReferenceIndicatorProps {
  url: string | null;
}

const Filename = styled(Typography)(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.vars.palette.text.primary,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  minWidth: 0,
}));

const Meta = styled(Typography)(({ theme }) => ({
  ...theme.typography.caption,
  color: theme.vars.palette.text.secondary,
  flexShrink: 0,
}));

const ReferenceIndicator = ({ url }: ReferenceIndicatorProps) => {
  if (!url) return null;
  // Last URL segment is good enough — these are S3-style filenames.
  const filename = url.split('/').filter(Boolean).pop() ?? url;
  return (
    <Tooltip title="Set in the right panel" placement="top">
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{ minWidth: 0, py: 1, px: 1.5 }}
      >
        <AttachFileRoundedIcon
          fontSize="small"
          sx={{ color: 'text.secondary', flexShrink: 0 }}
        />
        <Filename title={filename}>{filename}</Filename>
        <Meta>(read-only)</Meta>
      </Stack>
    </Tooltip>
  );
};

export default ReferenceIndicator;
