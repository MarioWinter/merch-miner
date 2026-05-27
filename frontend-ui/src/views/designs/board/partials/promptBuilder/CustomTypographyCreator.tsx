// PROJ-34 Phase 13t-m — 3-step wizard mounted inside TypographyPickerModal's
// "Create new" tab. Mirrors CustomSpatialCreator.tsx 1:1 with these
// substitutions:
//   - useAnalyzeTypographyMutation / useCreateCustomTypographyMutation
//   - typography_unclear / typography_analysis_failed error codes
//   - On success the parent picker auto-selects the new entry by prompt_text
//     (TypographyPickerModal stores prompt_text as its `value`, not an id).
//
// Steps:
//   1. Source picker (Upload / From References / From Designs)
//   2. Analyze (POST /api/designs/typography/custom/analyze/, editable result)
//   3. Name + Save (POST /api/designs/typography/custom/)

import { useEffect, useReducer } from 'react';
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
import { useTranslation } from 'react-i18next';
import {
  useAnalyzeTypographyMutation,
  useCreateCustomTypographyMutation,
} from '@/services/customTypographyApi';
import { useGetProjectBoardQuery } from '@/store/designSlice';
import { Step1Source } from './CustomTypographyCreator.Step1';
import { Step2Analyze, Step3Save } from './CustomTypographyCreator.steps';
import type { SourceSelection } from './CustomTypographyCreator.shared';

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
// useReducer state + actions
// ---------------------------------------------------------------------------

interface WizardState {
  activeStep: 0 | 1 | 2;
  source: SourceSelection | null;
  promptText: string;
  name: string;
  nameError: string | null;
}

type WizardAction =
  | { type: 'set_step'; step: 0 | 1 | 2 }
  | { type: 'set_source'; value: SourceSelection | null }
  | { type: 'set_prompt'; value: string }
  | { type: 'set_name'; value: string }
  | { type: 'set_name_error'; value: string | null };

const initialState: WizardState = {
  activeStep: 0,
  source: null,
  promptText: '',
  name: '',
  nameError: null,
};

