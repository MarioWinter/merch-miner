import { Box, Typography } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import WorkspacePremiumOutlinedIcon from '@mui/icons-material/WorkspacePremiumOutlined';
import { COLORS, DURATION, EASING } from '@/style/constants';

interface CommandActionProps {
  icon: React.ReactNode;
  label: string;
  highlightRanges?: [number, number][];
  isActive?: boolean;
  disabled?: boolean;
  isPro?: boolean;
  onClick: () => void;
}

const ActionRow = styled(Box, {
  shouldForwardProp: (p) => p !== 'isActive' && p !== 'disabled',
})<{ isActive?: boolean; disabled?: boolean }>(({ theme, isActive, disabled }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  padding: theme.spacing(0.875, 1.5),
  borderRadius: Number(theme.shape.borderRadius) * 0.75,
  cursor: disabled ? 'default' : 'pointer',
  opacity: disabled ? 0.4 : 1,
  pointerEvents: disabled ? 'none' : 'auto',
  transition: `all ${DURATION.fast}ms ${EASING.standard}`,
  ...(isActive
    ? {
        backgroundColor: alpha(COLORS.cyan, 0.1),
        border: `1px solid ${alpha(COLORS.cyan, 0.2)}`,
        color: COLORS.cyan,
        '& .cmd-icon': { color: COLORS.cyan },
        '& .cmd-label': { color: COLORS.cyan },
      }
    : {
        border: '1px solid transparent',
        '&:hover': {
          backgroundColor: alpha(COLORS.white, 0.06),
        },
      }),
}));

const CommandAction = ({
  icon,
  label,
  highlightRanges,
  isActive,
  disabled,
  isPro,
  onClick,
}: CommandActionProps) => {
  // Render label with highlighted ranges
  const renderLabel = () => {
    if (!highlightRanges || highlightRanges.length === 0) {
      return label;
    }

    const parts: React.ReactNode[] = [];
    let lastIdx = 0;

    highlightRanges.forEach(([start, end], i) => {
      if (start > lastIdx) {
        parts.push(label.slice(lastIdx, start));
      }
      parts.push(
        <Box
          key={i}
          component="span"
          sx={{ color: COLORS.cyan, fontWeight: 600 }}
        >
          {label.slice(start, end)}
        </Box>,
      );
      lastIdx = end;
    });

    if (lastIdx < label.length) {
      parts.push(label.slice(lastIdx));
    }

    return parts;
  };

  return (
    <ActionRow
      isActive={isActive}
      disabled={disabled}
      onClick={onClick}
      role="option"
      aria-selected={isActive}
      aria-disabled={disabled}
    >
      <Box className="cmd-icon" sx={{ display: 'flex', color: 'text.secondary', fontSize: 18 }}>
        {icon}
      </Box>
      <Typography className="cmd-label" variant="body2" sx={{ flex: 1 }}>
        {renderLabel()}
      </Typography>
      {isPro && (
        <WorkspacePremiumOutlinedIcon sx={{ fontSize: 14, color: COLORS.warningDk }} />
      )}
    </ActionRow>
  );
};

export default CommandAction;
