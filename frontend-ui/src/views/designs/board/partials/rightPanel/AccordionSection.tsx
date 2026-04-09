import { useState } from 'react';
import { Accordion, AccordionDetails, AccordionSummary, Typography } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { COLORS } from '@/style/constants';

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const StyledAccordion = styled(Accordion)({
  backgroundColor: 'transparent',
  boxShadow: 'none',
  '&:before': { display: 'none' },
  '&.Mui-expanded': { margin: 0 },
});

const StyledSummary = styled(AccordionSummary)(({ theme }) => ({
  minHeight: 40,
  borderRadius: 6,
  padding: theme.spacing(0, 1),
  transition: 'background-color 150ms ease',
  '&:hover': {
    backgroundColor: alpha('#fff', 0.04),
  },
  '& .MuiAccordionSummary-content': {
    margin: '4px 0',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  '& .MuiAccordionSummary-expandIconWrapper': {
    color: theme.vars.palette.text.disabled,
  },
  ...theme.applyStyles('light', {
    '&:hover': {
      backgroundColor: alpha(COLORS.ink, 0.04),
    },
  }),
}));

const CountBadge = styled(Typography)(({ theme }) => ({
  fontSize: '0.6875rem',
  fontWeight: 600,
  lineHeight: 1.4,
  letterSpacing: '0.08em',
  color: theme.vars.palette.secondary.main,
  marginLeft: 'auto',
}));

const StyledDetails = styled(AccordionDetails)({
  padding: 0,
});

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface AccordionSectionProps {
  title: string;
  count?: number;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const AccordionSection = ({
  title,
  count,
  defaultExpanded = false,
  children,
}: AccordionSectionProps) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <StyledAccordion
      expanded={expanded}
      onChange={() => setExpanded((prev) => !prev)}
      disableGutters
    >
      <StyledSummary expandIcon={<ExpandMoreIcon sx={{ fontSize: 16 }} />}>
        <Typography variant="subtitle2" color="text.secondary">
          {title}
        </Typography>
        {count !== undefined && count > 0 && (
          <CountBadge variant="overline">{count}</CountBadge>
        )}
      </StyledSummary>
      <StyledDetails>{children}</StyledDetails>
    </StyledAccordion>
  );
};

export default AccordionSection;
