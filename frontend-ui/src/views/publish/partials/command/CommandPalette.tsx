import { useCallback, useRef, useEffect, useMemo } from 'react';
import { Box, Dialog, InputBase, Typography, Fade } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DriveFileMoveOutlinedIcon from '@mui/icons-material/DriveFileMoveOutlined';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import SwapVertOutlinedIcon from '@mui/icons-material/SwapVertOutlined';
import SyncOutlinedIcon from '@mui/icons-material/SyncOutlined';
import TranslateOutlinedIcon from '@mui/icons-material/TranslateOutlined';
import LabelOutlinedIcon from '@mui/icons-material/LabelOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import CloudDownloadOutlinedIcon from '@mui/icons-material/CloudDownloadOutlined';
import DashboardCustomizeOutlinedIcon from '@mui/icons-material/DashboardCustomizeOutlined';
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import StraightenOutlinedIcon from '@mui/icons-material/StraightenOutlined';
import AttachMoneyOutlinedIcon from '@mui/icons-material/AttachMoneyOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import { useTranslation } from 'react-i18next';
import { COLORS, DURATION } from '@/style/constants';
import type { MatchedAction, CommandActionDef } from '../../hooks/useCommandPalette';
import CommandAction from './CommandAction';

// ---------------------------------------------------------------------------
// Icon map
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, React.ReactNode> = {
  EditOutlined: <EditOutlinedIcon sx={{ fontSize: 18 }} />,
  DeleteOutline: <DeleteOutlineIcon sx={{ fontSize: 18 }} />,
  DriveFileMoveOutlined: <DriveFileMoveOutlinedIcon sx={{ fontSize: 18 }} />,
  ContentCopyOutlined: <ContentCopyOutlinedIcon sx={{ fontSize: 18 }} />,
  SwapVertOutlined: <SwapVertOutlinedIcon sx={{ fontSize: 18 }} />,
  SyncOutlined: <SyncOutlinedIcon sx={{ fontSize: 18 }} />,
  TranslateOutlined: <TranslateOutlinedIcon sx={{ fontSize: 18 }} />,
  LabelOutlined: <LabelOutlinedIcon sx={{ fontSize: 18 }} />,
  AutoAwesomeOutlined: <AutoAwesomeOutlinedIcon sx={{ fontSize: 18 }} />,
  FileDownloadOutlined: <FileDownloadOutlinedIcon sx={{ fontSize: 18 }} />,
  TableChartOutlined: <TableChartOutlinedIcon sx={{ fontSize: 18 }} />,
  DescriptionOutlined: <DescriptionOutlinedIcon sx={{ fontSize: 18 }} />,
  CloudUploadOutlined: <CloudUploadOutlinedIcon sx={{ fontSize: 18 }} />,
  CloudDownloadOutlined: <CloudDownloadOutlinedIcon sx={{ fontSize: 18 }} />,
  DashboardCustomizeOutlined: <DashboardCustomizeOutlinedIcon sx={{ fontSize: 18 }} />,
  PaletteOutlined: <PaletteOutlinedIcon sx={{ fontSize: 18 }} />,
  StraightenOutlined: <StraightenOutlinedIcon sx={{ fontSize: 18 }} />,
  AttachMoneyOutlined: <AttachMoneyOutlinedIcon sx={{ fontSize: 18 }} />,
};

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const PaletteContainer = styled(Box)(({ theme }) => ({
  backgroundColor: alpha(COLORS.inkPaper, 0.95),
  backdropFilter: 'blur(24px)',
  border: `1px solid ${alpha(COLORS.white, 0.1)}`,
  borderRadius: Number(theme.shape.borderRadius) * 1.5,
  boxShadow: `0 16px 64px ${alpha(COLORS.ink, 0.6)}`,
  maxWidth: theme.spacing(112.5),
  width: '90vw',
  maxHeight: theme.spacing(62.5),
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
}));

const SearchHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(2, 2.5),
  borderBottom: `1px solid ${theme.vars.palette.divider}`,
  gap: theme.spacing(1.5),
}));

const ShortcutHint = styled(Box)(({ theme }) => ({
  fontSize: theme.typography.caption.fontSize,
  color: theme.vars.palette.text.disabled,
  backgroundColor: alpha(COLORS.white, 0.06),
  border: `1px solid ${alpha(COLORS.white, 0.08)}`,
  borderRadius: 4,
  padding: theme.spacing(0.25, 0.75),
  whiteSpace: 'nowrap',
}));

const ColumnGrid = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr',
  gap: theme.spacing(3),
  padding: theme.spacing(2),
  overflowY: 'auto',
  flex: 1,
}));

const SingleColumn = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  overflowY: 'auto',
  flex: 1,
}));

