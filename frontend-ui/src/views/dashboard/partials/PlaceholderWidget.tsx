import { Card, CardContent, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

const StyledCard = styled(Card)(({ theme }) => ({
  backgroundColor: theme.vars.palette.background.paper,
  borderRadius: 12,
}));

interface PlaceholderWidgetProps {
  title: string;
  message: string;
}

const PlaceholderWidget = ({ title, message }: PlaceholderWidgetProps) => (
  <StyledCard>
    <CardContent>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      <Stack direction="row" spacing={1} alignItems="center">
        <InfoOutlinedIcon sx={{ fontSize: 20 }} color="disabled" />
        <Typography variant="body2" color="text.secondary">
          {message}
        </Typography>
      </Stack>
    </CardContent>
  </StyledCard>
);

export default PlaceholderWidget;
