// PROJ-34 Phase 13e — Style slot affordance (replaces inline StylePicker
// inside the Styles accordion in Phase 13g). Click opens the StylePickerModal
// built in Phase 13f. Renders three variants: nothing selected, one selected
// (thumb + label), N selected (first thumb + "label +N-1 more").

import { Box, Card, CardActionArea, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import PaletteRoundedIcon from '@mui/icons-material/PaletteRounded';
import { STYLE_LIBRARY } from '../../constants/styleLibrary';

interface StyleSlotButtonProps {
  selectedSlugs: string[];
  onOpenPicker: () => void;
}

const StyledCard = styled(Card)(({ theme }) => ({
  backgroundColor: theme.vars.palette.background.default,
  borderColor: theme.vars.palette.divider,
  borderStyle: 'solid',
  borderWidth: 1,
  boxShadow: 'none',
}));

const Thumb = styled('div')(({ theme }) => ({
  width: 64,
  height: 64,
  borderRadius: 8,
  overflow: 'hidden',
  flexShrink: 0,
  backgroundColor: theme.vars.palette.action.disabledBackground,
  display: 'grid',
  placeItems: 'center',
  color: theme.vars.palette.text.secondary,
}));

const ThumbImg = styled('img')({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
});

const StyleSlotButton = ({
  selectedSlugs,
  onOpenPicker,
}: StyleSlotButtonProps) => {
  const selectedEntries = STYLE_LIBRARY.filter((entry) =>
    selectedSlugs.includes(entry.slug),
  );
  const count = selectedEntries.length;
  const first = selectedEntries[0];

  let title = 'Choose styles';
  let subtitle = 'Pick one or more visual styles to build with';

  if (count === 1 && first) {
    title = first.label;
    subtitle = first.shortDescription;
  } else if (count >= 2 && first) {
    title = `${first.label} +${count - 1} more`;
    subtitle = `${count} styles selected`;
  }

  return (
    <StyledCard data-testid="style-slot-button">
      <CardActionArea
        onClick={onOpenPicker}
        aria-label={`Styles: ${title}. Open picker.`}
      >
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          sx={{ p: 1.5 }}
        >
          <Thumb aria-hidden>
            {first ? (
              <ThumbImg
                src={first.thumbnail}
                alt=""
                loading="lazy"
                onError={(event) => {
                  (event.currentTarget as HTMLImageElement).style.display =
                    'none';
                }}
              />
            ) : (
              <PaletteRoundedIcon sx={{ fontSize: 32 }} />
            )}
          </Thumb>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              variant="subtitle2"
              sx={{ color: 'text.primary', lineHeight: 1.3 }}
            >
              {title}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                display: 'block',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {subtitle}
            </Typography>
          </Box>
          <Stack
            direction="row"
            alignItems="center"
            spacing={0.5}
            sx={{ color: 'text.secondary', flexShrink: 0 }}
          >
            <Typography variant="caption">
              {count > 0 ? 'Change style' : 'Open picker'}
            </Typography>
            <ChevronRightRoundedIcon sx={{ fontSize: 18 }} />
          </Stack>
        </Stack>
      </CardActionArea>
    </StyledCard>
  );
};

export default StyleSlotButton;
