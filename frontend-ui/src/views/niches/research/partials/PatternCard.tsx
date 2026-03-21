import { useState } from 'react';
import { Box, Collapse, IconButton, Typography } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { PatternItem } from '../types';
import { getPatternVisual } from './patternConfig';

interface PatternCardProps {
  pattern: PatternItem;
  count?: number;
  onClick?: () => void;
}

const CardBase = styled(Box)({
  borderRadius: 12,
  position: 'relative',
  overflow: 'hidden',
  transition: 'box-shadow 200ms ease, transform 150ms ease',
});

export const PatternCard = ({ pattern, count, onClick }: PatternCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const visual = getPatternVisual(pattern.name);
  const Icon = visual.icon;
  const color = visual.color;

  if (pattern.present) {
    return (
      <CardBase
        onClick={onClick}
        sx={{
          background: alpha(color, 0.06),
          border: `1px solid ${alpha(color, 0.22)}`,
          borderLeft: `3px solid ${alpha(color, 0.5)}`,
          p: '14px 18px',
          cursor: onClick ? 'pointer' : 'default',
          '&:hover': {
            boxShadow: `0 4px 20px ${alpha(color, 0.12)}`,
            transform: 'translateY(-1px)',
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Box
            sx={{
              width: 28,
              height: 28,
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: alpha(color, 0.14),
              flexShrink: 0,
            }}
          >
            <Icon sx={{ fontSize: 17, color }} />
          </Box>
          <Typography
            variant="subtitle2"
            fontWeight={600}
            sx={{ letterSpacing: '0.02em', flex: 1 }}
          >
            {visual.label}
          </Typography>
          {count != null && count > 0 && (
            <Typography
              variant="caption"
              fontWeight={600}
              sx={{
                backgroundColor: alpha(color, 0.14),
                color,
                borderRadius: '6px',
                px: 1,
                py: 0.25,
                fontSize: '0.6875rem',
                lineHeight: 1.4,
              }}
            >
              {count}
            </Typography>
          )}
        </Box>
        <Typography
          variant="body2"
          sx={{ color: 'text.secondary', lineHeight: 1.55, pl: '36px' }}
        >
          {pattern.context}
        </Typography>
      </CardBase>
    );
  }

  // Inactive card
  return (
    <CardBase
      onClick={() => setExpanded((prev) => !prev)}
      sx={{
        background: 'transparent',
        border: '1px solid rgba(255,255,255,0.06)',
        borderLeft: '3px solid rgba(255,255,255,0.04)',
        opacity: 0.5,
        cursor: 'pointer',
        p: '10px 18px',
        '&:hover': { opacity: 0.7 },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: alpha(color, 0.06),
            flexShrink: 0,
          }}
        >
          <Icon sx={{ fontSize: 17, color: alpha(color, 0.35) }} />
        </Box>
        <Typography
          variant="body2"
          sx={{ flex: 1, color: 'text.disabled', letterSpacing: '0.01em' }}
        >
          {visual.label}
        </Typography>
        <IconButton
          size="small"
          tabIndex={-1}
          sx={{
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 150ms ease',
          }}
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          <ExpandMoreIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>
      <Collapse in={expanded}>
        <Typography
          variant="caption"
          sx={{ mt: 1, display: 'block', color: 'text.disabled', pl: '36px' }}
        >
          {pattern.context || 'Not detected in this niche.'}
        </Typography>
      </Collapse>
    </CardBase>
  );
};
