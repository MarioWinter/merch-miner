// PROJ-34 Phase 13f part B — 3-step wizard mounted inside SpatialPickerModal's
// "Create new" tab (Appendix Q.3). Steps:
//   1. Source picker (Upload / From References / From Designs)
//   2. Analyze (calls POST /api/designs/spatials/custom/analyze/, shows editable
//      prompt text or 422 / 502 error escape hatch)
//   3. Name + Save (POST /api/designs/spatials/custom/)
//
// On success → `onCreated(newId)` so the parent SpatialPickerModal can switch to
// the "Custom" tab and auto-select the new entry.

import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useSnackbar } from 'notistack';
import {
  useAnalyzeSpatialMutation,
  useCreateCustomSpatialMutation,
  useGetProjectBoardQuery,
} from '@/store/designSlice';
import {
  Step1Source,
  Step2Analyze,
  Step3Save,
  type SourceSelection,
} from './CustomSpatialCreator.steps';

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const Root = styled(Stack)(({ theme }) => ({
  padding: theme.spacing(2, 0),
  gap: theme.spacing(3),
}));

const Footer = styled(Stack)(({ theme }) => ({
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingTop: theme.spacing(2),
  borderTop: `1px solid ${theme.vars.palette.divider}`,
}));

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CustomSpatialCreatorProps {
  workspaceId?: string;
  projectId?: string;
  onCreated: (newCustomId: string) => void;
  onCancel: () => void;
}

const STEPS = ['Source', 'Analyze', 'Name & Save'] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const CustomSpatialCreator = ({
  projectId,
  onCreated,
  onCancel,
}: CustomSpatialCreatorProps) => {
  const { enqueueSnackbar } = useSnackbar();

  const [activeStep, setActiveStep] = useState(0);
  const [source, setSource] = useState<SourceSelection | null>(null);
  const [promptText, setPromptText] = useState('');
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);

  // Project board provides both references[] and designs[] for the two
  // "From …" sub-tabs (reuse, no parallel endpoint per 13f.5).
  const { data: boardData } = useGetProjectBoardQuery(
    { projectId: projectId ?? '' },
    { skip: !projectId },
  );

  const [analyzeSpatial, analyzeState] = useAnalyzeSpatialMutation();
  const [createCustomSpatial, createState] = useCreateCustomSpatialMutation();

  // Auto-fire analyze when entering step 2. Resetting promptText on step
  // re-entry with a new source is the explicit purpose here — the
  // set-state-in-effect rule is a false positive in this case.
  useEffect(() => {
    if (activeStep !== 1 || !source) return;
    setPromptText(''); // eslint-disable-line react-hooks/set-state-in-effect
    let body: FormData | { reference_id: string } | { design_id: string };
    if (source.kind === 'upload') {
      const fd = new FormData();
      fd.append('image', source.file);
      body = fd;
    } else if (source.kind === 'reference') {
      body = { reference_id: source.id };
    } else {
      body = { design_id: source.id };
    }
    analyzeSpatial(body)
      .unwrap()
      .then((resp) => {
        setPromptText(resp.prompt_text ?? '');
      })
      .catch(() => {
        // Surfaced via analyzeState.error in Step2Analyze; no extra side-effect.
      });
  }, [activeStep, source, analyzeSpatial]);

  // Footer button states ----------------------------------------------------

  const nextDisabledStep0 = source === null;
  const promptLen = promptText.trim().length;
  const nextDisabledStep1 =
    analyzeState.isLoading ||
    !!analyzeState.error ||
    promptLen < 50 ||
    promptLen > 500;

  const handleBack = () => {
    if (activeStep === 1) {
      setActiveStep(0);
    } else if (activeStep === 2) {
      setActiveStep(1);
    }
  };

  const handleNext = () => {
    if (activeStep === 0 && !nextDisabledStep0) setActiveStep(1);
    else if (activeStep === 1 && !nextDisabledStep1) setActiveStep(2);
  };

  const handleSave = async () => {
    if (!source) return;
    const trimmedName = name.trim();
    const trimmedPrompt = promptText.trim();
    if (trimmedName.length < 2 || trimmedName.length > 80) {
      setNameError('Name must be 2–80 characters.');
      return;
    }
    setNameError(null);
    try {
      const created = await createCustomSpatial({
        name: trimmedName,
        prompt_text: trimmedPrompt,
        source_kind: source.kind,
        source_image_ref: source.kind !== 'upload' ? source.id : undefined,
      }).unwrap();
      enqueueSnackbar('Custom spatial saved', { variant: 'success' });
      onCreated(created.id);
    } catch (err) {
      // RTK Query axios errors come back as { status, data }.
      const e = err as { status?: number; data?: unknown };
      const data = e.data as { name?: string | string[] } | undefined;
      if (e.status === 400 && data?.name) {
        const msg = Array.isArray(data.name) ? data.name[0] : data.name;
        setNameError(
          /already exists|name_conflict/i.test(msg)
            ? 'Name already used in this workspace'
            : msg,
        );
        return;
      }
      enqueueSnackbar('Failed to save custom spatial', { variant: 'error' });
    }
  };

  // -------------------------------------------------------------------------

  return (
    <Root>
      <Stepper activeStep={activeStep} alternativeLabel>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Box>
        {activeStep === 0 && (
          <Step1Source
            value={source}
            onChange={setSource}
            references={boardData?.references ?? []}
            designs={boardData?.designs ?? []}
          />
        )}
        {activeStep === 1 && source && (
          <Step2Analyze
            source={source}
            promptText={promptText}
            onPromptChange={setPromptText}
            isLoading={analyzeState.isLoading}
            error={analyzeState.error}
            onTryAnother={() => setActiveStep(0)}
            onRetry={() => {
              // Re-fire the effect by toggling step.
              setActiveStep(0);
              setTimeout(() => setActiveStep(1), 0);
            }}
          />
        )}
        {activeStep === 2 && (
          <Step3Save
            name={name}
            onNameChange={(v) => {
              setName(v);
              if (nameError) setNameError(null);
            }}
            nameError={nameError}
            promptText={promptText}
          />
        )}
      </Box>

      <Footer>
        <Button
          onClick={activeStep === 0 ? onCancel : handleBack}
          disabled={createState.isLoading}
        >
          {activeStep === 0 ? 'Cancel' : '← Back'}
        </Button>
        {activeStep < 2 ? (
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={
              (activeStep === 0 && nextDisabledStep0) ||
              (activeStep === 1 && nextDisabledStep1)
            }
          >
            Next →
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={
              createState.isLoading ||
              name.trim().length < 2 ||
              name.trim().length > 80
            }
          >
            Save
          </Button>
        )}
      </Footer>

      {activeStep === 1 && promptText.length > 0 && (
        <Typography
          variant="caption"
          color={
            promptLen < 50 || promptLen > 500 ? 'error' : 'text.secondary'
          }
          sx={{ alignSelf: 'flex-end' }}
        >
          {promptLen} / 500 chars (min 50)
        </Typography>
      )}
    </Root>
  );
};

export default CustomSpatialCreator;
