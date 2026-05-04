import { useCallback } from 'react';
import { Box, Button, Stack, Tooltip, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SearchIcon from '@mui/icons-material/Search';
import { useSnackbar } from 'notistack';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { MetaKeyword } from '../../types';

interface KeywordsSectionProps {
  keywords: MetaKeyword[];
}

const SectionContainer = styled(Box)(({ theme }) => ({
  backgroundColor: theme.vars.palette.background.paper,
  border: `1px solid ${theme.vars.palette.divider}`,
  borderRadius: 12,
  padding: theme.spacing(2.5),
}));

const KeywordItem = styled(Box)({
  display: 'inline-flex',
  flexDirection: 'column',
  alignItems: 'center',
});

const KeywordChip = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'chipColor',
})<{ chipColor: string }>(({ theme, chipColor }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  borderRadius: 16,
  border: `1.5px solid ${chipColor}`,
  backgroundColor: 'transparent',
  padding: theme.spacing(0.5, 1.25),
  cursor: 'pointer',
  transition: 'all 150ms ease',
  '&:hover': {
    backgroundColor: chipColor,
    '& .keyword-text': { color: '#fff' },
    '& .keyword-icon': { color: 'rgba(255,255,255,0.8)' },
  },
}));

const KeywordCount = styled(Typography)(({ theme }) => ({
  fontSize: '0.7rem',
  color: theme.vars.palette.text.secondary,
  marginTop: 3,
  textAlign: 'center',
}));

const KeywordsSection = ({ keywords }: KeywordsSectionProps) => {
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const shortTail = keywords.filter((k) => k.type === 'short_tail');
  const longTail = keywords.filter((k) => k.type === 'long_tail');

  const handleCopyAll = useCallback(async () => {
    const text = keywords.map((k) => k.keyword).join(', ');
    try {
      await navigator.clipboard.writeText(text);
      enqueueSnackbar(
        t('amazonResearch.detail.keywordsCopied', { count: keywords.length }),
        { variant: 'success' },
      );
    } catch {
      enqueueSnackbar('Copy failed', { variant: 'error' });
    }
  }, [keywords, enqueueSnackbar, t]);

  const handleSearchKeyword = useCallback(
    (kw: string) => {
      navigate(`/amazon/research?keyword=${encodeURIComponent(kw)}`);
    },
    [navigate],
  );

  if (keywords.length === 0) {
    return (
      <SectionContainer>
        <Typography variant="h6" sx={{ mb: 1 }}>
          {t('amazonResearch.detail.keywords')}
        </Typography>
        <Typography variant="body2" color="text.disabled">
          {t('amazonResearch.detail.noKeywords')}
        </Typography>
      </SectionContainer>
    );
  }

  const renderChips = (
    items: MetaKeyword[],
    label: string,
    chipColor: string,
  ) => (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
        {label} ({items.length})
      </Typography>
      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
        {items
          .sort((a, b) => b.frequency - a.frequency)
          .map((kw) => (
            <KeywordItem key={kw.id}>
              <KeywordChip
                chipColor={chipColor}
                onClick={() => handleSearchKeyword(kw.keyword)}
              >
                <Typography
                  className="keyword-text"
                  sx={{ fontSize: '0.8rem', fontWeight: 500, color: chipColor }}
                >
                  {kw.keyword}
                </Typography>
                <Tooltip title={t('amazonResearch.detail.searchKeyword')}>
                  <SearchIcon className="keyword-icon" sx={{ fontSize: 14, color: chipColor, opacity: 0.6 }} />
                </Tooltip>
              </KeywordChip>
              {kw.frequency > 1 && (
                <KeywordCount>{kw.frequency}</KeywordCount>
              )}
            </KeywordItem>
          ))}
      </Stack>
    </Box>
  );

  return (
    <SectionContainer>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 2 }}
      >
        <Typography variant="h6">
          {t('amazonResearch.detail.keywords')}
        </Typography>
        <Button
          size="small"
          startIcon={<ContentCopyIcon sx={{ fontSize: 16 }} />}
          onClick={handleCopyAll}
          sx={{ textTransform: 'none' }}
        >
          {t('amazonResearch.detail.copyAllKeywords')}
        </Button>
      </Stack>

      {shortTail.length > 0 &&
        renderChips(
          shortTail,
          t('amazonResearch.detail.shortTail'),
          'var(--mui-palette-secondary-dark)',
        )}

      {longTail.length > 0 &&
        renderChips(
          longTail,
          t('amazonResearch.detail.longTail'),
          'var(--mui-palette-info-main)',
        )}
    </SectionContainer>
  );
};

export default KeywordsSection;
