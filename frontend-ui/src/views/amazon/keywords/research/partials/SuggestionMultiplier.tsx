import { useState, useCallback } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  IconButton,
  Stack,
  Tooltip,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import TuneIcon from '@mui/icons-material/Tune';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import { useTranslation } from 'react-i18next';
import { SectionCard } from '@/components/SectionCard';
import { SectionLabel } from '@/components/SectionLabel';
import { EASING, DURATION } from '@/style/constants';
import {
  DEFAULT_PREFIXES,
  DEFAULT_SUFFIXES,
  type ModifierSuggestion,
} from '../hooks/useModifierSuggestions';

const MAX_VISIBLE_SUGGESTIONS = 8;

interface SuggestionMultiplierProps {
  keyword: string;
  suggestions: ModifierSuggestion[];
  isGenerating: boolean;
  onGenerate: (prefixes: string[], suffixes: string[]) => void;
  onAddSuggestion: (keyword: string) => void;
}

export const SuggestionMultiplier = ({
  keyword,
  suggestions,
  isGenerating,
  onGenerate,
  onAddSuggestion,
}: SuggestionMultiplierProps) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const [activePrefixes, setActivePrefixes] = useState<Set<string>>(new Set());
  const [activeSuffixes, setActiveSuffixes] = useState<Set<string>>(new Set());

  const togglePrefix = useCallback((prefix: string) => {
    setActivePrefixes((prev) => {
      const next = new Set(prev);
      if (next.has(prefix)) next.delete(prefix);
      else next.add(prefix);
      return next;
    });
  }, []);

  const toggleSuffix = useCallback((suffix: string) => {
    setActiveSuffixes((prev) => {
      const next = new Set(prev);
      if (next.has(suffix)) next.delete(suffix);
      else next.add(suffix);
      return next;
    });
  }, []);

  const handleGenerate = useCallback(() => {
    onGenerate(Array.from(activePrefixes), Array.from(activeSuffixes));
  }, [activePrefixes, activeSuffixes, onGenerate]);

  const hasActiveModifiers = activePrefixes.size > 0 || activeSuffixes.size > 0;
  const visibleSuggestions = showAllSuggestions
    ? suggestions
    : suggestions.slice(0, MAX_VISIBLE_SUGGESTIONS);
  const hasMore = suggestions.length > MAX_VISIBLE_SUGGESTIONS;

  const headerCount = suggestions.length > 0 ? suggestions.length : undefined;

  return (
    <SectionCard>
      <Stack
        direction="row"
        alignItems="center"
        sx={{ cursor: 'pointer' }}
        onClick={() => setExpanded(!expanded)}
      >
        <SectionLabel
          icon={<TuneIcon />}
          label={t('keywords.multiplier.title')}
          count={headerCount}
          iconColor="secondary.main"
        />
        <IconButton size="small" sx={{ ml: 'auto' }}>
          {expanded ? (
            <ExpandLessIcon sx={{ fontSize: 18 }} />
          ) : (
            <ExpandMoreIcon sx={{ fontSize: 18 }} />
          )}
        </IconButton>
      </Stack>

      <Collapse in={expanded} timeout={DURATION.slow}>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          {/* Prefixes */}
          <Box>
            <Box
              component="span"
              sx={{
                fontSize: '0.75rem',
                fontWeight: 500,
                color: 'text.disabled',
                mb: 0.5,
                display: 'block',
              }}
            >
              {t('keywords.multiplier.prefixes')}
            </Box>
            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
              {DEFAULT_PREFIXES.map((prefix) => {
                const isActive = activePrefixes.has(prefix);
                return (
                  <Chip
                    key={prefix}
                    label={prefix}
                    size="small"
                    onClick={() => togglePrefix(prefix)}
                    sx={(theme) => ({
                      borderRadius: '8px',
                      height: 28,
                      fontWeight: 500,
                      fontSize: '0.8125rem',
                      cursor: 'pointer',
                      transition: `all ${DURATION.fast}ms ${EASING.standard}`,
                      backgroundColor: isActive
                        ? alpha(theme.palette.secondary.main, 0.15)
                        : alpha(theme.palette.secondary.main, 0.10),
                      color: isActive
                        ? theme.vars.palette.secondary.main
                        : theme.vars.palette.text.primary,
                      border: isActive
                        ? `1px solid ${alpha(theme.palette.secondary.main, 0.30)}`
                        : '1px solid transparent',
                      '&:hover': {
                        backgroundColor: alpha(theme.palette.secondary.main, 0.18),
                      },
                    })}
                  />
                );
              })}
            </Stack>
          </Box>

          <Divider />

          {/* Suffixes */}
          <Box>
            <Box
              component="span"
              sx={{
                fontSize: '0.75rem',
                fontWeight: 500,
                color: 'text.disabled',
                mb: 0.5,
                display: 'block',
              }}
            >
              {t('keywords.multiplier.suffixes')}
            </Box>
            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
              {DEFAULT_SUFFIXES.map((suffix) => {
                const isActive = activeSuffixes.has(suffix);
                return (
                  <Chip
                    key={suffix}
                    label={suffix}
                    size="small"
                    onClick={() => toggleSuffix(suffix)}
                    sx={(theme) => ({
                      borderRadius: '8px',
                      height: 28,
                      fontWeight: 500,
                      fontSize: '0.8125rem',
                      cursor: 'pointer',
                      transition: `all ${DURATION.fast}ms ${EASING.standard}`,
                      backgroundColor: isActive
                        ? alpha(theme.palette.secondary.main, 0.15)
                        : alpha(theme.palette.secondary.main, 0.10),
                      color: isActive
                        ? theme.vars.palette.secondary.main
                        : theme.vars.palette.text.primary,
                      border: isActive
                        ? `1px solid ${alpha(theme.palette.secondary.main, 0.30)}`
                        : '1px solid transparent',
                      '&:hover': {
                        backgroundColor: alpha(theme.palette.secondary.main, 0.18),
                      },
                    })}
                  />
                );
              })}
            </Stack>
          </Box>

          {/* Generate button */}
          <Button
            variant="contained"
            size="small"
            startIcon={
              isGenerating ? (
                <CircularProgress size={14} color="inherit" />
              ) : (
                <AutoAwesomeIcon sx={{ fontSize: 16 }} />
              )
            }
            onClick={handleGenerate}
            disabled={!hasActiveModifiers || !keyword || isGenerating}
            sx={{ alignSelf: 'flex-start' }}
          >
            {t('keywords.multiplier.generate')}
          </Button>

          {/* Generated suggestions */}
          {suggestions.length > 0 && (
            <Box>
              <Box
                component="span"
                sx={{
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  color: 'text.disabled',
                  mb: 0.75,
                  display: 'block',
                }}
              >
                {t('keywords.multiplier.generated', {
                  count: suggestions.length,
                })}
              </Box>
              <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
                {visibleSuggestions.map((s) => (
                  <Tooltip
                    key={s.keyword}
                    title={t('keywords.multiplier.addToResults')}
                  >
                    <Chip
                      label={s.keyword}
                      size="small"
                      icon={<AddCircleOutlineIcon sx={{ fontSize: 14 }} />}
                      onClick={() => onAddSuggestion(s.keyword)}
                      sx={(theme) => ({
                        borderRadius: '8px',
                        height: 28,
                        fontWeight: 500,
                        fontSize: '0.8125rem',
                        cursor: 'pointer',
                        backgroundColor: alpha(theme.palette.info.main, 0.08),
                        color: theme.vars.palette.text.primary,
                        transition: `all ${DURATION.fast}ms ${EASING.standard}`,
                        '&:hover': {
                          backgroundColor: alpha(theme.palette.info.main, 0.14),
                        },
                      })}
                    />
                  </Tooltip>
                ))}
                {hasMore && (
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => setShowAllSuggestions(!showAllSuggestions)}
                    sx={{
                      color: 'text.disabled',
                      fontSize: '0.75rem',
                      textTransform: 'none',
                    }}
                  >
                    {showAllSuggestions
                      ? t('keywords.chipCloud.showLess')
                      : t('keywords.chipCloud.showAll', {
                          count: suggestions.length - MAX_VISIBLE_SUGGESTIONS,
                        })}
                  </Button>
                )}
              </Stack>
            </Box>
          )}
        </Stack>
      </Collapse>
    </SectionCard>
  );
};
