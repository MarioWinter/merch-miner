import { styled } from '@mui/material/styles';
import Button from '@mui/material/Button';

export const WorkspaceSelectorButton = styled(Button)({
  borderRadius: '999px',
  textTransform: 'none',
  fontWeight: 500,
  paddingLeft: 16,
  paddingRight: 16,
  height: 32,
  whiteSpace: 'nowrap',
  maxWidth: 220,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});
