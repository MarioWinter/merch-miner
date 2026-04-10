import { useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  TextField,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useTranslation } from 'react-i18next';
import type { ProjectIdea, ProjectPrompt, ProjectReference } from '@/views/designs/gallery/types';
import type { ArtboardData, BackgroundColor, DesignModel } from '../../types';
import SloganPoolSection from './SloganPoolSection';
import PromptListSection from './PromptListSection';
import ArtboardListSection from './ArtboardListSection';
import ReferencesSection from './ReferencesSection';

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const SearchSection = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
}));

const SectionAccordion = styled(Accordion)(({ theme }) => ({
  backgroundColor: 'transparent',
  boxShadow: 'none',
  '&:before': { display: 'none' },
  '& .MuiAccordionSummary-root': {
    minHeight: 32,
    padding: `0 ${theme.spacing(2)}`,
    '& .MuiAccordionSummary-content': { margin: '4px 0' },
  },
  '& .MuiAccordionDetails-root': {
    padding: 0,
  },
}));

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface PanelNoneStateProps {
  projectId?: string;
  ideas?: ProjectIdea[];
  prompts?: ProjectPrompt[];
  artboards?: ArtboardData[];
  selectedIds?: Set<string>;
  model?: DesignModel;
  bgColor?: BackgroundColor;
  onAutoPromptFill?: (prompt: string) => void;
  onAddReferenceArtboard?: (imageUrl: string) => void;
  onSelectArtboard?: (id: string) => void;
  onPromptClick?: (prompt: ProjectPrompt) => void;
  onCreateSkeletonArtboards?: (
    items: Array<{ runId: string; label: string }>,
  ) => void;
  // Phase I: References
  references?: ProjectReference[];
  onUseAsReference?: (imageUrl: string) => void;
  onUseAsPrompt?: (analysisText: string) => void;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const PanelNoneState = ({
  projectId,
  ideas = [],
  prompts = [],
  artboards = [],
  selectedIds = new Set(),
  model = 'google/gemini-3.1-flash-preview-image-generation',
  bgColor = 'light_gray',
  onAutoPromptFill,
  onAddReferenceArtboard,
  onSelectArtboard,
  onPromptClick,
  onCreateSkeletonArtboards,
  // Phase I: References
  references = [],
  onUseAsReference,
  onUseAsPrompt,
}: PanelNoneStateProps) => {
  const { t } = useTranslation();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    slogans: true,
    prompts: true,
    references: false,
    artboards: true,
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <Box>
      {/* Project search */}
      <SearchSection>
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
      </SearchSection>

      {/* Slogan Pool */}
      {projectId && (
        <SectionAccordion
          expanded={expandedSections.slogans}
          onChange={() => toggleSection('slogans')}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ fontSize: 16 }} />}>
            <Typography variant="overline" color="text.secondary">
              {t('design.sloganPool.title', 'Slogan Pool')}
              {ideas.length > 0 && ` (${ideas.length})`}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <SloganPoolSection
              projectId={projectId}
              ideas={ideas}
              model={model}
              bgColor={bgColor}
              onAutoPromptFill={onAutoPromptFill}
              onAddReferenceArtboard={onAddReferenceArtboard}
              onCreateSkeletonArtboards={onCreateSkeletonArtboards}
            />
          </AccordionDetails>
        </SectionAccordion>
      )}

      {/* Prompts */}
      {projectId && (
        <SectionAccordion
          expanded={expandedSections.prompts}
          onChange={() => toggleSection('prompts')}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ fontSize: 16 }} />}>
            <Typography variant="overline" color="text.secondary">
              {t('design.prompts.title', 'Prompts')}
              {prompts.length > 0 && ` (${prompts.length})`}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <PromptListSection
              projectId={projectId}
              prompts={prompts}
              onPromptClick={onPromptClick}
              onCreateSkeletonArtboards={onCreateSkeletonArtboards}
            />
          </AccordionDetails>
        </SectionAccordion>
      )}

      {/* References */}
      {projectId && onUseAsReference && onUseAsPrompt && (
        <SectionAccordion
          expanded={expandedSections.references}
          onChange={() => toggleSection('references')}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ fontSize: 16 }} />}>
            <Typography variant="overline" color="text.secondary">
              {t('design.references.title', 'References')}
              {references.length > 0 && ` (${references.length})`}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <ReferencesSection
              projectId={projectId}
              references={references}
              onUseAsReference={onUseAsReference}
              onUseAsPrompt={onUseAsPrompt}
            />
          </AccordionDetails>
        </SectionAccordion>
      )}

      {/* Artboards */}
      <SectionAccordion
        expanded={expandedSections.artboards}
        onChange={() => toggleSection('artboards')}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ fontSize: 16 }} />}>
          <Typography variant="overline" color="text.secondary">
            {t('design.artboards.title', 'Artboards')}
            {artboards.length > 0 && ` (${artboards.length})`}
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <ArtboardListSection
            artboards={artboards}
            selectedIds={selectedIds}
            onSelectArtboard={onSelectArtboard ?? (() => {})}
          />
        </AccordionDetails>
      </SectionAccordion>
    </Box>
  );
};

export default PanelNoneState;
