import { useCallback } from 'react';
import {
  Box,
  Divider,
  Slider,
  TextField,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import type { CanvasElement, BrushElementProps } from '../../types';

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const Section = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
}));

const SectionLabel = styled(Typography)(({ theme }) => ({
  marginBottom: theme.spacing(1.5),
}));

const FieldRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  marginBottom: theme.spacing(1.5),
}));

const ColorInput = styled('input')({
  width: 32,
  height: 32,
  padding: 0,
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  backgroundColor: 'transparent',
  '&::-webkit-color-swatch-wrapper': { padding: 0 },
  '&::-webkit-color-swatch': { border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4 },
});

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
