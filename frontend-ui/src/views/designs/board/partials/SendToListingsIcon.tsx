import { Box } from '@mui/material';
import { styled } from '@mui/material/styles';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';

// -----------------------------------------------------------------
// Custom "Send to Listings" icon: an Article (document) icon with a
// small "+" badge in the bottom-right corner. Replaces the previous
// paper-plane SendOutlinedIcon which felt too generic / messaging-like.
//
// Used by PanelArtboardState and PanelMultiState selection toolbars.
// -----------------------------------------------------------------

const Wrap = styled(Box)({
  position: 'relative',
  width: 20,
  height: 20,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
});

const PlusBadge = styled(Box)(({ theme }) => ({
  position: 'absolute',
  right: -2,
  bottom: -2,
  width: 11,
  height: 11,
  borderRadius: '50%',
  backgroundColor: theme.vars.palette.primary.main,
  color: theme.vars.palette.common.white,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 9,
  fontWeight: 700,
  lineHeight: 1,
  // subtle ring so the badge reads cleanly over any toolbar bg
  boxShadow: `0 0 0 1.5px ${theme.vars.palette.background.paper}`,
}));

const SendToListingsIcon = () => (
  <Wrap>
    <ArticleOutlinedIcon sx={{ fontSize: 20 }} />
    <PlusBadge>+</PlusBadge>
  </Wrap>
);

export default SendToListingsIcon;
