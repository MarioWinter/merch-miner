import { Box, TextField, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import { useTranslation } from 'react-i18next';
import ToolsSection from './ToolsSection';

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const Section = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
}));

const SectionLabel = styled(Typography)(({ theme }) => ({
  marginBottom: theme.spacing(1),
}));

const ColorSwatches = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(1),
}));

const ColorSwatch = styled(Box)<{ $color: string }>(({ $color, theme }) => ({
  width: 28,
  height: 28,
  borderRadius: 6,
  backgroundColor: $color,
  border: '1px solid',
  borderColor: theme.vars.palette.divider,
  cursor: 'pointer',
  transition: 'transform 150ms ease',
  '&:hover': {
    transform: 'scale(1.15)',
  },
}));

const EmptyColors = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  padding: theme.spacing(2, 0),
  color: theme.vars.palette.text.disabled,
}));

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

/** Placeholder colors extracted from designs (will be dynamic later) */
const PROJECT_COLORS = [
  '#FF5A4F',
  '#00C8D7',
  '#FFFFFF',
  '#000000',
  '#22D3A3',
  '#F59E0B',
];

const PanelNoneState = () => {
  const { t } = useTranslation();

  return (
    <Box>
      {/* Project search */}
      <Section>
        <TextField
          size="small"
          fullWidth
          placeholder={t('design.panel.searchPlaceholder', 'Search project...')}
          slotProps={{
            input: {
              startAdornment: (
                <SearchIcon
                  sx={{ fontSize: 18, mr: 0.5, color: 'text.disabled' }}
                />
              ),
            },
          }}
        />
      </Section>

      {/* Project colors */}
      <Section>
        <SectionLabel variant="overline" color="text.secondary">
          {t('design.panel.projectColors', 'Project Colors')}
        </SectionLabel>
        {PROJECT_COLORS.length > 0 ? (
          <ColorSwatches>
            {PROJECT_COLORS.map((color) => (
              <ColorSwatch
                key={color}
                $color={color}
                aria-label={color}
              />
            ))}
          </ColorSwatches>
        ) : (
          <EmptyColors>
            <PaletteOutlinedIcon sx={{ fontSize: 24 }} />
            <Typography variant="caption">
              {t('design.panel.noColors', 'No colors extracted yet')}
            </Typography>
          </EmptyColors>
        )}
      </Section>

      {/* Tools */}
      <ToolsSection />
    </Box>
  );
};

export default PanelNoneState;
