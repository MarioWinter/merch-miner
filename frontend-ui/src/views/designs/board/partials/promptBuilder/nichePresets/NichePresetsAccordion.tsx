// PROJ-34 Phase 13t-i — "Aus der Niche" Accordion shell. Renders title +
// expand chevron and hosts the 3-tab control (`Vorschläge` / `History` /
// `Custom`). Default-expanded per AC-80. Tab content is placeholder until
// Phases 13t-j and 13t-k land the real grids.

import { Accordion, AccordionDetails, AccordionSummary, Typography } from '@mui/material';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import { useTranslation } from 'react-i18next';
import NichePresetsTabs from './NichePresetsTabs';

interface NichePresetsAccordionProps {
  /** Project's linked niche id, or null when project has no niche. */
  nicheId: string | null;
}

const NichePresetsAccordion = ({ nicheId }: NichePresetsAccordionProps) => {
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
        <NichePresetsTabs nicheId={nicheId} />
      </AccordionDetails>
    </Accordion>
  );
};

export default NichePresetsAccordion;
