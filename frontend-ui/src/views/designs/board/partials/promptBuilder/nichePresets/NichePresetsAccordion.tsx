// PROJ-34 Phase 13t-i — "Aus der Niche" Accordion shell. Renders title +
// expand chevron and hosts the 3-tab control (`Vorschläge` / `History` /
// `Custom`). Default-expanded per AC-80.
//
// Phase 13t-l — forwards `onApplyPreset` from the host (BuilderDialog) so
// confirmed niche presets can replace the 7 form slots atomically.

import { Accordion, AccordionDetails, AccordionSummary, Typography } from '@mui/material';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import { useTranslation } from 'react-i18next';
import NichePresetsTabs from './NichePresetsTabs';
import type { ResolvedSlots } from './NichePresetConfirmDialog';

interface NichePresetsAccordionProps {
  /** Project's linked niche id, or null when project has no niche. */
  nicheId: string | null;
  /** Phase 13t-l — fires after the Confirm dialog persists the preset. */
  onApplyPreset?: (slots: ResolvedSlots) => void;
}

const NichePresetsAccordion = ({ nicheId, onApplyPreset }: NichePresetsAccordionProps) => {
  const { t } = useTranslation();
  return (
    <Accordion defaultExpanded>
      <AccordionSummary
        expandIcon={<ExpandMoreRoundedIcon />}
        aria-controls="builder-niche-presets-content"
        id="builder-niche-presets-header"
      >
        <Typography variant="subtitle1">
          {t('designForge.builder.nichePresets.title')}
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <NichePresetsTabs nicheId={nicheId} onApplyPreset={onApplyPreset} />
      </AccordionDetails>
    </Accordion>
  );
};

export default NichePresetsAccordion;
