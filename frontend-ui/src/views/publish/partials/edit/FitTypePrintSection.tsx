import { useMemo } from 'react';
import {
  Box,
  Checkbox,
  FormControlLabel,
  Grid,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { skipToken } from '@reduxjs/toolkit/query';
import {
  useGetMbaProductCatalogQuery,
  useGetProductConfigQuery,
} from '@/store/publishSlice';
import { COLORS } from '@/style/constants';
import type { MarketplaceType, PrintSide } from '../../types';

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

interface FitTypePrintSectionProps {
  designId: string | null;
  marketplaceType: MarketplaceType;
  focusedProduct: string | null;
  setFitTypes: (
    productKey: string,
    fitTypes: string[],
  ) => Promise<void> | void;
  setPrintSide: (
    productKey: string,
    printSide: PrintSide,
  ) => Promise<void> | void;
}

const FitTypePrintSection = ({
  designId,
  marketplaceType,
  focusedProduct,
  setFitTypes,
  setPrintSide,
}: FitTypePrintSectionProps) => {
  const { t } = useTranslation();
  const { data: catalog = [] } = useGetMbaProductCatalogQuery();
  const { data: productConfig } = useGetProductConfigQuery(
    designId
      ? { designId, marketplace_type: marketplaceType }
      : skipToken,
  );

  const { catalogEntry, configEntry } = useMemo(() => {
    if (!focusedProduct) {
      return { catalogEntry: null, configEntry: null };
    }
    const catEntry = catalog.find((c) => c.key === focusedProduct) ?? null;
    const cfgEntry =
      productConfig?.products_config?.find(
        (e) => e.product_type === focusedProduct,
      ) ?? null;
    return { catalogEntry: catEntry, configEntry: cfgEntry };
  }, [catalog, productConfig?.products_config, focusedProduct]);

  if (!focusedProduct || !catalogEntry) return null;

  const supportsFit = catalogEntry.supports.includes('fit_types');
  const supportsPrint = catalogEntry.supports.includes('print_side');
  // Entire section is a no-op for products that support neither control.
  // (e.g. PopSocket → supports: ['colors'].)
  if (!supportsFit && !supportsPrint) return null;

  const currentFits: string[] = configEntry?.fit_types ?? [];
  const currentPrintSide: PrintSide = configEntry?.print_side ?? 'front';

  const toggleFit = (fit: string) => {
    const next = currentFits.includes(fit)
      ? currentFits.filter((f) => f !== fit)
      : [...currentFits, fit];
    void setFitTypes(focusedProduct, next);
  };

  const handlePrintChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    void setPrintSide(focusedProduct, e.target.value as PrintSide);
  };

  return (
    <Box component="section" data-testid="FitTypePrintSection">
      <Grid container spacing={3}>
        {supportsFit && (
          <Grid
            size={{ xs: 12, sm: supportsPrint ? 6 : 12 }}
            data-testid="FitTypePrintSection-fits"
          >
            <Stack gap={0.5}>
              <Typography variant="overline" color="text.secondary">
                {t('publish.edit.fitPrint.fitTitle', {
                  defaultValue: 'Fit Type',
                })}
              </Typography>
              <Stack
                role="group"
                aria-label={t('publish.edit.fitPrint.fitTitle', {
                  defaultValue: 'Fit Type',
                })}
              >
                {catalogEntry.fit_types_options.map((fit) => (
                  <OptionLabel
                    key={fit}
                    control={
                      <CyanCheckbox
                        checked={currentFits.includes(fit)}
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
        )}
        {supportsPrint && (
          <Grid
            size={{ xs: 12, sm: supportsFit ? 6 : 12 }}
            data-testid="FitTypePrintSection-print"
          >
            <Stack gap={0.5}>
              <Typography variant="overline" color="text.secondary">
                {t('publish.edit.fitPrint.printTitle', {
                  defaultValue: 'Print Side',
                })}
              </Typography>
              <RadioGroup
                value={currentPrintSide}
                onChange={handlePrintChange}
                aria-label={t('publish.edit.fitPrint.printTitle', {
                  defaultValue: 'Print Side',
                })}
              >
                {catalogEntry.print_side_options.map((side) => (
                  <OptionLabel
                    key={side}
                    value={side}
                    control={<CoralRadio />}
                    label={t(`publish.edit.fitPrint.${side}`, {
                      defaultValue: side,
                    })}
                  />
                ))}
              </RadioGroup>
            </Stack>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default FitTypePrintSection;
