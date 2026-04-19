import { useCallback, useState } from 'react';
import {
  Box,
  Button,
  FormControl,
  FormControlLabel,
  Grid,
  Radio,
  RadioGroup,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import GppMaybeOutlinedIcon from '@mui/icons-material/GppMaybeOutlined';
import { Controller, type Control } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { COLORS } from '@/style/constants';
import type { MbaListingFormValues } from '../../schemas/mbaListingSchema';
import SectionHeader from './SectionHeader';
import TMCheckDialog from './TMCheckDialog';

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const TabsRoot = styled(Tabs)({
  minHeight: 40,
  '& .MuiTabs-indicator': {
    backgroundColor: COLORS.red,
    height: 2,
  },
  '& .MuiTab-root': {
    minHeight: 40,
    textTransform: 'none',
    fontSize: 14,
    fontWeight: 500,
  },
  '& .Mui-selected': {
    color: COLORS.red,
  },
});

const PanelBody = styled(Box)(({ theme }) => ({
  paddingBlock: theme.spacing(2),
}));

const TmButton = styled(Button)(({ theme }) => ({
  borderColor: alpha(COLORS.warningDk, 0.4),
  color: COLORS.warningDk,
  '&:hover': {
    backgroundColor: alpha(COLORS.warningDk, 0.08),
    borderColor: COLORS.warningDk,
  },
  alignSelf: 'flex-start',
  paddingInline: theme.spacing(2),
}));

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface OptionsTrademarksTabsProps {
  control: Control<MbaListingFormValues>;
  listingId?: string;
  onOptionsClick?: (context: string) => void;
}

type ActiveTab = 'options' | 'trademarks';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const OptionsTrademarksTabs = ({
  control,
  listingId,
  onOptionsClick,
}: OptionsTrademarksTabsProps) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ActiveTab>('options');
  const [tmOpen, setTmOpen] = useState(false);

  const handleTabChange = useCallback(
    (_: React.SyntheticEvent, value: ActiveTab) => {
      setActiveTab(value);
    },
    [],
  );

  return (
    <Box component="section">
      <TabsRoot
        value={activeTab}
        onChange={handleTabChange}
        aria-label={t('publish.edit.options.tabsLabel', {
          defaultValue: 'Listing options and trademarks',
        })}
      >
        <Tab
          value="options"
          label={t('publish.edit.options.tab', { defaultValue: 'Options' })}
        />
        <Tab
          value="trademarks"
          label={t('publish.edit.trademarks.tab', {
            defaultValue: 'Trademarks',
          })}
        />
      </TabsRoot>

      {activeTab === 'options' && (
        <PanelBody
          role="tabpanel"
          aria-label={t('publish.edit.options.tab', { defaultValue: 'Options' })}
        >
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <SectionHeader
                title={t('publish.edit.options.availability.title', {
                  defaultValue: 'Availability',
                })}
                context="availability"
                onOptionsClick={onOptionsClick}
              />
              <Controller
                control={control}
                name="availability"
                render={({ field }) => (
                  <FormControl component="fieldset">
                    <RadioGroup
                      {...field}
                      aria-label={t('publish.edit.options.availability.title', {
                        defaultValue: 'Availability',
                      })}
                    >
                      <FormControlLabel
                        value="public"
                        control={<Radio color="primary" />}
                        label={t('publish.edit.options.availability.public', {
                          defaultValue: 'Public',
                        })}
                      />
                      <FormControlLabel
                        value="private"
                        control={<Radio color="primary" />}
                        label={t('publish.edit.options.availability.private', {
                          defaultValue: 'Private',
                        })}
                      />
                    </RadioGroup>
                  </FormControl>
                )}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <SectionHeader
                title={t('publish.edit.options.publishMode.title', {
                  defaultValue: 'Publish',
                })}
                context="publish_mode"
                onOptionsClick={onOptionsClick}
              />
              <Controller
                control={control}
                name="publish_mode"
                render={({ field }) => (
                  <FormControl component="fieldset">
                    <RadioGroup
                      {...field}
                      aria-label={t('publish.edit.options.publishMode.title', {
                        defaultValue: 'Publish',
                      })}
                    >
                      <FormControlLabel
                        value="live"
                        control={<Radio color="primary" />}
                        label={t('publish.edit.options.publishMode.live', {
                          defaultValue: 'Live',
                        })}
                      />
                      <FormControlLabel
                        value="draft"
                        control={<Radio color="primary" />}
                        label={t('publish.edit.options.publishMode.draft', {
                          defaultValue: 'Draft',
                        })}
                      />
                    </RadioGroup>
                  </FormControl>
                )}
              />
            </Grid>
          </Grid>
        </PanelBody>
      )}

      {activeTab === 'trademarks' && (
        <PanelBody
          role="tabpanel"
          aria-label={t('publish.edit.trademarks.tab', {
            defaultValue: 'Trademarks',
          })}
        >
          <Stack gap={1.5}>
            <Typography variant="body2" color="text.secondary">
              {t('publish.edit.trademarks.hint', {
                defaultValue:
                  'Run a trademark check against your listing content before publishing.',
              })}
            </Typography>
            <TmButton
              variant="outlined"
              startIcon={<GppMaybeOutlinedIcon />}
              onClick={() => setTmOpen(true)}
              disabled={!listingId}
            >
              {t('publish.edit.trademarks.runCheck', {
                defaultValue: 'Run TM Check',
              })}
            </TmButton>
            {!listingId && (
              <Typography variant="caption" color="text.disabled">
                {t('publish.edit.trademarks.noListing', {
                  defaultValue: 'Save the listing first to run a trademark check.',
                })}
              </Typography>
            )}
          </Stack>
        </PanelBody>
      )}

      <TMCheckDialog
        open={tmOpen}
        onClose={() => setTmOpen(false)}
        listingId={listingId}
      />
    </Box>
  );
};

export default OptionsTrademarksTabs;
