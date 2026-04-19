import { useCallback } from 'react';
import { Box, Stack, Tooltip, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import OptionsButton from './OptionsButton';

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const HeaderRoot = styled(Stack)(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.spacing(1),
  paddingBlock: theme.spacing(0.75),
  marginBottom: theme.spacing(1),
  minHeight: 32,
}));

const TitleGroup = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.75),
  minWidth: 0,
}));

const TitleText = styled(Typography)(({ theme }) => ({
  color: theme.vars.palette.text.primary,
  lineHeight: 1.2,
}));

const CountText = styled(Typography)(({ theme }) => ({
  color: theme.vars.palette.text.disabled,
  marginLeft: theme.spacing(0.25),
}));

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SectionHeaderProps {
  title: string;
  infoTooltip?: string;
  context?: string;
  onOptionsClick?: (context: string) => void;
  count?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const SectionHeader = ({
  title,
  infoTooltip,
  context,
  onOptionsClick,
  count,
}: SectionHeaderProps) => {
  const handleOptionsClick = useCallback(() => {
    if (context && onOptionsClick) {
      onOptionsClick(context);
    }
  }, [context, onOptionsClick]);

  const showOptions = Boolean(context && onOptionsClick);

  return (
    <HeaderRoot component="header" aria-label={title}>
      <TitleGroup>
        <TitleText variant="subtitle2" component="h3">
          {title}
        </TitleText>
        {typeof count === 'number' && (
          <CountText variant="subtitle2" component="span">
            ({count})
          </CountText>
        )}
        {infoTooltip && (
          <Tooltip title={infoTooltip} arrow placement="top">
            <InfoOutlinedIcon
              sx={{ fontSize: 14, color: 'text.disabled', cursor: 'help' }}
              aria-label={infoTooltip}
            />
          </Tooltip>
        )}
      </TitleGroup>

      {showOptions && (
        <OptionsButton
          onClick={handleOptionsClick}
          ariaLabel={`${title} options`}
        />
      )}
    </HeaderRoot>
  );
};

export default SectionHeader;
