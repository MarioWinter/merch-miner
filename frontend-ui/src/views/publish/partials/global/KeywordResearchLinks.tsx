import { Box, Link as MuiLink, Tooltip, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const LinkRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  marginTop: theme.spacing(0.5),
}));

const Separator = styled(Typography)(({ theme }) => ({
  color: theme.vars.palette.text.disabled,
}));

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface KeywordResearchLinksProps {
  /** Niche UUID linked to the active design -- drives the KW Finder link
   *  target. When null the link is disabled. */
  nicheId?: string | null;
}

// ---------------------------------------------------------------------------
// Component — AC-128 / AC-129
// ---------------------------------------------------------------------------

const KeywordResearchLinks = ({ nicheId }: KeywordResearchLinksProps) => {
  const { t } = useTranslation();

  const finderLabel = t('publish.edit.global.keywords.finderLink', {
    defaultValue: 'KW Finder',
  });
  const workbenchLabel = t('publish.edit.global.keywords.workbenchLink', {
    defaultValue: 'KW Workbench',
  });
  const workbenchTooltip = t('publish.edit.global.keywords.workbenchTooltip', {
    defaultValue: 'Coming soon — ships with PROJ-10 Keyword Bank',
  });
  const finderNoNiche = t('publish.edit.global.keywords.finderNoNiche', {
    defaultValue: 'Link a niche to this design first',
  });

  return (
    <LinkRow data-testid="KeywordResearchLinks">
      {nicheId ? (
        <MuiLink
          component={RouterLink}
          to={`/niches/research?niche=${nicheId}&context=keywords`}
          variant="caption"
          underline="hover"
          data-testid="KeywordResearchLinks-finder"
        >
          {finderLabel}
        </MuiLink>
      ) : (
        <Tooltip title={finderNoNiche} arrow>
          <Typography
            component="span"
            variant="caption"
            color="text.disabled"
            data-testid="KeywordResearchLinks-finder-disabled"
          >
            {finderLabel}
          </Typography>
        </Tooltip>
      )}

      <Separator variant="caption" aria-hidden>
        |
      </Separator>

      <Tooltip title={workbenchTooltip} arrow>
        <Typography
          component="span"
          variant="caption"
          color="text.disabled"
          data-testid="KeywordResearchLinks-workbench"
        >
          {workbenchLabel}
        </Typography>
      </Tooltip>
    </LinkRow>
  );
};

export default KeywordResearchLinks;