const reducer = (s: WizardState, a: WizardAction): WizardState => {
  switch (a.type) {
    case 'set_step':
      // Reset promptText when leaving step 1 → 2 transition is handled by effect.
      return { ...s, activeStep: a.step };
    case 'set_source':
      return { ...s, source: a.value };
    case 'set_prompt':
      return { ...s, promptText: a.value };
    case 'set_name':
      // Clearing any prior name error when the user re-types.
      return { ...s, name: a.value, nameError: s.nameError ? null : s.nameError };
    case 'set_name_error':
      return { ...s, nameError: a.value };
    default:
      return s;
  }
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CustomTypographyCreatorProps {
  workspaceId?: string;
  projectId?: string;
  /** Fires with the newly-created CustomTypography's `prompt_text` so the
   *  parent picker can auto-select it via its value-by-text semantics. */
  onCreated: (newPromptText: string) => void;
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const CustomTypographyCreator = ({
  projectId,
  onCreated,
  onCancel,
}: CustomTypographyCreatorProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [state, dispatch] = useReducer(reducer, initialState);
  const { activeStep, source, promptText, name, nameError } = state;

  const STEPS = [
    t('designForge.builder.typography.createNew.stepSource'),
    t('designForge.builder.typography.createNew.stepAnalyze'),
    t('designForge.builder.typography.createNew.stepSave'),
  ] as const;

  // Project board provides both references[] and designs[] for the two
  // "From …" sub-tabs (reuse, no parallel endpoint).
  const { data: boardData } = useGetProjectBoardQuery(
    { projectId: projectId ?? '' },
    { skip: !projectId },
  );

  const [analyzeTypography, analyzeState] = useAnalyzeTypographyMutation();
  const [createCustomTypography, createState] =
    useCreateCustomTypographyMutation();

  // Auto-fire analyze when entering step 2.
  useEffect(() => {
    if (activeStep !== 1 || !source) return;
    dispatch({ type: 'set_prompt', value: '' });
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
    analyzeTypography(body)
      .unwrap()
      .then((resp) => {
        dispatch({ type: 'set_prompt', value: resp.prompt_text ?? '' });
      })
      .catch(() => {
        // Surfaced via analyzeState.error in Step2Analyze; no extra side-effect.
      });
  }, [activeStep, source, analyzeTypography]);

  // Footer button states ----------------------------------------------------

  const nextDisabledStep0 = source === null;
  const promptLen = promptText.trim().length;
  const nextDisabledStep1 =
    analyzeState.isLoading ||
    !!analyzeState.error ||
    promptLen < 50 ||
    promptLen > 500;

  const handleBack = () => {
    if (activeStep === 1) dispatch({ type: 'set_step', step: 0 });
    else if (activeStep === 2) dispatch({ type: 'set_step', step: 1 });
  };

  const handleNext = () => {
    if (activeStep === 0 && !nextDisabledStep0)
      dispatch({ type: 'set_step', step: 1 });
    else if (activeStep === 1 && !nextDisabledStep1)
      dispatch({ type: 'set_step', step: 2 });
  };

  const handleSave = async () => {
    if (!source) return;
    const trimmedName = name.trim();
    const trimmedPrompt = promptText.trim();
    if (trimmedName.length < 2 || trimmedName.length > 80) {
      dispatch({
        type: 'set_name_error',
        value: t('designForge.builder.typography.createNew.nameLengthError'),
      });
      return;
    }
    dispatch({ type: 'set_name_error', value: null });
    try {
      const created = await createCustomTypography({
        name: trimmedName,
        prompt_text: trimmedPrompt,
        source_kind: source.kind,
        source_image_ref: source.kind !== 'upload' ? source.id : undefined,
      }).unwrap();
      enqueueSnackbar(
        t('designForge.builder.typography.createNew.saveSuccess'),
        { variant: 'success' },
      );
      onCreated(created.prompt_text);
    } catch (err) {
      // RTK Query axios errors come back as { status, data }.
      const e = err as { status?: number; data?: unknown };
      const data = e.data as { name?: string | string[] } | undefined;
      if (e.status === 400 && data?.name) {
        const msg = Array.isArray(data.name) ? data.name[0] : data.name;
        dispatch({
          type: 'set_name_error',
          value: /already exists|name_conflict/i.test(msg)
            ? t('designForge.builder.typography.createNew.nameConflict')
            : msg,
        });
        return;
      }
      enqueueSnackbar(
        t('designForge.builder.typography.createNew.saveError'),
        { variant: 'error' },
      );
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
            onChange={(v) => dispatch({ type: 'set_source', value: v })}
            references={boardData?.references ?? []}
            designs={boardData?.designs ?? []}
          />
        )}
        {activeStep === 1 && source && (
          <Step2Analyze
            source={source}
            promptText={promptText}
            onPromptChange={(v) => dispatch({ type: 'set_prompt', value: v })}
            isLoading={analyzeState.isLoading}
            error={analyzeState.error}
            onTryAnother={() => dispatch({ type: 'set_step', step: 0 })}
            onRetry={() => {
              // Re-fire the effect by toggling step.
              dispatch({ type: 'set_step', step: 0 });
              setTimeout(() => dispatch({ type: 'set_step', step: 1 }), 0);
            }}
          />
        )}
        {activeStep === 2 && (
          <Step3Save
            name={name}
            onNameChange={(v) => dispatch({ type: 'set_name', value: v })}
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
          {activeStep === 0
            ? t('designForge.builder.typography.createNew.cancel')
            : t('designForge.builder.typography.createNew.back')}
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
            {t('designForge.builder.typography.createNew.next')}
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
            {t('designForge.builder.typography.createNew.save')}
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
          {t('designForge.builder.typography.createNew.promptCounter', {
            count: promptLen,
          })}
        </Typography>
      )}
    </Root>
  );
};

export default CustomTypographyCreator;
