import { IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import LinkIcon from '@mui/icons-material/Link';
import { useTranslation } from 'react-i18next';
import { SourceBadge } from '../../research/partials/SourceBadge';
import type { NicheKeyword } from '../types';

interface KeywordChipRowProps {
  keyword: NicheKeyword;
  onDelete: (id: string) => void;
}

export const KeywordChipRow = ({ keyword, onDelete }: KeywordChipRowProps) => {
  const { t } = useTranslation();

  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1}
      sx={(theme) => ({
        py: 0.5,
        px: 1,
        borderRadius: '6px',
        '&:hover': {
          backgroundColor: alpha(theme.palette.common.white, 0.04),
        },
      })}
    >
      <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
        {keyword.keyword}
      </Typography>

      <SourceBadge source={keyword.source} />

      {keyword.design_template && (
        <Tooltip title={keyword.design_template.slogan}>
          <LinkIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
        </Tooltip>
      )}

      <IconButton
        size="small"
        onClick={() => onDelete(keyword.id)}
        aria-label={t('keywords.drawer.deleteKeyword')}
        sx={{ borderRadius: '6px' }}
      >
        <DeleteOutlineIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Stack>
  );
};
