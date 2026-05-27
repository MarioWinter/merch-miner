// PROJ-34 Phase 8 — "Include niche style context" switch with reason-aware tooltip.
// EC-16: no research data → "No niche research data yet — run PROJ-6 first"
// EC-23: project not linked to a niche → "Project not linked to a niche"

import { FormControlLabel, Switch, Tooltip } from '@mui/material';
import { styled } from '@mui/material/styles';
import type { NicheContextReason } from '../../types/builder';

interface NicheContextToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  reason: NicheContextReason;
}

const Label = styled('span')(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.vars.palette.text.primary,
}));

const REASON_COPY: Record<NonNullable<NicheContextReason['reasonKey']>, string> = {
  noNiche: 'Project not linked to a niche',
  noResearch: 'No niche research data yet — run PROJ-6 first',
};

const NicheContextToggle = ({ checked, onChange, reason }: NicheContextToggleProps) => {
  const tooltip = reason.disabled && reason.reasonKey ? REASON_COPY[reason.reasonKey] : '';

  const control = (
    <FormControlLabel
      control={
        <Switch
          checked={checked && !reason.disabled}
          onChange={(_, next) => onChange(next)}
          disabled={reason.disabled}
          color="secondary"
        />
      }
      label={<Label>Include niche style context</Label>}
      sx={{
        mr: 0,
        opacity: reason.disabled ? 0.5 : 1,
      }}
    />
  );

  // MUI Tooltip on disabled Switch needs a wrapper to forward events; FCL provides one.
  return tooltip ? (
    <Tooltip title={tooltip} arrow placement="top">
      <span>{control}</span>
    </Tooltip>
  ) : (
    control
  );
};

export default NicheContextToggle;
