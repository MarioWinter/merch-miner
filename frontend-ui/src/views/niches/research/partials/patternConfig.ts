/**
 * Emotional Pattern visual taxonomy.
 * Each of the 16 patterns has a unique color + MUI icon,
 * creating a visual fingerprint that persists across the app.
 *
 * Keys match the API format exactly (spaces, slashes, hyphens).
 */
import type { SvgIconComponent } from '@mui/icons-material';
import BadgeIcon from '@mui/icons-material/Badge';
import GroupsIcon from '@mui/icons-material/Groups';
import Diversity3Icon from '@mui/icons-material/Diversity3';
import SentimentVerySatisfiedIcon from '@mui/icons-material/SentimentVerySatisfied';
import CelebrationIcon from '@mui/icons-material/Celebration';
import MergeIcon from '@mui/icons-material/Merge';
import FavoriteIcon from '@mui/icons-material/Favorite';
import HistoryIcon from '@mui/icons-material/History';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import WorkIcon from '@mui/icons-material/Work';
import PeopleIcon from '@mui/icons-material/People';
import ShieldIcon from '@mui/icons-material/Shield';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import SchoolIcon from '@mui/icons-material/School';
import BoltIcon from '@mui/icons-material/Bolt';
import SpaIcon from '@mui/icons-material/Spa';

export interface PatternVisual {
  icon: SvgIconComponent;
  color: string;
  label: string;
}

export const PATTERN_VISUALS: Record<string, PatternVisual> = {
  'IDENTITY DECLARATION': {
    icon: BadgeIcon,
    color: '#FF5A4F',
    label: 'Identity Declaration',
  },
  'GROUP LEADER': {
    icon: GroupsIcon,
    color: '#F59E0B',
    label: 'Group Leader',
  },
  'TRIBE/COMMUNITY': {
    icon: Diversity3Icon,
    color: '#00C8D7',
    label: 'Tribe / Community',
  },
  'FUNNY ACTIVITY': {
    icon: SentimentVerySatisfiedIcon,
    color: '#FB7185',
    label: 'Funny Activity',
  },
  'CROSS-NICHE EVENTS': {
    icon: CelebrationIcon,
    color: '#818CF8',
    label: 'Cross-Niche Events',
  },
  'CROSS-NICHE MASHUP': {
    icon: MergeIcon,
    color: '#34D399',
    label: 'Cross-Niche Mashup',
  },
  'ADDICTION/OBSESSION': {
    icon: FavoriteIcon,
    color: '#E11D48',
    label: 'Addiction / Obsession',
  },
  'VINTAGE/LEGACY': {
    icon: HistoryIcon,
    color: '#FBBF24',
    label: 'Vintage / Legacy',
  },
  'ACHIEVEMENT/GAMIFIED': {
    icon: EmojiEventsIcon,
    color: '#EAB308',
    label: 'Achievement / Gamified',
  },
  'JOB/PROFESSION PARODY': {
    icon: WorkIcon,
    color: '#60A5FA',
    label: 'Job / Profession Parody',
  },
  'RELATIONSHIP HUMOR': {
    icon: PeopleIcon,
    color: '#F472B6',
    label: 'Relationship Humor',
  },
  'BOUNDARY/GATEKEEPING': {
    icon: ShieldIcon,
    color: '#94A3B8',
    label: 'Boundary Gatekeeping',
  },
  'ENDURANCE/SURVIVAL': {
    icon: FitnessCenterIcon,
    color: '#FB923C',
    label: 'Endurance / Survival',
  },
  'COMPETENCE/EXPERTISE': {
    icon: SchoolIcon,
    color: '#38BDF8',
    label: 'Competence / Expertise',
  },
  'CHAOS/CONTROL': {
    icon: BoltIcon,
    color: '#FACC15',
    label: 'Chaos / Control',
  },
  'SELF-CARE/PRIORITIES': {
    icon: SpaIcon,
    color: '#22D3A3',
    label: 'Self-Care Priorities',
  },
};

/**
 * Normalize a pattern key from any API format to the PATTERN_VISUALS lookup key.
 * Strips number prefix ("1: "), uppercases, replaces underscores with spaces.
 */
export const normalizePatternKey = (name: string): string =>
  name.replace(/^\d+:\s*/, '').toUpperCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim();

/** Fallback for unknown patterns */
export const FALLBACK_VISUAL: PatternVisual = {
  icon: BadgeIcon,
  color: '#7BAAB8',
  label: 'Unknown Pattern',
};

/**
 * Lookup with normalization: tries exact match first,
 * then uppercased, then underscore→space/slash variants.
 */
export const getPatternVisual = (name: string): PatternVisual => {
  if (PATTERN_VISUALS[name]) return PATTERN_VISUALS[name];

  // Strip number prefix (e.g. "1: IDENTITY DECLARATION" → "IDENTITY DECLARATION")
  const stripped = name.replace(/^\d+:\s*/, '');
  if (PATTERN_VISUALS[stripped]) return PATTERN_VISUALS[stripped];

  const upper = stripped.toUpperCase();
  if (PATTERN_VISUALS[upper]) return PATTERN_VISUALS[upper];

  // Try converting underscores to spaces/slashes
  const normalized = upper.replace(/_/g, ' ').replace(/\s+/g, ' ');
  if (PATTERN_VISUALS[normalized]) return PATTERN_VISUALS[normalized];

  return FALLBACK_VISUAL;
};
