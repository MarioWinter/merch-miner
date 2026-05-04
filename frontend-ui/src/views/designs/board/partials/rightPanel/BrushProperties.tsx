import { useCallback } from 'react';
import {
  Box,
  Divider,
  Slider,
  TextField,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { CanvasElement, BrushElementProps } from '../../types';
import { Section, SectionLabel, FieldRow, ColorInput } from './ElementPanel.styles';

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface BrushPropertiesProps {
  element: CanvasElement<'brush'>;
  artboardId: string;
  onUpdate: (
    artboardId: string,
    elementId: string,
    patch: Partial<Omit<CanvasElement, 'id' | 'type'>>,
  ) => void;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const BrushProperties = ({
  element,
  artboardId,
  onUpdate,
}: BrushPropertiesProps) => {
  const { t } = useTranslation();
  const props = element.props as BrushElementProps;

  const updateProps = useCallback(
    (propsPatch: Partial<BrushElementProps>) => {
      onUpdate(artboardId, element.id, {
        props: { ...props, ...propsPatch } as BrushElementProps,
      });
    },
    [artboardId, element.id, props, onUpdate],
  );

  return (
    <Box>
      {/* Color */}
      <Section>
        <SectionLabel variant="overline" color="text.secondary">
          {t('design.canvas.brush.color', 'Color')}
        </SectionLabel>
        <FieldRow>
          <ColorInput
            type="color"
            value={props.stroke || '#000000'}
            onChange={(e) => updateProps({ stroke: e.target.value })}
            aria-label={t('design.canvas.brush.color', 'Color')}
          />
          <TextField
            size="small"
            fullWidth
            value={props.stroke || ''}
            onChange={(e) => updateProps({ stroke: e.target.value })}
            placeholder="#000000"
          />
        </FieldRow>
      </Section>

      <Divider />

      {/* Brush Size */}
      <Section>
        <SectionLabel variant="overline" color="text.secondary">
          {t('design.canvas.brush.size', 'Brush Size')}
        </SectionLabel>
        <FieldRow>
          <Slider
            size="small"
            min={1}
            max={50}
            step={1}
            value={props.strokeWidth}
            onChange={(_, value) =>
              updateProps({ strokeWidth: Array.isArray(value) ? value[0] : value })
            }
            valueLabelDisplay="auto"
            aria-label={t('design.canvas.brush.size', 'Brush Size')}
          />
          <Typography variant="caption" sx={{ width: 36, textAlign: 'right', flexShrink: 0 }}>
            {props.strokeWidth}px
          </Typography>
        </FieldRow>
      </Section>

      <Divider />

      {/* Smoothing */}
      <Section>
        <SectionLabel variant="overline" color="text.secondary">
          {t('design.canvas.brush.smoothing', 'Smoothing')}
        </SectionLabel>
        <FieldRow>
          <Slider
            size="small"
            min={0}
            max={1}
            step={0.05}
            value={props.tension}
            onChange={(_, value) =>
              updateProps({ tension: Array.isArray(value) ? value[0] : value })
            }
            valueLabelDisplay="auto"
            aria-label={t('design.canvas.brush.smoothing', 'Smoothing')}
          />
          <Typography variant="caption" sx={{ width: 36, textAlign: 'right', flexShrink: 0 }}>
            {props.tension.toFixed(2)}
          </Typography>
        </FieldRow>
      </Section>
    </Box>
  );
};

export default BrushProperties;
