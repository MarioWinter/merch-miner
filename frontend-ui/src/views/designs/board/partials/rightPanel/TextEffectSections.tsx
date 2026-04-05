import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Slider,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useTranslation } from 'react-i18next';
import type { TextElementProps } from '../../types';
import { ColorInput, FieldLabel, FieldRow } from './TextProperties.styles';

// -----------------------------------------------------------------
// Shared props
// -----------------------------------------------------------------

interface SectionProps {
  props: TextElementProps;
  patchProps: (patch: Partial<TextElementProps>) => void;
}

// Shared accordion sx to remove default divider
const accordionSx = { '&:before': { display: 'none' } } as const;

// -----------------------------------------------------------------
// Outline Section
// -----------------------------------------------------------------

export const OutlineSection = ({ props, patchProps }: SectionProps) => {
  const { t } = useTranslation();
  return (
    <Accordion disableGutters elevation={0} sx={accordionSx}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="overline" color="text.secondary">
          {t('design.canvas.text.outline', 'Outline')}
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <FieldRow>
          <ColorInput
            type="color"
            value={props.stroke ?? '#000000'}
            onChange={(e) => patchProps({ stroke: e.target.value })}
            aria-label={t('design.canvas.text.outline', 'Outline')}
          />
          <FieldLabel variant="caption" color="text.secondary">
            {t('design.canvas.text.strokeWidth', 'Stroke Width')}
          </FieldLabel>
        </FieldRow>
        <Slider
          size="small"
          min={0}
          max={10}
          step={0.5}
          value={props.strokeWidth ?? 0}
          onChange={(_, v) => patchProps({ strokeWidth: Array.isArray(v) ? v[0] : v })}
          valueLabelDisplay="auto"
          aria-label={t('design.canvas.text.strokeWidth', 'Stroke Width')}
        />
      </AccordionDetails>
    </Accordion>
  );
};

// -----------------------------------------------------------------
// Shadow Section
// -----------------------------------------------------------------

export const ShadowSection = ({ props, patchProps }: SectionProps) => {
  const { t } = useTranslation();
  return (
    <Accordion disableGutters elevation={0} sx={accordionSx}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="overline" color="text.secondary">
          {t('design.canvas.text.shadow', 'Shadow')}
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <FieldRow>
          <ColorInput
            type="color"
            value={props.shadowColor ?? '#000000'}
            onChange={(e) => patchProps({ shadowColor: e.target.value })}
            aria-label={t('design.canvas.text.shadow', 'Shadow')}
          />
          <Typography variant="caption" color="text.secondary">
            {t('design.canvas.text.shadow', 'Shadow')}
          </Typography>
        </FieldRow>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
          {t('design.canvas.text.shadowOffset', 'Offset')} X
        </Typography>
        <Slider
          size="small"
          min={-20}
          max={20}
          value={props.shadowOffsetX ?? 0}
          onChange={(_, v) => patchProps({ shadowOffsetX: Array.isArray(v) ? v[0] : v })}
          valueLabelDisplay="auto"
        />
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
          {t('design.canvas.text.shadowOffset', 'Offset')} Y
        </Typography>
        <Slider
          size="small"
          min={-20}
          max={20}
          value={props.shadowOffsetY ?? 0}
          onChange={(_, v) => patchProps({ shadowOffsetY: Array.isArray(v) ? v[0] : v })}
          valueLabelDisplay="auto"
        />
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
          {t('design.canvas.text.shadowBlur', 'Blur')}
        </Typography>
        <Slider
          size="small"
          min={0}
          max={20}
          value={props.shadowBlur ?? 0}
          onChange={(_, v) => patchProps({ shadowBlur: Array.isArray(v) ? v[0] : v })}
          valueLabelDisplay="auto"
        />
      </AccordionDetails>
    </Accordion>
  );
};

// -----------------------------------------------------------------
// Curved Text Section
// -----------------------------------------------------------------

