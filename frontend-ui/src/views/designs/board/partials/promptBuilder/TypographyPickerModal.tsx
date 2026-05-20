// PROJ-34 Phase 13m-b + 13t-m — modal picker for typography adjectives
// (single-select). Mirrors the SpatialPickerModal/StylePickerModal grammar
// with Built-in / Custom / Create new tabs. Selection semantics differ from
// StylePickerModal — typography is single-select, the chosen entry's
// `prompt_text` is sent to `onChange`. ESC closes without commit
// (Dialog default behavior + Cancel button).

import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tab,
  Tabs,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { styled, useTheme } from '@mui/material/styles';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import {
  TYPOGRAPHY_OPTIONS,
  type TypographyOption,
} from '../../constants/slotOptions';
import {
  useListCustomTypographiesQuery,
  useDeleteCustomTypographyMutation,
  type CustomTypography,
} from '@/services/customTypographyApi';
import { BuiltinGrid, CustomGrid } from './TypographyPickerModal.grids';
import CustomTypographyCreator from './CustomTypographyCreator';

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const StickyHeader = styled(Box)(({ theme }) => ({
  position: 'sticky',
  top: 0,
  zIndex: 1,
  backgroundColor: theme.vars.palette.background.paper,
  paddingBottom: theme.spacing(1),
  borderBottom: `1px solid ${theme.vars.palette.divider}`,
}));

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TypographyPickerModalProps {
  open: boolean;
  onClose: () => void;
  /** Current committed value — the chosen entry's `prompt_text`, or raw text. */
  value: string;
  /** Fired on "Use selection". */
  onChange: (newValue: string) => void;
  /** The style-resolved default `prompt_text`; used to render an auto-chip. */
  styleDefault?: string;
  /** Display label of the style currently driving the default. */
  styleLabel?: string;
  workspaceId?: string;
  projectId?: string;
}

type TabKey = 'builtin' | 'custom' | 'create';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const TypographyPickerModal = ({
  open,
  onClose,
  value,
  onChange,
  styleDefault,
  styleLabel,
  workspaceId,
  projectId,
}: TypographyPickerModalProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [tab, setTab] = useState<TabKey>('builtin');
  const [search, setSearch] = useState('');
  const [localValue, setLocalValue] = useState<string>(value);

  // Reset transient state on closed→open transition. See SpatialPickerModal
  // for rationale — React-19 "previous-prop in state" pattern.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setLocalValue(value);
      setSearch('');
      setTab('builtin');
    }
  }

  const { data: customs = [], isLoading: customsLoading } =
    useListCustomTypographiesQuery(undefined, { skip: !open });
  const [deleteCustom] = useDeleteCustomTypographyMutation();

  const filteredBuiltins = useMemo<TypographyOption[]>(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [...TYPOGRAPHY_OPTIONS];
    return TYPOGRAPHY_OPTIONS.filter((entry) =>
      entry.ui_label.toLowerCase().includes(q),
    );
  }, [search]);

  const filteredCustoms = useMemo<CustomTypography[]>(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customs;
    return customs.filter(
      (entry) =>
        entry.name.toLowerCase().includes(q) ||
        entry.prompt_text.toLowerCase().includes(q),
    );
  }, [customs, search]);

  const isDirty = localValue !== value;

  const handleCommit = () => {
    onChange(localValue);
    onClose();
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCustom({ id }).unwrap();
      enqueueSnackbar(
        t('designForge.builder.typography.deleteSuccess'),
        { variant: 'success' },
      );
    } catch {
      enqueueSnackbar(
        t('designForge.builder.typography.deleteError'),
        { variant: 'error' },
      );
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isMobile}
      maxWidth="lg"
      fullWidth
      aria-labelledby="typography-picker-title"
    >
      <DialogTitle
        id="typography-picker-title"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {t('designForge.builder.typography.title')}
        <IconButton
          edge="end"
          onClick={onClose}
          aria-label={t('designForge.builder.typography.closeAria')}
          size="small"
        >
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0 }}>
        <StickyHeader sx={{ px: 3, pt: 2 }}>
          <TextField
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('designForge.builder.typography.searchPlaceholder', {
              count: TYPOGRAPHY_OPTIONS.length,
            })}
            size="small"
            fullWidth
            slotProps={{
              input: {
                startAdornment: (
                  <SearchRoundedIcon
                    sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }}
                  />
                ),
                inputProps: {
                  'aria-label': t(
                    'designForge.builder.typography.searchAria',
                  ),
                },
              },
            }}
          />
          <Tabs
            value={tab}
            onChange={(_, v: TabKey) => setTab(v)}
            sx={{ mt: 1 }}
            aria-label={t('designForge.builder.typography.tabsAria')}
          >
            <Tab
              value="builtin"
              label={t('designForge.builder.typography.tabBuiltin', {
                count: TYPOGRAPHY_OPTIONS.length,
              })}
            />
            <Tab
              value="custom"
              label={t('designForge.builder.typography.tabCustom', {
                count: customs.length,
              })}
            />
            <Tab
              value="create"
              label={t('designForge.builder.typography.createNew.tab')}
            />
          </Tabs>
        </StickyHeader>

        <Box sx={{ p: 3 }}>
          {tab === 'builtin' &&
            (filteredBuiltins.length === 0 ? (
              <Box sx={{ py: 6, textAlign: 'center' }}>
                <Typography color="text.secondary">
                  {t('designForge.builder.typography.emptySearch')}
                </Typography>
              </Box>
            ) : (
              <BuiltinGrid
                entries={filteredBuiltins}
                selectedValue={localValue}
                styleDefault={styleDefault}
                styleLabel={styleLabel}
                onSelect={setLocalValue}
              />
            ))}
          {tab === 'custom' && (
            <CustomGrid
              entries={filteredCustoms}
              loading={customsLoading}
              selectedValue={localValue}
              onSelect={setLocalValue}
              onCreateNew={() => setTab('create')}
              onDelete={handleDelete}
            />
          )}
          {tab === 'create' && (
            <CustomTypographyCreator
              workspaceId={workspaceId}
              projectId={projectId}
              onCreated={(newPromptText) => {
                setLocalValue(newPromptText);
                setTab('custom');
              }}
              onCancel={() => setTab('builtin')}
            />
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          {t('designForge.builder.typography.cancel')}
        </Button>
        <Button variant="contained" disabled={!isDirty} onClick={handleCommit}>
          {t('designForge.builder.typography.useSelection')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TypographyPickerModal;
