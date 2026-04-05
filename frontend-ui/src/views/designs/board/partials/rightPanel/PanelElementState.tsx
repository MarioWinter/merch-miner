import { useCallback, useState } from 'react';
import {
  Box,
  Divider,
  IconButton,
  Slider,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import type { CanvasElement, ImageElementProps, EmojiElementProps } from '../../types';
import TextProperties from './TextProperties';
import ShapeProperties from './ShapeProperties';
import BrushProperties from './BrushProperties';

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
  width: 32,
  flexShrink: 0,
});

const SwitchRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: theme.spacing(0.5, 0),
}));

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface PanelElementStateProps {
  element: CanvasElement;
  artboardId: string;
  onUpdate: (
    artboardId: string,
    elementId: string,
    patch: Partial<Omit<CanvasElement, 'id' | 'type'>>,
  ) => void;
  onDeleteElement?: (artboardId: string, elementId: string) => void;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const PanelElementState = ({
  element,
  artboardId,
  onUpdate,
  onDeleteElement,
}: PanelElementStateProps) => {
  const { t } = useTranslation();
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editingX, setEditingX] = useState<string | null>(null);
  const [editingY, setEditingY] = useState<string | null>(null);
  const [editingW, setEditingW] = useState<string | null>(null);
  const [editingH, setEditingH] = useState<string | null>(null);
  const [editingRotation, setEditingRotation] = useState<string | null>(null);

  const displayName = editingName ?? element.name;
  const displayX = editingX ?? String(Math.round(element.x));
  const displayY = editingY ?? String(Math.round(element.y));
  const displayW = editingW ?? String(Math.round(element.width * element.scaleX));
  const displayH = editingH ?? String(Math.round(element.height * element.scaleY));
  const displayRotation = editingRotation ?? String(Math.round(element.rotation));

  const patch = useCallback(
    (p: Partial<Omit<CanvasElement, 'id' | 'type'>>) => {
      onUpdate(artboardId, element.id, p);
    },
    [artboardId, element.id, onUpdate],
  );

  const commitName = useCallback(() => {
    const trimmed = displayName.trim();
    if (trimmed && trimmed !== element.name) {
      patch({ name: trimmed });
    }
    setEditingName(null);
  }, [displayName, element.name, patch]);

  const commitPosition = useCallback(() => {
    const x = Number(displayX) || element.x;
    const y = Number(displayY) || element.y;
    setEditingX(null);
    setEditingY(null);
    if (x !== element.x || y !== element.y) patch({ x, y });
  }, [displayX, displayY, element.x, element.y, patch]);

  const commitSize = useCallback(() => {
    const w = Math.max(1, Number(displayW) || element.width);
    const h = Math.max(1, Number(displayH) || element.height);
    setEditingW(null);
    setEditingH(null);
    // Reset scale to 1 and set absolute dimensions
    patch({ width: w, height: h, scaleX: 1, scaleY: 1 });
  }, [displayW, displayH, element.width, element.height, patch]);

  const commitRotation = useCallback(() => {
    const r = Number(displayRotation) || 0;
    setEditingRotation(null);
    if (r !== element.rotation) patch({ rotation: r % 360 });
  }, [displayRotation, element.rotation, patch]);

  const handleOpacityChange = useCallback(
    (_: Event, value: number | number[]) => {
      const opacity = (Array.isArray(value) ? value[0] : value) / 100;
      patch({ opacity });
    },
    [patch],
  );

  return (
    <Box>
      {/* Element Name + Delete */}
      <Section>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Typography variant="overline" color="text.secondary">
            {t('design.panel.elementName', 'Name')}
          </Typography>
          {onDeleteElement && (
            <Tooltip title={t('design.panel.deleteElement', 'Delete Element')}>
              <IconButton
                size="small"
                onClick={() => onDeleteElement(artboardId, element.id)}
                aria-label={t('design.panel.deleteElement', 'Delete Element')}
                sx={{ color: 'error.main' }}
              >
                <DeleteOutlineIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
        <TextField
          size="small"
          fullWidth
          value={displayName}
          onChange={(e) => setEditingName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => e.key === 'Enter' && commitName()}
          placeholder={t('design.panel.elementNamePlaceholder', 'Element name')}
        />
      </Section>

      <Divider />

      {/* Position */}
      <Section>
        <SectionLabel variant="overline" color="text.secondary">
          {t('design.panel.position', 'Position')}
        </SectionLabel>
        <FieldRow>
          <FieldLabel variant="caption" color="text.secondary">
            X
          </FieldLabel>
          <TextField
            size="small"
            fullWidth
            type="number"
            value={displayX}
            onChange={(e) => setEditingX(e.target.value)}
            onBlur={commitPosition}
            onKeyDown={(e) => e.key === 'Enter' && commitPosition()}
          />
        </FieldRow>
        <FieldRow>
          <FieldLabel variant="caption" color="text.secondary">
            Y
          </FieldLabel>
          <TextField
            size="small"
            fullWidth
            type="number"
            value={displayY}
            onChange={(e) => setEditingY(e.target.value)}
            onBlur={commitPosition}
            onKeyDown={(e) => e.key === 'Enter' && commitPosition()}
          />
        </FieldRow>
      </Section>

      <Divider />

      {/* Size */}
      <Section>
        <SectionLabel variant="overline" color="text.secondary">
          {t('design.panel.elementSize', 'Size')}
        </SectionLabel>
        <FieldRow>
          <FieldLabel variant="caption" color="text.secondary">
            W
          </FieldLabel>
          <TextField
            size="small"
            fullWidth
            type="number"
            value={displayW}
            onChange={(e) => setEditingW(e.target.value)}
            onBlur={commitSize}
            onKeyDown={(e) => e.key === 'Enter' && commitSize()}
            slotProps={{ htmlInput: { min: 1 } }}
          />
        </FieldRow>
        <FieldRow>
          <FieldLabel variant="caption" color="text.secondary">
            H
          </FieldLabel>
          <TextField
            size="small"
            fullWidth
            type="number"
            value={displayH}
            onChange={(e) => setEditingH(e.target.value)}
            onBlur={commitSize}
            onKeyDown={(e) => e.key === 'Enter' && commitSize()}
            slotProps={{ htmlInput: { min: 1 } }}
          />
        </FieldRow>
      </Section>

      {/* Natural dimensions (image elements only) */}
      {element.type === 'image' && (
        <>
          <Divider />
          <Section>
            <SectionLabel variant="overline" color="text.secondary">
              {t('design.panel.originalSize', 'Original Size')}
            </SectionLabel>
            <FieldRow>
              <FieldLabel variant="caption" color="text.secondary">
                W
              </FieldLabel>
              <Typography variant="body2" color="text.secondary">
                {(element.props as ImageElementProps).naturalWidth}px
              </Typography>
            </FieldRow>
            <FieldRow>
              <FieldLabel variant="caption" color="text.secondary">
                H
              </FieldLabel>
              <Typography variant="body2" color="text.secondary">
                {(element.props as ImageElementProps).naturalHeight}px
              </Typography>
            </FieldRow>
          </Section>
        </>
      )}

      <Divider />

      {/* Rotation */}
      <Section>
        <SectionLabel variant="overline" color="text.secondary">
          {t('design.panel.rotation', 'Rotation')}
        </SectionLabel>
        <FieldRow>
          <FieldLabel variant="caption" color="text.secondary">
            {t('design.panel.rotationDeg', 'Deg')}
          </FieldLabel>
          <TextField
            size="small"
            fullWidth
            type="number"
            value={displayRotation}
            onChange={(e) => setEditingRotation(e.target.value)}
            onBlur={commitRotation}
            onKeyDown={(e) => e.key === 'Enter' && commitRotation()}
          />
        </FieldRow>
      </Section>

      <Divider />

      {/* Opacity */}
      <Section>
        <SectionLabel variant="overline" color="text.secondary">
          {t('design.panel.elementOpacity', 'Opacity')}
        </SectionLabel>
        <FieldRow>
          <FieldLabel variant="caption" color="text.secondary">
            {t('design.panel.opacity', 'Op')}
          </FieldLabel>
          <Slider
            size="small"
            min={0}
            max={100}
            value={Math.round(element.opacity * 100)}
            onChange={handleOpacityChange}
            valueLabelDisplay="auto"
            valueLabelFormat={(v) => `${v}%`}
            aria-label={t('design.panel.opacityLabel', 'Opacity')}
          />
          <Typography variant="caption" sx={{ width: 36, textAlign: 'right' }}>
            {Math.round(element.opacity * 100)}%
          </Typography>
        </FieldRow>
      </Section>

      <Divider />

      {/* Visibility + Lock */}
      <Section>
        <SwitchRow>
          <Typography variant="body2">
            {t('design.panel.visible', 'Visible')}
          </Typography>
          <Switch
            size="small"
            checked={element.visible}
            onChange={(_, checked) => patch({ visible: checked })}
            inputProps={{
              'aria-label': t('design.panel.visible', 'Visible'),
            }}
          />
        </SwitchRow>
        <SwitchRow>
          <Typography variant="body2">
            {t('design.panel.locked', 'Locked')}
          </Typography>
          <Switch
            size="small"
            checked={element.locked}
            onChange={(_, checked) => patch({ locked: checked })}
            inputProps={{
              'aria-label': t('design.panel.locked', 'Locked'),
            }}
          />
        </SwitchRow>
      </Section>

      {/* Text-specific properties */}
      {element.type === 'text' && (
        <>
          <Divider />
          <TextProperties
            element={element as CanvasElement<'text'>}
            artboardId={artboardId}
            onUpdate={onUpdate}
          />
        </>
      )}

      {/* Shape-specific properties */}
      {element.type === 'shape' && (
        <>
          <Divider />
          <ShapeProperties
            element={element as CanvasElement<'shape'>}
            artboardId={artboardId}
            onUpdate={onUpdate}
          />
        </>
      )}

      {/* Brush-specific properties */}
      {element.type === 'brush' && (
        <>
          <Divider />
          <BrushProperties
            element={element as CanvasElement<'brush'>}
            artboardId={artboardId}
            onUpdate={onUpdate}
          />
        </>
      )}

      {/* Emoji preview */}
      {element.type === 'emoji' && (
        <>
          <Divider />
          <Section>
            <SectionLabel variant="overline" color="text.secondary">
              {t('design.panel.emojiPreview', 'Emoji')}
            </SectionLabel>
            <Typography
              sx={{ fontSize: 48, lineHeight: 1, textAlign: 'center', py: 1 }}
            >
              {(element.props as EmojiElementProps).emoji}
            </Typography>
          </Section>
        </>
      )}
    </Box>
  );
};

export default PanelElementState;