export const CurvedTextSection = ({ props, patchProps }: SectionProps) => {
  const { t } = useTranslation();
  return (
    <Accordion disableGutters elevation={0} sx={accordionSx}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="overline" color="text.secondary">
          {t('design.canvas.text.arc', 'Curved Text')}
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
          {t('design.canvas.text.arcAngle', 'Arc Angle')}
        </Typography>
        <Slider
          size="small"
          min={-180}
          max={180}
          value={props.arcAngle ?? 0}
          onChange={(_, v) => patchProps({ arcAngle: Array.isArray(v) ? v[0] : v })}
          valueLabelDisplay="auto"
          valueLabelFormat={(v) => `${v}\u00B0`}
          aria-label={t('design.canvas.text.arcAngle', 'Arc Angle')}
        />
      </AccordionDetails>
    </Accordion>
  );
};

// -----------------------------------------------------------------
// Gradient Section
// -----------------------------------------------------------------

export const GradientSection = ({ props, patchProps }: SectionProps) => {
  const { t } = useTranslation();
  const enabled = props.gradientEnabled ?? false;
  return (
    <Accordion disableGutters elevation={0} sx={accordionSx}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="overline" color="text.secondary">
          {t('design.canvas.text.gradient', 'Gradient')}
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <FieldRow>
          <Typography variant="caption" color="text.secondary">
            {t('design.canvas.text.gradientEnable', 'Enable')}
          </Typography>
          <Switch
            size="small"
            checked={enabled}
            onChange={(_, v) => patchProps({ gradientEnabled: v })}
          />
        </FieldRow>
        {enabled && (
          <>
            <FieldRow>
              <FieldLabel variant="caption" color="text.secondary">
                {t('design.canvas.text.gradientStart', 'Start')}
              </FieldLabel>
              <ColorInput
                type="color"
                value={props.gradientStartColor ?? '#ffffff'}
                onChange={(e) => patchProps({ gradientStartColor: e.target.value })}
                aria-label={t('design.canvas.text.gradientStart', 'Start')}
              />
              <TextField
                size="small"
                value={props.gradientStartColor ?? '#ffffff'}
                onChange={(e) => patchProps({ gradientStartColor: e.target.value })}
                sx={{ flex: 1 }}
              />
            </FieldRow>
            <FieldRow>
              <FieldLabel variant="caption" color="text.secondary">
                {t('design.canvas.text.gradientEnd', 'End')}
              </FieldLabel>
              <ColorInput
                type="color"
                value={props.gradientEndColor ?? '#000000'}
                onChange={(e) => patchProps({ gradientEndColor: e.target.value })}
                aria-label={t('design.canvas.text.gradientEnd', 'End')}
              />
              <TextField
                size="small"
                value={props.gradientEndColor ?? '#000000'}
                onChange={(e) => patchProps({ gradientEndColor: e.target.value })}
                sx={{ flex: 1 }}
              />
            </FieldRow>
          </>
        )}
      </AccordionDetails>
    </Accordion>
  );
};

// -----------------------------------------------------------------
// 3D Emboss Section
// -----------------------------------------------------------------

export const EmbossSection = ({ props, patchProps }: SectionProps) => {
  const { t } = useTranslation();
  const enabled = props.embossEnabled ?? false;
  return (
    <Accordion disableGutters elevation={0} sx={accordionSx}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="overline" color="text.secondary">
          {t('design.canvas.text.emboss', '3D Effect')}
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <FieldRow>
          <Typography variant="caption" color="text.secondary">
            {t('design.canvas.text.embossEnable', 'Enable')}
          </Typography>
          <Switch
            size="small"
            checked={enabled}
            onChange={(_, v) => patchProps({ embossEnabled: v })}
          />
        </FieldRow>
        {enabled && (
          <>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
              {t('design.canvas.text.embossDepth', 'Depth')}
            </Typography>
            <Slider
              size="small"
              min={1}
              max={5}
              step={1}
              value={props.embossDepth ?? 2}
              onChange={(_, v) => patchProps({ embossDepth: Array.isArray(v) ? v[0] : v })}
              valueLabelDisplay="auto"
              aria-label={t('design.canvas.text.embossDepth', 'Depth')}
            />
            <FieldRow>
              <FieldLabel variant="caption" color="text.secondary">
                {t('design.canvas.text.embossColor', 'Color')}
              </FieldLabel>
              <ColorInput
                type="color"
                value={props.embossColor ?? '#000000'}
                onChange={(e) => patchProps({ embossColor: e.target.value })}
                aria-label={t('design.canvas.text.embossColor', 'Color')}
              />
            </FieldRow>
          </>
        )}
      </AccordionDetails>
    </Accordion>
  );
};
