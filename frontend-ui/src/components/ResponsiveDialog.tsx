/**
 * PROJ-30 T1.7 — `<ResponsiveDialog>`.
 *
 * Thin wrapper over MUI `<Dialog>` that auto-sets `fullScreen` on `<sm`
 * viewports (per the mobile design decisions, §8). Avoids the limitation
 * that MUI `defaultProps` cannot read media queries.
 *
 * Behaviour:
 *   - Caller passes no `fullScreen` prop: viewport < `sm` → fullScreen=true,
 *     ≥ `sm` → fullScreen=false.
 *   - Caller passes `fullScreen` explicitly: that value wins.
 *   - Caller passes `disableMobileFullScreen`: the auto behaviour is
 *     skipped; the caller's `fullScreen` (or MUI default false) is used.
 *
 * Most existing dialogs do NOT need migration — the theme override applied
 * via this wrapper is opt-in. New dialogs and the ~3 small confirmation
 * dialogs that need an opt-out should use `<ResponsiveDialog>` directly.
 */
import { Dialog, type DialogProps } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

export interface ResponsiveDialogProps extends DialogProps {
  /**
   * Skip auto-fullScreen on `<sm` viewports. Use for small confirmation
   * dialogs that should remain centered modals (e.g., destructive confirms).
   */
  disableMobileFullScreen?: boolean;
}

const ResponsiveDialog = ({
  disableMobileFullScreen = false,
  fullScreen,
  ...rest
}: ResponsiveDialogProps) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const resolvedFullScreen =
    fullScreen !== undefined
      ? fullScreen
      : disableMobileFullScreen
        ? false
        : isMobile;

  return <Dialog fullScreen={resolvedFullScreen} {...rest} />;
};

export default ResponsiveDialog;
