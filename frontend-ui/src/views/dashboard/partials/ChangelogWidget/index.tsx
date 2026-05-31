import {
  Alert,
  Box,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import HistoryEduOutlinedIcon from '@mui/icons-material/HistoryEduOutlined';
import { useTranslation } from 'react-i18next';
import { useChangelog } from './hooks/useChangelog';
import type { ChangelogVersion } from '@/store/dashboardSlice';

const SCROLL_MAX_HEIGHT = 320;

const ScrollableBox = styled(Box)({
  maxHeight: SCROLL_MAX_HEIGHT,
  overflowY: 'auto',
});

const BulletDot = styled('span')(({ theme }) => ({
  display: 'inline-block',
  color: theme.vars.palette.text.secondary,
  marginRight: theme.spacing(1),
  lineHeight: 1.4,
  flexShrink: 0,
}));

/**
 * Returns a localized relative-time string ("vor 2 Tagen" / "2 days ago") for
 * an ISO date. Falls back to a plain locale date string when the diff is
 * larger than 365 days or when parsing fails.
 *
 * Uses the browser-native `Intl.RelativeTimeFormat` to avoid pulling in any
 * date library.
 */
const formatRelative = (date: string, lang: string): string => {
  const parsed = new Date(date);
  const diffMs = parsed.getTime() - Date.now();
  if (Number.isNaN(diffMs)) {
    return date;
  }

  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  const absDays = Math.abs(diffDays);

  if (absDays > 365) {
    return parsed.toLocaleDateString(lang || undefined);
  }

  const rtf = new Intl.RelativeTimeFormat(lang || undefined, { numeric: 'auto' });

  if (absDays < 7) {
    return rtf.format(diffDays, 'day');
  }
  if (absDays < 30) {
    return rtf.format(Math.round(diffDays / 7), 'week');
  }
  return rtf.format(Math.round(diffDays / 30), 'month');
};

interface ChangelogVersionSectionProps {
  version: ChangelogVersion;
  isFirst: boolean;
  lang: string;
}

const ChangelogVersionSection = ({
  version,
  isFirst,
  lang,
}: ChangelogVersionSectionProps) => {
  const relative = formatRelative(version.date, lang);

  return (
    <Box sx={{ mt: isFirst ? 0 : 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        {`v${version.version} (${relative})`}
      </Typography>
      <List dense disablePadding>
        {version.items.map((item, idx) => (
          <ListItem
            key={`${version.version}-${idx}`}
            alignItems="flex-start"
            sx={{ px: 0, py: 0.25 }}
          >
            <BulletDot aria-hidden="true">{'‣'}</BulletDot>
            <ListItemText
              primary={item}
              primaryTypographyProps={{ variant: 'body2' }}
            />
          </ListItem>
        ))}
      </List>
    </Box>
  );
};

const ChangelogWidget = () => {
  const { t, i18n } = useTranslation();
  const { versions, isLoading, isError } = useChangelog();

  return (
    <Card elevation={0}>
      <CardContent>
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ mb: 1 }}
        >
          <HistoryEduOutlinedIcon color="primary" sx={{ fontSize: 20 }} />
          <Typography variant="h6">
            {t('dashboard.changelog.title')}
          </Typography>
        </Stack>

        {isError ? (
          <Alert severity="warning" variant="outlined">
            {t('dashboard.changelog.error')}
          </Alert>
        ) : isLoading ? (
          <Stack spacing={1}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} variant="rounded" height={48} />
            ))}
          </Stack>
        ) : versions.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body2" color="text.secondary">
              {t('dashboard.changelog.empty_placeholder')}
            </Typography>
          </Box>
        ) : (
          <ScrollableBox>
            {versions.map((v, idx) => (
              <ChangelogVersionSection
                key={v.version}
                version={v}
                isFirst={idx === 0}
                lang={i18n.language || 'en'}
              />
            ))}
          </ScrollableBox>
        )}
      </CardContent>
    </Card>
  );
};

export default ChangelogWidget;
