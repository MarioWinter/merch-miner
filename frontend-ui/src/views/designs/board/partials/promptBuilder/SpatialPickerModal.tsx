// PROJ-34 Phase 13f.1 — modal picker for spatial layouts (Appendix Q.1).
// Tabs: Built-in (36) · Custom (n) · Create new. Single-select; commit on
// footer button. ESC closes without commit. The "Create new" tab body is a
// placeholder until 13f part B wires `<CustomSpatialCreator />`.

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
  useMediaQuery,
} from '@mui/material';
import { styled, useTheme } from '@mui/material/styles';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { SPATIAL_OPTIONS, type SpatialOption } from '../../constants/slotOptions';
import {
  useListCustomSpatialsQuery,
  type CustomSpatial,
} from '@/store/designSlice';
import { BuiltinGrid, CustomGrid } from './SpatialPickerModal.grids';
import CustomSpatialCreator from './CustomSpatialCreator';

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

interface SpatialPickerModalProps {
  open: boolean;
  onClose: () => void;
  /** Current committed value (built-in id, custom UUID, or raw text). */
  value: string | undefined;
  /** Fired on "Use selection". */
  onChange: (id: string) => void;
  workspaceId?: string;
  projectId?: string;
}

type TabKey = 'builtin' | 'custom' | 'create';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const SpatialPickerModal = ({
  open,
  onClose,
  value,
  onChange,
  workspaceId,
  projectId,
}: SpatialPickerModalProps) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [tab, setTab] = useState<TabKey>('builtin');
  const [search, setSearch] = useState('');
  const [localSelectedId, setLocalSelectedId] = useState<string | undefined>(value);

  // Reset transient state every time the modal transitions from closed→open
  // so it always reflects the parent's current value. Uses the
  // "store the previous prop in state + reset during render" pattern
  // recommended by React 19 — avoids both useEffect+setState and ref-mutation
  // lint rules.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setLocalSelectedId(value);
      setSearch('');
      setTab('builtin');
    }
  }

  const { data: customs = [], isLoading: customsLoading } = useListCustomSpatialsQuery(
    undefined,
    { skip: !open },
  );

  const filteredBuiltins = useMemo<readonly SpatialOption[]>(() => {
    const q = search.trim().toLowerCase();
    if (!q) return SPATIAL_OPTIONS;
    return SPATIAL_OPTIONS.filter(
      (entry) =>
        entry.ui_label.toLowerCase().includes(q) ||
        entry.ui_description.toLowerCase().includes(q),
    );
  }, [search]);

  const filteredCustoms = useMemo<CustomSpatial[]>(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customs;
    return customs.filter(
      (entry) =>
        entry.name.toLowerCase().includes(q) ||
        entry.prompt_text.toLowerCase().includes(q),
    );
  }, [customs, search]);

  const commitDisabled = !localSelectedId || localSelectedId === value;
  const handleCommit = () => {
    if (localSelectedId) {
      onChange(localSelectedId);
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isMobile}
      maxWidth="lg"
      fullWidth
      aria-labelledby="spatial-picker-title"
    >
      <DialogTitle
        id="spatial-picker-title"
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        Choose spatial layout
        <IconButton
          edge="end"
          onClick={onClose}
          aria-label="Close picker"
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
            placeholder={`Search ${SPATIAL_OPTIONS.length} layouts…`}
            size="small"
            fullWidth
            slotProps={{
              input: {
                startAdornment: (
                  <SearchRoundedIcon
                    sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }}
                  />
                ),
                inputProps: { 'aria-label': 'Search spatial layouts' },
              },
            }}
          />
          <Tabs
            value={tab}
            onChange={(_, v: TabKey) => setTab(v)}
            sx={{ mt: 1 }}
            aria-label="Spatial layout source tabs"
          >
            <Tab
              value="builtin"
              label={`Built-in (${SPATIAL_OPTIONS.length})`}
            />
            <Tab value="custom" label={`Custom (${customs.length})`} />
            <Tab value="create" label="Create new" />
          </Tabs>
        </StickyHeader>

        <Box sx={{ p: 3 }}>
          {tab === 'builtin' && (
            <BuiltinGrid
              entries={filteredBuiltins}
              selectedId={localSelectedId}
              onSelect={setLocalSelectedId}
            />
          )}
          {tab === 'custom' && (
            <CustomGrid
              entries={filteredCustoms}
              loading={customsLoading}
              selectedId={localSelectedId}
              onSelect={setLocalSelectedId}
              onCreateNew={() => setTab('create')}
            />
          )}
          {tab === 'create' && (
            <CustomSpatialCreator
              workspaceId={workspaceId}
              projectId={projectId}
              onCreated={(newId) => {
                setLocalSelectedId(newId);
                setTab('custom');
              }}
              onCancel={() => setTab('builtin')}
            />
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={commitDisabled}
          onClick={handleCommit}
        >
          Use selection
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SpatialPickerModal;
