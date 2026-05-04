import { useCallback } from 'react';
import { Box, Tooltip } from '@mui/material';
import { styled } from '@mui/material/styles';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import OptionsButton from './OptionsButton';

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

// styled('header') keeps the semantic tag without going through Stack's
// `component` prop (which is no longer surfaced once styled() wraps it
// in MUI v7's stricter typing).
const HeaderRoot = styled('header')(({ theme }) => ({
  display: 'flex',
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

// Use styled('h3'/'span') directly so the semantic HTML tag is built into
// the styled component — avoids fighting MUI v7's stricter Typography typing
// where `component` prop overrides aren't surfaced through styled() wrappers.
const TitleText = styled('h3')(({ theme }) => ({
  ...theme.typography.subtitle2,
  margin: 0,
  color: theme.vars.palette.text.primary,
  lineHeight: 1.2,
}));

const CountText = styled('span')(({ theme }) => ({
  ...theme.typography.subtitle2,
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
    <HeaderRoot aria-label={title}>
      <TitleGroup>
        <TitleText>{title}</TitleText>
        {typeof count === 'number' && (
          <CountText>({count})</CountText>
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
