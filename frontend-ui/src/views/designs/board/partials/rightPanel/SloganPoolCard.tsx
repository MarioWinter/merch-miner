import { useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Checkbox,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useTranslation } from 'react-i18next';
import { COLORS } from '@/style/constants';
import type { ProjectIdea } from '@/views/designs/gallery/types';

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const CardRoot = styled(Box)(({ theme }) => ({
  border: `1px solid ${theme.vars.palette.divider}`,
  borderRadius: 8,
  padding: theme.spacing(1),
  '&:hover': {
    borderColor: alpha(COLORS.red, 0.3),
  },
}));


// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface SloganPoolCardProps {
  idea: ProjectIdea;
  isSelected: boolean;
  onToggleSelect: () => void;
  onAutoPrompt: () => void;
  onRemove: () => void;
  isAutoPrompting?: boolean;
  isGenerating?: boolean;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const SloganPoolCard = ({
  idea,
  isSelected,
  onToggleSelect,
  onAutoPrompt,
  onRemove,
  isAutoPrompting,
  isGenerating,
}: SloganPoolCardProps) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  return (
    <CardRoot>
      <Stack direction="row" alignItems="flex-start" spacing={0.5}>
        <Checkbox
          size="small"
          checked={isSelected}
          onChange={onToggleSelect}
          sx={{ p: 0.25, mt: 0.25 }}
          aria-label={t('design.sloganPool.selectSlogan', 'Select slogan')}
        />

        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* Slogan text */}
          <Tooltip title={idea.slogan_text} placement="top">
            <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
              {idea.slogan_text}
            </Typography>
          </Tooltip>

          {/* Badges row */}
          <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }} flexWrap="wrap" useFlexGap>
            {idea.signal_type && (
              <Chip
                label={idea.signal_type.toUpperCase()}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.6rem',
                  borderRadius: '4px',
                  backgroundColor: alpha(
                    idea.signal_type === 'self' ? COLORS.red : COLORS.cyan,
                    0.12,
                  ),
                  color: idea.signal_type === 'self' ? 'primary.main' : 'secondary.main',
                }}
              />
            )}
            {idea.market_confidence && (
              <Chip
                label={idea.market_confidence}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.6rem',
                  borderRadius: '4px',
                  backgroundColor: alpha(
                    idea.market_confidence === 'High'
                      ? COLORS.successDk
                      : idea.market_confidence === 'Medium'
                        ? COLORS.warningDk
                        : COLORS.snowMuted,
                    0.12,
                  ),
                  color:
                    idea.market_confidence === 'High'
                      ? 'success.main'
                      : idea.market_confidence === 'Medium'
                        ? 'warning.main'
                        : 'text.secondary',
                }}
              />
            )}
            {idea.niche_name && (
              <Chip
                label={idea.niche_name}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.6rem',
                  borderRadius: '4px',
                  backgroundColor: alpha(COLORS.cyan, 0.10),
                  color: 'secondary.main',
                }}
              />
            )}
          </Stack>

          {/* Expandable details */}
          {(idea.why_it_works || idea.emotional_archetype || idea.pattern_used) && (
            <Accordion
              expanded={expanded}
              onChange={() => setExpanded(!expanded)}
              disableGutters
              sx={{
                bgcolor: 'transparent',
                boxShadow: 'none',
                '&:before': { display: 'none' },
                mt: 0.5,
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon sx={{ fontSize: 14 }} />}
                sx={{ minHeight: 20, p: 0, '& .MuiAccordionSummary-content': { m: 0 } }}
              >
                <Typography variant="caption" color="text.secondary">
                  {t('design.sloganPool.details', 'Details')}
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 0, pt: 0.5 }}>
                {idea.why_it_works && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                    {idea.why_it_works}
                  </Typography>
                )}
                {idea.emotional_archetype && (
                  <Typography variant="caption" color="text.disabled">
                    {idea.emotional_archetype}
                  </Typography>
                )}
                {idea.pattern_used && (
                  <Typography variant="caption" color="text.disabled" sx={{ display: 'block' }}>
                    {idea.pattern_used}
                  </Typography>
                )}
              </AccordionDetails>
            </Accordion>
          )}
        </Box>

        {/* Actions column */}
        <Stack alignItems="center" spacing={0}>
          {isGenerating ? (
            <CircularProgress size={16} />
          ) : (
            <Tooltip title={t('design.sloganPool.autoPrompt', 'Auto-Prompt')}>
              <IconButton
                size="small"
                onClick={onAutoPrompt}
                disabled={isAutoPrompting}
                sx={{ p: 0.5 }}
                aria-label={t('design.sloganPool.autoPrompt', 'Auto-Prompt')}
              >
                {isAutoPrompting ? (
                  <CircularProgress size={14} />
                ) : (
                  <AutoAwesomeIcon sx={{ fontSize: 16 }} />
                )}
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title={t('design.sloganPool.remove', 'Remove')}>
            <IconButton
              size="small"
              onClick={onRemove}
              sx={{ p: 0.5, color: 'text.disabled' }}
              aria-label={t('design.sloganPool.remove', 'Remove')}
            >
              <CloseIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
    </CardRoot>
  );
};

export default SloganPoolCard;
