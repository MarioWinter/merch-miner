import { useCallback } from 'react';
import {
  Box,
  Divider,
  MenuItem,
  Select,
  Slider,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft';
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter';
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight';
import { useTranslation } from 'react-i18next';
import type { CanvasElement, TextElementProps } from '../../types';
import { Section, SectionLabel, FieldRow, FieldLabel, ColorInput } from './TextProperties.styles';
import {
  OutlineSection,
  ShadowSection,
  CurvedTextSection,
  GradientSection,
  EmbossSection,
} from './TextEffectSections';

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

const FONT_FAMILIES = [
  'Inter',
  'Arial',
  'Georgia',
  'Times New Roman',
  'Courier New',
  'Verdana',
  'Trebuchet MS',
  'Impact',
  'Comic Sans MS',
  'Palatino',
  'Garamond',
  'Bookman',
  'Helvetica',
  'Tahoma',
  'Lucida Console',
  'Monaco',
  'Oswald',
  'Roboto',
  'Playfair Display',
  'Montserrat',
];

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface TextPropertiesProps {
  element: CanvasElement<'text'>;
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

const TextProperties = ({
  element,
  artboardId,
  onUpdate,
}: TextPropertiesProps) => {
  const { t } = useTranslation();
  const props = element.props as TextElementProps;

  const patchProps = useCallback(
    (patch: Partial<TextElementProps>) => {
      onUpdate(artboardId, element.id, {
        props: { ...props, ...patch } as TextElementProps,
      });
    },
    [artboardId, element.id, props, onUpdate],
  );

  return (
    <Box>
      {/* Font Family + Size */}
      <Section>
        <SectionLabel variant="overline" color="text.secondary">
          {t('design.canvas.text.fontFamily', 'Font')}
        </SectionLabel>
        <Select
          size="small"
          fullWidth
          value={props.fontFamily}
          onChange={(e) => patchProps({ fontFamily: e.target.value as string })}
          sx={{ mb: 1.5 }}
          aria-label={t('design.canvas.text.fontFamily', 'Font')}
        >
          {FONT_FAMILIES.map((f) => (
            <MenuItem key={f} value={f} sx={{ fontFamily: f }}>
              {f}
            </MenuItem>
          ))}
        </Select>

        <FieldRow>
          <FieldLabel variant="caption" color="text.secondary">
            {t('design.canvas.text.fontSize', 'Size')}
          </FieldLabel>
          <TextField
            size="small"
            fullWidth
            type="number"
            value={props.fontSize}
            onChange={(e) => {
              const v = Math.max(1, Number(e.target.value) || 1);
              patchProps({ fontSize: v });
            }}
            slotProps={{ htmlInput: { min: 1, max: 999 } }}
          />
        </FieldRow>

        <FieldRow>
          <ToggleButtonGroup size="small" sx={{ mr: 1 }}>
            <ToggleButton
              value="bold"
              selected={props.fontWeight >= 600}
              onChange={() =>
                patchProps({ fontWeight: props.fontWeight >= 600 ? 400 : 700 })
              }
              aria-label={t('design.canvas.text.bold', 'Bold')}
            >
              <FormatBoldIcon sx={{ fontSize: 18 }} />
            </ToggleButton>
            <ToggleButton
              value="italic"
              selected={props.fontStyle === 'italic'}
              onChange={() =>
                patchProps({
                  fontStyle: props.fontStyle === 'italic' ? 'normal' : 'italic',
                })
              }
              aria-label={t('design.canvas.text.italic', 'Italic')}
            >
              <FormatItalicIcon sx={{ fontSize: 18 }} />
            </ToggleButton>
          </ToggleButtonGroup>
        </FieldRow>
      </Section>

      <Divider />

      {/* Color */}
      <Section>
        <SectionLabel variant="overline" color="text.secondary">
          {t('design.canvas.text.color', 'Color')}
        </SectionLabel>
        <FieldRow>
          <ColorInput
            type="color"
            value={props.fill}
            onChange={(e) => patchProps({ fill: e.target.value })}
            aria-label={t('design.canvas.text.color', 'Color')}
          />
          <TextField
            size="small"
            fullWidth
            value={props.fill}
            onChange={(e) => patchProps({ fill: e.target.value })}
          />
        </FieldRow>
      </Section>

      <Divider />

      {/* Alignment */}
      <Section>
        <SectionLabel variant="overline" color="text.secondary">
          {t('design.canvas.text.align', 'Alignment')}
        </SectionLabel>
        <ToggleButtonGroup
          value={props.align}
          exclusive
          size="small"
          onChange={(_, val) => val && patchProps({ align: val })}
          aria-label={t('design.canvas.text.align', 'Alignment')}
        >
          <ToggleButton value="left" aria-label="Left">
            <FormatAlignLeftIcon sx={{ fontSize: 18 }} />
          </ToggleButton>
          <ToggleButton value="center" aria-label="Center">
            <FormatAlignCenterIcon sx={{ fontSize: 18 }} />
          </ToggleButton>
          <ToggleButton value="right" aria-label="Right">
            <FormatAlignRightIcon sx={{ fontSize: 18 }} />
          </ToggleButton>
        </ToggleButtonGroup>
      </Section>

      <Divider />

      {/* Spacing */}
      <Section>
        <SectionLabel variant="overline" color="text.secondary">
          {t('design.canvas.text.letterSpacing', 'Letter Spacing')}
        </SectionLabel>
        <FieldRow>
          <Slider
            size="small"
            min={-5}
            max={20}
            step={0.5}
            value={props.letterSpacing}
            onChange={(_, v) =>
              patchProps({ letterSpacing: Array.isArray(v) ? v[0] : v })
            }
            valueLabelDisplay="auto"
            aria-label={t('design.canvas.text.letterSpacing', 'Letter Spacing')}
          />
          <Typography variant="caption" sx={{ width: 36, textAlign: 'right', flexShrink: 0 }}>
            {props.letterSpacing}
          </Typography>
        </FieldRow>

        <SectionLabel variant="overline" color="text.secondary">
          {t('design.canvas.text.lineHeight', 'Line Height')}
        </SectionLabel>
        <FieldRow>
          <Slider
            size="small"
            min={0.8}
            max={3}
            step={0.1}
            value={props.lineHeight}
            onChange={(_, v) =>
              patchProps({ lineHeight: Array.isArray(v) ? v[0] : v })
            }
            valueLabelDisplay="auto"
            aria-label={t('design.canvas.text.lineHeight', 'Line Height')}
          />
          <Typography variant="caption" sx={{ width: 36, textAlign: 'right', flexShrink: 0 }}>
            {props.lineHeight.toFixed(1)}
          </Typography>
        </FieldRow>
      </Section>

      <Divider />

      {/* Collapsible effect sections */}
      <OutlineSection props={props} patchProps={patchProps} />
      <ShadowSection props={props} patchProps={patchProps} />
      <CurvedTextSection props={props} patchProps={patchProps} />
      <GradientSection props={props} patchProps={patchProps} />
      <EmbossSection props={props} patchProps={patchProps} />
    </Box>
  );
};

export default TextProperties;
