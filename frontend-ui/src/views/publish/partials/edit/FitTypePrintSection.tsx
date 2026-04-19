import { useCallback } from 'react';
import {
  Box,
  Checkbox,
  FormControlLabel,
  Grid,
  Radio,
  RadioGroup,
  Stack,
} from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { COLORS } from '@/style/constants';
import { MBA_FIT_TYPES } from '../../types';
import type { PrintSide } from '../../types';
import SectionHeader from './SectionHeader';

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const OptionLabel = styled(FormControlLabel)(({ theme }) => ({
  marginLeft: 0,
  marginRight: 0,
  paddingBlock: theme.spacing(0.25),
  gap: theme.spacing(0.75),
  '& .MuiFormControlLabel-label': {
    ...theme.typography.body2,
    color: theme.vars.palette.text.primary,
  },
}));

const CyanCheckbox = styled(Checkbox)(({ theme }) => ({
  padding: theme.spacing(0.5),
  color: theme.vars.palette.text.disabled,
  '&.Mui-checked': {
    color: theme.vars.palette.secondary.main,
  },
  '&:hover': {
    backgroundColor: alpha(COLORS.cyan, 0.08),
  },
}));

const CoralRadio = styled(Radio)(({ theme }) => ({
  padding: theme.spacing(0.5),
  color: theme.vars.palette.text.disabled,
  '&.Mui-checked': {
    color: theme.vars.palette.primary.main,
  },
  '&:hover': {
    backgroundColor: alpha(COLORS.red, 0.08),
  },
}));

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

// Narrow print side for this section to front/back only per spec.
type FitPrintSide = Extract<PrintSide, 'front' | 'back'>;

interface FitTypePrintSectionProps {
  selectedFits: string[];
  onFitsChange: (fits: string[]) => void;
  printSide: FitPrintSide;
  onPrintSideChange: (side: FitPrintSide) => void;
  onOptionsClick: (context: string) => void;
}

const FitTypePrintSection = ({
  selectedFits,
  onFitsChange,
  printSide,
  onPrintSideChange,
  onOptionsClick,
}: FitTypePrintSectionProps) => {
  const { t } = useTranslation();

  const toggleFit = useCallback(
    (fit: string) => {
      if (selectedFits.includes(fit)) {
        onFitsChange(selectedFits.filter((f) => f !== fit));
      } else {
        onFitsChange([...selectedFits, fit]);
      }
    },
    [selectedFits, onFitsChange],
  );

  const handlePrintChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;
      if (next === 'front' || next === 'back') {
        onPrintSideChange(next);
      }
    },
    [onPrintSideChange],
  );

  return (
    <Box component="section">
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Stack gap={0.5}>
            <SectionHeader
              title={t('publish.edit.fitPrint.fitTitle')}
              count={selectedFits.length}
              context="fit_types"
              onOptionsClick={onOptionsClick}
            />
            <Stack role="group" aria-label={t('publish.edit.fitPrint.fitTitle')}>
              {MBA_FIT_TYPES.map((fit) => (
                <OptionLabel
                  key={fit}
                  control={
                    <CyanCheckbox
                      checked={selectedFits.includes(fit)}
                      onChange={() => toggleFit(fit)}
                      inputProps={{ 'aria-label': fit }}
                    />
                  }
                  label={fit}
                />
              ))}
            </Stack>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, sm: 6 }}>
          <Stack gap={0.5}>
            <SectionHeader
              title={t('publish.edit.fitPrint.printTitle')}
              context="print_side"
              onOptionsClick={onOptionsClick}
            />
            <RadioGroup
              value={printSide}
              onChange={handlePrintChange}
              aria-label={t('publish.edit.fitPrint.printTitle')}
            >
              <OptionLabel
                value="front"
                control={<CoralRadio />}
                label={t('publish.edit.fitPrint.front')}
              />
              <OptionLabel
                value="back"
                control={<CoralRadio />}
                label={t('publish.edit.fitPrint.back')}
              />
            </RadioGroup>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
};

export default FitTypePrintSection;
