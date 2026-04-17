import { Box, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import { DURATION, EASING } from '@/style/constants';
import type { BreadcrumbSegment } from '../../types';

interface BreadcrumbNavProps {
  segments: BreadcrumbSegment[];
  onNavigate: (collectionId: string | null) => void;
}

const BreadcrumbContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  minWidth: 0,
  overflow: 'hidden',
}));

const Crumb = styled(Typography, {
  shouldForwardProp: (prop) => prop !== 'isLast',
})<{ isLast: boolean }>(({ theme, isLast }) => ({
  cursor: isLast ? 'default' : 'pointer',
  fontWeight: isLast ? 600 : 400,
  color: isLast
    ? theme.vars.palette.text.primary
    : theme.vars.palette.text.secondary,
  whiteSpace: 'nowrap',
  transition: `color ${DURATION.fast}ms ${EASING.standard}`,
  '&:hover': {
    color: isLast ? undefined : theme.vars.palette.text.primary,
  },
}));

const Separator = styled(Typography)(({ theme }) => ({
  color: theme.vars.palette.text.disabled,
  margin: theme.spacing(0, 1),
  userSelect: 'none',
}));

const BreadcrumbNav = ({ segments, onNavigate }: BreadcrumbNavProps) => {
  return (
    <BreadcrumbContainer aria-label="Breadcrumb navigation">
      <FolderOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary', mr: 0.5 }} />
      {segments.map((segment, idx) => {
        const isLast = idx === segments.length - 1;
        return (
          <Box key={segment.id ?? 'root'} sx={{ display: 'flex', alignItems: 'center' }}>
            {idx > 0 && (
              <Separator variant="caption">&rsaquo;</Separator>
            )}
            <Crumb
              variant="body2"
              isLast={isLast}
              onClick={() => {
                if (!isLast) onNavigate(segment.id);
              }}
            >
              {segment.label}
            </Crumb>
          </Box>
        );
      })}
    </BreadcrumbContainer>
  );
};

export default BreadcrumbNav;
