import { type ComponentProps } from 'react';
import Button from '@mui/material/Button';
import { alpha } from '@mui/material/styles';
import { COLORS } from '../../../style/constants';

type GoogleButtonProps = ComponentProps<typeof Button>;

const GoogleButton = ({ sx, ...props }: GoogleButtonProps) => (
  <Button
    variant="outlined"
    sx={[
      (theme) => ({
        mb: 3,
        height: 42,
        color: 'text.primary',
        borderColor: alpha(COLORS.ink, 0.22),
        '&:hover': {
          borderColor: alpha(COLORS.ink, 0.35),
          backgroundColor: alpha(COLORS.ink, 0.04),
        },
        ...theme.applyStyles('dark', {
          borderColor: alpha(COLORS.white, 0.18),
          '&:hover': {
            borderColor: alpha(COLORS.white, 0.30),
            backgroundColor: alpha(COLORS.white, 0.05),
          },
        }),
      }),
      ...(Array.isArray(sx) ? sx : sx != null ? [sx] : []),
    ]}
    {...props}
  />
);

export default GoogleButton;
