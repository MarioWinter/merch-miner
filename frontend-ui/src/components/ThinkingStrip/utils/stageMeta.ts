/**
 * PROJ-29 Phase 1H — ThinkingStrip stage → metadata lookup.
 *
 * Maps the stable stage identifier emitted by the SSE protocol (`stage` /
 * `tool_call` / `tool_result`) to:
 *   - A MUI icon (rendered in StepRow + ExpandedPanel)
 *   - An i18n key under `chatNicheRag.thinking.stage.*`
 *   - An optional group emoji for the ExpandedPanel chunks group header.
 *
 * Stages covered:
 *   rewrite_query, retrieve_niche, search_slogans, search_products,
 *   search_niche_knowledge, top_keywords, bsr_stats, web_search,
 *   generate_slogans, brainstorm_ideas, writing_answer.
 *
 * Unknown stages fall back to a generic AutoAwesome icon + raw stage name.
 */
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import EditNoteIcon from '@mui/icons-material/EditNote';
import SearchIcon from '@mui/icons-material/Search';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import LibraryBooksOutlinedIcon from '@mui/icons-material/LibraryBooksOutlined';
import VpnKeyOutlinedIcon from '@mui/icons-material/VpnKeyOutlined';
import StackedBarChartIcon from '@mui/icons-material/StackedBarChart';
import LanguageIcon from '@mui/icons-material/Language';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import EmojiObjectsOutlinedIcon from '@mui/icons-material/EmojiObjectsOutlined';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import type { StageMeta } from '../types/thinking';

/**
 * Lookup table. Add a row here when a new stage / tool is wired in the agent.
 */
export const STAGE_META: Record<string, StageMeta> = {
  rewrite_query: {
    Icon: EditNoteIcon,
    i18nKey: 'chatNicheRag.thinking.stage.rewrite_query',
  },
  retrieve_niche: {
    Icon: SearchIcon,
    i18nKey: 'chatNicheRag.thinking.stage.retrieve_niche',
  },
  search_slogans: {
    Icon: LocalOfferIcon,
    i18nKey: 'chatNicheRag.thinking.stage.search_slogans',
    groupEmoji: '🏷️',
  },
  search_products: {
    Icon: Inventory2OutlinedIcon,
    i18nKey: 'chatNicheRag.thinking.stage.search_products',
    groupEmoji: '📦',
  },
  search_niche_knowledge: {
    Icon: LibraryBooksOutlinedIcon,
    i18nKey: 'chatNicheRag.thinking.stage.search_niche_knowledge',
    groupEmoji: '📚',
  },
  top_keywords: {
    Icon: VpnKeyOutlinedIcon,
    i18nKey: 'chatNicheRag.thinking.stage.top_keywords',
    groupEmoji: '🔑',
  },
  bsr_stats: {
    Icon: StackedBarChartIcon,
    i18nKey: 'chatNicheRag.thinking.stage.bsr_stats',
  },
  web_search: {
    Icon: LanguageIcon,
    i18nKey: 'chatNicheRag.thinking.stage.web_search',
    groupEmoji: '🌐',
  },
  generate_slogans: {
    Icon: CampaignOutlinedIcon,
    i18nKey: 'chatNicheRag.thinking.stage.generate_slogans',
  },
  brainstorm_ideas: {
    Icon: EmojiObjectsOutlinedIcon,
    i18nKey: 'chatNicheRag.thinking.stage.brainstorm_ideas',
  },
  writing_answer: {
    Icon: ChatBubbleOutlineIcon,
    i18nKey: 'chatNicheRag.thinking.stage.writing_answer',
  },
};

const FALLBACK: StageMeta = {
  Icon: AutoAwesomeIcon,
  i18nKey: '',
};

/** Resolve metadata for a stage; unknown stages return a generic icon + empty key. */
export const getStageMeta = (stage: string): StageMeta =>
  STAGE_META[stage] ?? FALLBACK;
