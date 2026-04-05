import { Box, TextField } from '@mui/material';
import { styled } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import { useTranslation } from 'react-i18next';

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const Section = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
}));

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const PanelNoneState = () => {
  const { t } = useTranslation();

  return (
    <Box>
      {/* Project search */}
      <Section>
        <TextField
          size="small"
          fullWidth
          placeholder={t('design.panel.searchPlaceholder', 'Search project...')}
          slotProps={{
            input: {
              startAdornment: (
                <SearchIcon
                  sx={{ fontSize: 18, mr: 0.5, color: 'text.disabled' }}
                />
              ),
            },
          }}
        />
      </Section>
    </Box>
  );
};

export default PanelNoneState;
