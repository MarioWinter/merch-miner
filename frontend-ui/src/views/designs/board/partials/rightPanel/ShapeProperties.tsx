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
import type { CanvasElement, ShapeElementProps } from '../../types';

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

const FieldLabel = styled(Typography)({
  width: 56,
  flexShrink: 0,
});

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

interface ShapePropertiesProps {
  element: CanvasElement<'shape'>;
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

const ShapeProperties = ({
  element,
  artboardId,
  onUpdate,
}: ShapePropertiesProps) => {
  const { t } = useTranslation();
  const props = element.props as ShapeElementProps;

  const updateProps = useCallback(
    (propsPatch: Partial<ShapeElementProps>) => {
      onUpdate(artboardId, element.id, {
        props: { ...props, ...propsPatch } as ShapeElementProps,
      });
    },
    [artboardId, element.id, props, onUpdate],
  );

  const isLine = props.shapeKind === 'line';
  const isRect = props.shapeKind === 'rect';

  return (
    <Box>
      {/* Fill (not for line) */}
      {!isLine && (
        <>
          <Section>
            <SectionLabel variant="overline" color="text.secondary">
              {t('design.canvas.shapes.fill', 'Fill')}
            </SectionLabel>
            <FieldRow>
              <ColorInput
                type="color"
                value={props.fill || '#000000'}
                onChange={(e) => updateProps({ fill: e.target.value })}
                aria-label={t('design.canvas.shapes.fill', 'Fill')}
              />
              <TextField
                size="small"
                fullWidth
                value={props.fill || ''}
                onChange={(e) => updateProps({ fill: e.target.value })}
                placeholder="#000000"
              />
            </FieldRow>
          </Section>
          <Divider />
        </>
      )}

      {/* Stroke */}
      <Section>
        <SectionLabel variant="overline" color="text.secondary">
          {t('design.canvas.shapes.stroke', 'Stroke')}
        </SectionLabel>
        <FieldRow>
          <ColorInput
            type="color"
            value={props.stroke || '#000000'}
            onChange={(e) => updateProps({ stroke: e.target.value })}
            aria-label={t('design.canvas.shapes.stroke', 'Stroke')}
          />
          <TextField
            size="small"
            fullWidth
            value={props.stroke || ''}
            onChange={(e) => updateProps({ stroke: e.target.value })}
            placeholder="#000000"
          />
        </FieldRow>

        {/* Stroke Width */}
        <SectionLabel variant="overline" color="text.secondary">
          {t('design.canvas.shapes.strokeWidth', 'Stroke Width')}
        </SectionLabel>
        <FieldRow>
          <Slider
            size="small"
            min={0}
            max={20}
            step={1}
            value={props.strokeWidth}
            onChange={(_, value) =>
              updateProps({ strokeWidth: Array.isArray(value) ? value[0] : value })
            }
            valueLabelDisplay="auto"
            aria-label={t('design.canvas.shapes.strokeWidth', 'Stroke Width')}
          />
          <Typography variant="caption" sx={{ width: 36, textAlign: 'right', flexShrink: 0 }}>
            {props.strokeWidth}px
          </Typography>
        </FieldRow>
      </Section>

      {/* Corner Radius (rect only) */}
      {isRect && (
        <>
          <Divider />
          <Section>
            <SectionLabel variant="overline" color="text.secondary">
              {t('design.canvas.shapes.cornerRadius', 'Corner Radius')}
            </SectionLabel>
            <FieldRow>
              <FieldLabel variant="caption" color="text.secondary">
                R
              </FieldLabel>
              <Slider
                size="small"
                min={0}
                max={50}
                step={1}
                value={props.cornerRadius ?? 0}
                onChange={(_, value) =>
                  updateProps({ cornerRadius: Array.isArray(value) ? value[0] : value })
                }
                valueLabelDisplay="auto"
                aria-label={t('design.canvas.shapes.cornerRadius', 'Corner Radius')}
              />
              <Typography variant="caption" sx={{ width: 36, textAlign: 'right', flexShrink: 0 }}>
                {props.cornerRadius ?? 0}px
              </Typography>
            </FieldRow>
          </Section>
        </>
      )}
    </Box>
  );
};

export default ShapeProperties;
