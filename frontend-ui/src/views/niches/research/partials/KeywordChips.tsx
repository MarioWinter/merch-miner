import { Box, Button, Chip, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import CheckIcon from '@mui/icons-material/Check';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SearchIcon from '@mui/icons-material/Search';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
// useNavigate will be needed when PROJ-7 Live Research is ready
// import { useNavigate } from 'react-router-dom';
import { COLORS } from '../../../../style/constants';
import { toggleKeyword, removeKeyword, selectCollectedKeywords } from '../../../../store/collectedItemsSlice';
import type { RootState } from '../../../../store';
import type { NicheKeywords } from '../types';

interface KeywordChipsProps {
  keywords: NicheKeywords;
  nicheId: string;
}

const Card = styled(Box)(({ theme }) => ({
  background: theme.vars.palette.background.paper,
  border: `1px solid ${theme.vars.palette.divider}`,
  borderRadius: 12,
  padding: theme.spacing(2.5, 3),
}));

const SectionLabel = styled(Typography)(({ theme }) => ({
  fontSize: '0.6875rem',
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: theme.vars.palette.text.secondary,
  marginBottom: theme.spacing(1),
}));

const ResearchIconButton = styled(IconButton)(({ theme }) => ({
  padding: 2,
  marginLeft: 2,
  color: theme.vars.palette.text.secondary,
  '&:hover': {
    color: COLORS.cyan,
    backgroundColor: alpha(COLORS.cyan, 0.1),
  },
}));

interface ChipGroupProps {
  chips: string[];
  color: 'primary' | 'secondary' | 'success' | 'info';
  selectedKeywords: Set<string>;
  onToggle: (keyword: string) => void;
  onResearch: (keyword: string) => void;
  researchTooltip: string;
}

const ChipGroup = ({
  chips,
  color,
  selectedKeywords,
  onToggle,
  onResearch,
  researchTooltip,
}: ChipGroupProps) => (
  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
    {chips.map((chip, idx) => {
      const isSelected = selectedKeywords.has(chip);

      return (
        <Chip
          key={`${chip}-${idx}`}
          size="small"
          onClick={() => onToggle(chip)}
          label={
            <Stack direction="row" alignItems="center" spacing={0.5}>
              {isSelected ? (
                <CheckIcon sx={{ fontSize: 12, color: COLORS.cyan }} />
              ) : (
                <ContentCopyIcon sx={{ fontSize: 12 }} />
              )}
              <span>{chip}</span>
              <Tooltip title={researchTooltip} placement="top" arrow>
                <ResearchIconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onResearch(chip);
                  }}
                  aria-label={researchTooltip}
                >
                  <SearchIcon sx={{ fontSize: 14 }} />
                </ResearchIconButton>
              </Tooltip>
            </Stack>
          }
          sx={(theme) => ({
            backgroundColor: isSelected
              ? alpha(COLORS.cyan, 0.15)
              : alpha(theme.palette[color].main, 0.1),
            color: isSelected ? COLORS.cyan : theme.vars.palette[color].main,
            border: isSelected ? `1px solid ${COLORS.cyan}` : '1px solid transparent',
            borderRadius: '6px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 150ms ease',
            '& .MuiChip-label': {
              paddingRight: 1,
            },
          })}
        />
      );
    })}
  </Stack>
);

const KeywordChips = ({ keywords, nicheId }: KeywordChipsProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const dispatch = useDispatch();
  const collectedKeywords = useSelector((state: RootState) => selectCollectedKeywords(state, nicheId));
  const selectedKeywords = new Set(collectedKeywords);

  const handleToggle = (keyword: string) => {
    dispatch(toggleKeyword({ nicheId, value: keyword }));
    navigator.clipboard.writeText(keyword);
    const isRemoving = selectedKeywords.has(keyword);
    if (isRemoving) {
      enqueueSnackbar(t('research.keywords.clipboardCleared'), { variant: 'info' });
    } else {
      enqueueSnackbar(t('research.keywords.copied', { count: 1 }), { variant: 'success' });
    }
  };

  const handleClearSelection = () => {
    collectedKeywords.forEach((kw) => dispatch(removeKeyword({ nicheId, value: kw })));
    navigator.clipboard.writeText('');
    enqueueSnackbar(t('research.keywords.clipboardCleared'), { variant: 'info' });
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleResearch = (_keyword: string) => {
    enqueueSnackbar(t('research.keywords.comingSoon'), { variant: 'info' });
  };

  const researchTooltip = t('research.keywords.comingSoon');

  const chipGroupProps = {
    selectedKeywords,
    onToggle: handleToggle,
    onResearch: handleResearch,
    researchTooltip,
  };

  return (
    <Card>
      <Typography variant="h5" fontWeight={600} sx={{ mb: 2.5 }}>
        {t('research.keywords.title')}
      </Typography>

      <Stack spacing={2}>
        {keywords.top_focus_keywords.length > 0 && (
          <Box>
            <SectionLabel>{t('research.keywords.focus')}</SectionLabel>
            <ChipGroup chips={keywords.top_focus_keywords} color="primary" {...chipGroupProps} />
          </Box>
        )}

        {keywords.main_short_tail.length > 0 && (
          <Box>
            <SectionLabel>{t('research.keywords.shortTail')}</SectionLabel>
            <ChipGroup chips={keywords.main_short_tail} color="secondary" {...chipGroupProps} />
          </Box>
        )}

        {keywords.main_long_tail.length > 0 && (
          <Box>
            <SectionLabel>{t('research.keywords.longTail')}</SectionLabel>
            <ChipGroup chips={keywords.main_long_tail} color="info" {...chipGroupProps} />
          </Box>
        )}

        {keywords.top_long_tail_keywords.length > 0 && (
          <Box>
            <SectionLabel>{t('research.keywords.longTailTop')}</SectionLabel>
            <ChipGroup
              chips={keywords.top_long_tail_keywords}
              color="success"
              {...chipGroupProps}
            />
          </Box>
        )}

        {keywords.all_keywords_flat && (
          <Box>
            <SectionLabel>{t('research.keywords.allFlat')}</SectionLabel>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
              {keywords.all_keywords_flat}
            </Typography>
          </Box>
        )}
      </Stack>

      {selectedKeywords.size > 0 && (
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary">
            {t('research.keywords.clipboardCount', { count: selectedKeywords.size })}
          </Typography>
          <Button size="small" variant="text" onClick={handleClearSelection} sx={{ fontSize: 12 }}>
            {t('research.keywords.clearSelection')}
          </Button>
        </Stack>
      )}
    </Card>
  );
};

export { KeywordChips };