const CategoryLabel = styled(Typography)(({ theme }) => ({
  fontSize: theme.typography.overline.fontSize,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: theme.vars.palette.text.disabled,
  marginBottom: theme.spacing(0.5),
  marginTop: theme.spacing(1),
  '&:first-of-type': { marginTop: 0 },
}));

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CommandPaletteProps {
  open: boolean;
  query: string;
  onQueryChange: (q: string) => void;
  context: string | null;
  activeIndex: number;
  matched: MatchedAction[];
  recentActions: MatchedAction[];
  flatActions: MatchedAction[];
  onKeyDown: (e: React.KeyboardEvent) => void;
  onExecute: (action: CommandActionDef) => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const CommandPalette = ({
  open,
  query,
  onQueryChange,
  context,
  activeIndex,
  matched,
  recentActions,
  flatActions,
  onKeyDown,
  onExecute,
  onClose,
}: CommandPaletteProps) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus search on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Scroll active item into view
  const activeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  // Group by column (for 3-column display)
  const columns = useMemo(() => {
    const cols: [MatchedAction[], MatchedAction[], MatchedAction[]] = [[], [], []];
    matched.forEach((a) => {
      if (a.column >= 0 && a.column <= 2) {
        cols[a.column].push(a);
      }
    });
    return cols;
  }, [matched]);

  // Group items by category within a column
  const renderColumn = useCallback(
    (items: MatchedAction[]) => {
      const groups: Record<string, MatchedAction[]> = {};
      items.forEach((item) => {
        if (!groups[item.category]) groups[item.category] = [];
        groups[item.category].push(item);
      });

      return Object.entries(groups).map(([cat, catItems]) => (
        <Box key={cat}>
          <CategoryLabel>{cat}</CategoryLabel>
          {catItems.map((action) => {
            const flatIdx = flatActions.indexOf(action);
            return (
              <Box
                key={action.id}
                ref={flatIdx === activeIndex ? activeRef : undefined}
              >
                <CommandAction
                  icon={ICON_MAP[action.icon] ?? null}
                  label={action.label}
                  highlightRanges={action.highlightRanges}
                  isActive={flatIdx === activeIndex}
                  disabled={action.disabled}
                  isPro={action.isPro}
                  onClick={() => onExecute(action)}
                />
              </Box>
            );
          })}
        </Box>
      ));
    },
    [flatActions, activeIndex, onExecute],
  );

  const isSearching = Boolean(query) || Boolean(context);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: alpha(COLORS.ink, 0.4),
            backdropFilter: 'blur(4px)',
          },
        },
        paper: {
          sx: {
            backgroundColor: 'transparent',
            boxShadow: 'none',
            maxWidth: 'none',
            margin: 0,
            position: 'fixed',
            top: '15vh',
          },
        },
      }}
      TransitionComponent={Fade}
      transitionDuration={DURATION.default}
    >
      <PaletteContainer
        role="listbox"
        aria-label={t('publish.command.title', { defaultValue: 'Command Palette' })}
        onKeyDown={onKeyDown}
      >
        {/* Search Header */}
        <SearchHeader>
          <SearchOutlinedIcon sx={{ fontSize: 20, color: 'text.disabled' }} />
          <InputBase
            inputRef={inputRef}
            fullWidth
            placeholder={t('publish.command.searchPlaceholder', { defaultValue: 'Search through actions...' })}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            sx={{ flex: 1, '& input': { ...({ variant: 'body1' } as Record<string, string>) } }}
          />
          <ShortcutHint>
            {navigator.platform.includes('Mac') ? '\u2318K' : 'Ctrl+K'}
          </ShortcutHint>
        </SearchHeader>

        {/* Recently Used (only when no query and no context) */}
        {recentActions.length > 0 && !query && !context && (
          <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <HistoryOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
              <CategoryLabel sx={{ m: 0 }}>
                {t('publish.command.recent', { defaultValue: 'RECENTLY USED' })}
              </CategoryLabel>
            </Box>
            {recentActions.map((action) => {
              const flatIdx = flatActions.indexOf(action);
              return (
                <Box
                  key={`recent-${action.id}`}
                  ref={flatIdx === activeIndex ? activeRef : undefined}
                >
                  <CommandAction
                    icon={ICON_MAP[action.icon] ?? null}
                    label={action.label}
                    isActive={flatIdx === activeIndex}
                    onClick={() => onExecute(action)}
                  />
                </Box>
              );
            })}
          </Box>
        )}

        {/* Action grid: 3-col when browsing, single-col when searching */}
        {matched.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {t('publish.command.noResults', { defaultValue: 'No actions found' })}
            </Typography>
          </Box>
        ) : isSearching ? (
          <SingleColumn>
            {matched.map((action) => {
              const flatIdx = flatActions.indexOf(action);
              return (
                <Box
                  key={action.id}
                  ref={flatIdx === activeIndex ? activeRef : undefined}
                >
                  <CommandAction
                    icon={ICON_MAP[action.icon] ?? null}
                    label={action.label}
                    highlightRanges={action.highlightRanges}
                    isActive={flatIdx === activeIndex}
                    disabled={action.disabled}
                    isPro={action.isPro}
                    onClick={() => onExecute(action)}
                  />
                </Box>
              );
            })}
          </SingleColumn>
        ) : (
          <ColumnGrid>
            <Box>{renderColumn(columns[0])}</Box>
            <Box>{renderColumn(columns[1])}</Box>
            <Box>{renderColumn(columns[2])}</Box>
          </ColumnGrid>
        )}
      </PaletteContainer>
    </Dialog>
  );
};

export default CommandPalette;
