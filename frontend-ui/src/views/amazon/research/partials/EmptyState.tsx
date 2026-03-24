import { Box, Button, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import ScienceIcon from '@mui/icons-material/Science';
import type { ResearchMode } from '../types';

interface EmptyStateProps {
  mode: ResearchMode;
  hasSearched: boolean;
  onSwitchToLive?: () => void;
}

const EmptyState = ({ mode, hasSearched, onSwitchToLive }: EmptyStateProps) => {
  if (!hasSearched) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <SearchIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
        <Typography variant="h5" color="text.secondary" gutterBottom>
          Search a keyword to get started
        </Typography>
        <Typography variant="body2" color="text.disabled">
          Enter a keyword above to explore Amazon product data
        </Typography>
      </Box>
    );
  }

  if (mode === 'db') {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <SearchOffIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
        <Typography variant="h5" color="text.secondary" gutterBottom>
          No products found for this keyword
        </Typography>
        <Typography variant="body2" color="text.disabled" sx={{ mb: 3 }}>
          Try Live Research to scrape fresh data from Amazon
        </Typography>
        {onSwitchToLive && (
          <Button
            variant="contained"
            startIcon={<ScienceIcon />}
            onClick={onSwitchToLive}
            aria-label="Switch to live research"
          >
            Try Live Research
          </Button>
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ textAlign: 'center', py: 8 }}>
      <SearchOffIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
      <Typography variant="h5" color="text.secondary" gutterBottom>
        No products found on Amazon for this keyword
      </Typography>
      <Typography variant="body2" color="text.disabled">
        Try a different keyword or check your spelling
      </Typography>
    </Box>
  );
};

export default EmptyState;
