import { Box, Breadcrumbs, Link, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useTranslation } from 'react-i18next';
import { DURATION, EASING } from '@/style/constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CloudPathSegment {
  id: string | null;
  name: string;
}

interface CloudFolderBreadcrumbsProps {
  path: CloudPathSegment[];
  onNavigate: (index: number) => void;
  /** When true, uses a chevron separator + leading folder icon (dialog variant) */
  decorated?: boolean;
}

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const CrumbLink = styled(Link)(({ theme }) => ({
  cursor: 'pointer',
  color: theme.vars.palette.text.secondary,
  textDecorationColor: 'transparent',
  transition: `color ${DURATION.fast}ms ${EASING.standard}`,
  '&:hover': {
    color: theme.vars.palette.text.primary,
    textDecorationColor: theme.vars.palette.text.primary,
  },
}));

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const CloudFolderBreadcrumbs = ({
  path,
  onNavigate,
  decorated,
}: CloudFolderBreadcrumbsProps) => {
  const { t } = useTranslation();

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {decorated && (
        <FolderOutlinedIcon
          sx={{ fontSize: 16, color: 'text.secondary', mr: 0.5 }}
        />
      )}
      <Breadcrumbs
        aria-label={t('publish.cloud.folderNav', {
          defaultValue: 'Folder navigation',
        })}
        separator={
          decorated ? (
            <ChevronRightIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
          ) : (
            '/'
          )
        }
      >
        {path.map((segment, idx) => {
          const isLast = idx === path.length - 1;
          return isLast ? (
            <Typography
              key={`${segment.id ?? 'root'}-${idx}`}
              variant="body2"
              color="text.primary"
              sx={{ fontWeight: 600 }}
            >
              {segment.name}
            </Typography>
          ) : (
            <CrumbLink
              key={`${segment.id ?? 'root'}-${idx}`}
              {...({ component: 'button' } as { component: 'button' })}
              variant="body2"
              underline="hover"
              onClick={() => onNavigate(idx)}
            >
              {segment.name}
            </CrumbLink>
          );
        })}
      </Breadcrumbs>
    </Box>
  );
};

export default CloudFolderBreadcrumbs;
