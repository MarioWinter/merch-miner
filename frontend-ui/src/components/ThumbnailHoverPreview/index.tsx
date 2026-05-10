import type { ReactNode } from 'react';
import { Box, Tooltip } from '@mui/material';
import { styled } from '@mui/material/styles';

interface ThumbnailHoverPreviewProps {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
  children: ReactNode;
}

const PreviewImg = styled('img')(({ theme }) => ({
  display: 'block',
  objectFit: 'contain',
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.vars.palette.background.default,
}));

// Floats as overlay via Tooltip's Popper → React Portal (never pushes layout).
// Falsy `src` short-circuits to children so empty thumbnails don't open empty
// tooltips.
const ThumbnailHoverPreview = ({
  src,
  alt,
  width = 320,
  height = 400,
  children,
}: ThumbnailHoverPreviewProps) => {
  if (!src) return <>{children}</>;

  return (
    <Tooltip
      enterDelay={250}
      leaveDelay={0}
      placement="right-start"
      slotProps={{
        tooltip: {
          sx: {
            bgcolor: 'background.paper',
            boxShadow: 8,
            p: 0.5,
            maxWidth: 'unset',
          },
        },
        popper: {
          modifiers: [
            {
              name: 'flip',
              enabled: true,
              options: {
                fallbackPlacements: ['left-start', 'right-start'],
              },
            },
          ],
        },
      }}
      title={
        <Box sx={{ width, height }}>
          <PreviewImg
            src={src}
            alt={alt ?? ''}
            width={width}
            height={height}
            loading="lazy"
            referrerPolicy="no-referrer"
            draggable={false}
          />
        </Box>
      }
    >
      {/* Tooltip needs a single DOM-aware child; wrap in span so any child
          (including <img>) reliably forwards refs + mouse events. */}
      <span>{children}</span>
    </Tooltip>
  );
};

export default ThumbnailHoverPreview;
