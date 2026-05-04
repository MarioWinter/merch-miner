import {
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import GridViewIcon from '@mui/icons-material/GridView';
import ViewListIcon from '@mui/icons-material/ViewList';
import BarChartIcon from '@mui/icons-material/BarChart';
import ViewModuleIcon from '@mui/icons-material/ViewModule';

export type ResultsTab = 'products' | 'keywords';

interface ResultsToolbarProps {
  count: number;
  keyword: string;
  layout: 'grid' | 'list';
  onLayoutChange: (layout: 'grid' | 'list') => void;
  activeTab: ResultsTab;
  onTabChange: (tab: ResultsTab) => void;
  activeFilterSummary?: string;
}

const ResultsToolbar = ({
  count,
  keyword,
  layout,
  onLayoutChange,
  activeTab,
  onTabChange,
  activeFilterSummary,
}: ResultsToolbarProps) => {
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={2}
      sx={{ mt: 2, mb: 2 }}
    >
      {/* Products / Keywords toggle */}
      <ToggleButtonGroup
        value={activeTab}
        exclusive
        onChange={(_, val) => val && onTabChange(val)}
        size="small"
        aria-label="Results view toggle"
      >
        <ToggleButton value="products" aria-label="Products view">
          <ViewModuleIcon sx={{ fontSize: 18, mr: 0.5 }} />
          Products
        </ToggleButton>
        <ToggleButton value="keywords" aria-label="Keywords view">
          <BarChartIcon sx={{ fontSize: 18, mr: 0.5 }} />
          Keywords
        </ToggleButton>
      </ToggleButtonGroup>

      <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
        {count > 0
          ? `${count.toLocaleString()} results${keyword ? ` for "${keyword}"` : ''}`
          : 'No results'}
        {activeFilterSummary && (
          <Typography
            component="span"
            variant="body2"
            sx={{ ml: 1, color: 'secondary.main' }}
          >
            {activeFilterSummary}
          </Typography>
        )}
      </Typography>

      {activeTab === 'products' && (
        <ToggleButtonGroup
          value={layout}
          exclusive
          onChange={(_, val) => val && onLayoutChange(val)}
          size="small"
          aria-label="Layout toggle"
        >
          <ToggleButton value="grid" aria-label="Grid view">
            <GridViewIcon sx={{ fontSize: 18 }} />
          </ToggleButton>
          <ToggleButton value="list" aria-label="List view">
            <ViewListIcon sx={{ fontSize: 18 }} />
          </ToggleButton>
        </ToggleButtonGroup>
      )}

    </Stack>
  );
};

export default ResultsToolbar;
