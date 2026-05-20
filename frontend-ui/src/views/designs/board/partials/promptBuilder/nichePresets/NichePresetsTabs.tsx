// PROJ-34 Phase 13t-i — 3-tab control inside "Aus der Niche" Accordion.
// Order is fixed per AC-81: Vorschläge / History / Custom. Each Tab label
// carries a count Badge (`N/13`, `N/50`, `N`).
//
// Phase 13t-l — owns the active-card state + mounts NichePresetConfirmDialog.
// Card clicks bubble up from the 4 grids via the `onCardClick` prop; the
// dialog fires `confirmPreset` then forwards the 7 resolved slot values to
// the host via `onApplyPreset`.

import { useState, type SyntheticEvent } from 'react';
import { Alert, Badge, Box, Stack, Tab, Tabs } from '@mui/material';
import { skipToken } from '@reduxjs/toolkit/query';
import { useTranslation } from 'react-i18next';
import {
  useGetCustomQuery,
  useGetHistoryQuery,
  useGetVorschlaegeQuery,
} from '@/services/presetCardsApi';
import TopCardsGrid from './TopCardsGrid';
import BestOfMixRow from './BestOfMixRow';
import HistoryGrid from './HistoryGrid';
import CustomGrid from './CustomGrid';
import NichePresetConfirmDialog, {
  type AnyPresetCard,
  type ResolvedSlots,
} from './NichePresetConfirmDialog';

type TabKey = 'vorschlaege' | 'history' | 'custom';

interface NichePresetsTabsProps {
  nicheId: string | null;
  onApplyPreset?: (slots: ResolvedSlots) => void;
}

const NichePresetsTabs = ({ nicheId, onApplyPreset }: NichePresetsTabsProps) => {
  const { t } = useTranslation();
  const [active, setActive] = useState<TabKey>('vorschlaege');
  const [activeCard, setActiveCard] = useState<AnyPresetCard | null>(null);

  const vorschlaegeQ = useGetVorschlaegeQuery(nicheId ? { nicheId } : skipToken);
  const historyQ = useGetHistoryQuery();
  const customQ = useGetCustomQuery();

  const vorschlaegeCount =
    (vorschlaegeQ.data?.top.length ?? 0) +
    (vorschlaegeQ.data?.best_of_mix.most_common ? 1 : 0) +
    (vorschlaegeQ.data?.best_of_mix.edgy ? 1 : 0) +
    (vorschlaegeQ.data?.best_of_mix.safe ? 1 : 0);
  const historyCount = historyQ.data?.length ?? 0;
  const customCount = customQ.data?.length ?? 0;

  const handleChange = (_e: SyntheticEvent, value: TabKey) => setActive(value);

  const handleCardClick = (card: AnyPresetCard) => setActiveCard(card);

  const handleConfirmed = (slots: ResolvedSlots) => {
    onApplyPreset?.(slots);
  };

  return (
    <Box>
      <Tabs
        value={active}
        onChange={handleChange}
        aria-label={t('designForge.builder.nichePresets.title')}
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
      >
        <Tab
          value="vorschlaege"
          label={
            <Badge
              badgeContent={`${vorschlaegeCount}/13`}
              color="primary"
              sx={{ '& .MuiBadge-badge': { position: 'static', transform: 'none', ml: 1 } }}
            >
              <Box component="span">
                {t('designForge.builder.nichePresets.tabs.vorschlaege')}
              </Box>
            </Badge>
          }
        />
        <Tab
          value="history"
          label={
            <Badge
              badgeContent={`${historyCount}/50`}
              color="primary"
              sx={{ '& .MuiBadge-badge': { position: 'static', transform: 'none', ml: 1 } }}
            >
              <Box component="span">
                {t('designForge.builder.nichePresets.tabs.history')}
              </Box>
            </Badge>
          }
        />
        <Tab
          value="custom"
          label={
            <Badge
              badgeContent={customCount}
              color="primary"
              sx={{ '& .MuiBadge-badge': { position: 'static', transform: 'none', ml: 1 } }}
            >
              <Box component="span">
                {t('designForge.builder.nichePresets.tabs.custom')}
              </Box>
            </Badge>
          }
        />
      </Tabs>

      {active === 'vorschlaege' &&
        (nicheId ? (
          <Stack spacing={3}>
            <TopCardsGrid nicheId={nicheId} onCardClick={handleCardClick} />
            <BestOfMixRow nicheId={nicheId} onCardClick={handleCardClick} />
          </Stack>
        ) : (
          <Alert severity="info">
            {t('designForge.builder.nichePresets.tabs.placeholderNoNiche')}
          </Alert>
        ))}
      {active === 'history' && <HistoryGrid onCardClick={handleCardClick} />}
      {active === 'custom' && <CustomGrid onCardClick={handleCardClick} />}

      <NichePresetConfirmDialog
        open={activeCard !== null}
        card={activeCard}
        onClose={() => setActiveCard(null)}
        onConfirmed={handleConfirmed}
      />
    </Box>
  );
};

export default NichePresetsTabs;
