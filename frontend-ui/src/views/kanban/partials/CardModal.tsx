import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  Divider,
  IconButton,
  Skeleton,
  Tooltip,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import {
  useNewRoundMutation,
  useUpdateDesignStatusMutation,
  useSoftDeleteDesignMutation,
} from '@/store/kanbanSlice';
import { useCardModal } from '../hooks/useCardModal';
import DesignCarousel from './DesignCarousel';
import CommentThread from './CommentThread';
import RoundHistory from './RoundHistory';
import DesignUploadZone from './DesignUploadZone';
import TrashView from './TrashView';

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const ModalHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: theme.spacing(2, 3),
  borderBottom: `1px solid ${theme.vars.palette.divider}`,
}));

const ModalBody = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3),
  overflowY: 'auto',
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3),
}));

const Section = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1.5),
}));

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const CardModal = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const {
    isOpen,
    cardId,
    niche,
    currentRound,
    designs,
    rounds,
    isLoading,
    closeCard,
  } = useCardModal();

  const [newRound, { isLoading: isNewRoundLoading }] = useNewRoundMutation();
  const [updateDesignStatus] = useUpdateDesignStatusMutation();
  const [softDelete] = useSoftDeleteDesignMutation();

  if (!isOpen || !cardId) return null;

  const nicheName = niche?.name ?? '';
  const nicheStatus = niche?.status ?? '';
  const isDoneColumn = nicheStatus === 'winner' || nicheStatus === 'loser';

  const handleNewRound = async () => {
    try {
      await newRound(cardId).unwrap();
      enqueueSnackbar(t('kanban.round.newSuccess'), { variant: 'success' });
    } catch {
      enqueueSnackbar(t('kanban.round.newError'), { variant: 'error' });
    }
  };

  const handleApprove = async (designId: string) => {
    try {
      await updateDesignStatus({
        designId,
        status: 'approved',
        nicheId: cardId,
      }).unwrap();
    } catch {
      enqueueSnackbar(t('kanban.modal.approveError'), { variant: 'error' });
    }
  };

  const handleReject = async (designId: string, feedback: string) => {
    try {
      await updateDesignStatus({
        designId,
        status: 'rejected',
        feedback,
        nicheId: cardId,
      }).unwrap();
    } catch {
      enqueueSnackbar(t('kanban.modal.rejectError'), { variant: 'error' });
    }
  };

  const handleDelete = async (designId: string) => {
    try {
      await softDelete({ designId, nicheId: cardId }).unwrap();
    } catch {
      enqueueSnackbar(t('kanban.modal.deleteError'), { variant: 'error' });
    }
  };

  return (
    <Dialog
      open
      fullScreen
      onClose={(_event, reason) => {
        if (reason !== 'backdropClick') closeCard();
      }}
      aria-labelledby="card-modal-title"
    >
      {/* Header */}
      <ModalHeader>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {isLoading ? (
            <Skeleton width={200} height={28} />
          ) : (
            <>
              <Typography id="card-modal-title" variant="h5" sx={{ fontWeight: 700 }}>
                {nicheName}
              </Typography>
              {currentRound > 1 && (
                <Chip
                  label={`R${currentRound}`}
                  size="small"
                  color="primary"
                  sx={{ fontWeight: 700, fontSize: 12 }}
                />
              )}
            </>
          )}
        </Box>
        <IconButton onClick={closeCard} aria-label={t('common.close')}>
          <CloseIcon />
        </IconButton>
      </ModalHeader>

      {/* Body */}
      <ModalBody>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* Design Carousel */}
            <Section>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {t('kanban.modal.designs')} ({designs.length})
              </Typography>
              <DesignCarousel
                designs={designs}
                onApprove={handleApprove}
                onReject={handleReject}
                onDelete={handleDelete}
              />
            </Section>

            <Divider />

            {/* Upload */}
            <Section>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {t('kanban.upload.title')}
              </Typography>
              <DesignUploadZone nicheId={cardId} />
            </Section>

            <Divider />

            {/* Card-level comments */}
            <Section>
              <CommentThread nicheId={cardId} title={t('kanban.comments.cardLevel')} />
            </Section>

            <Divider />

            {/* Round History */}
            <Section>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {t('kanban.round.history')}
              </Typography>
              <RoundHistory
                rounds={rounds}
                currentRound={currentRound}
              />

              {/* New Round button — only for Done niches */}
              <Tooltip
                title={!isDoneColumn ? t('kanban.round.mustBeDone') : ''}
              >
                <span>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={
                      isNewRoundLoading ? (
                        <CircularProgress size={16} />
                      ) : (
                        <AddCircleOutlineIcon sx={{ fontSize: 18 }} />
                      )
                    }
                    disabled={!isDoneColumn || isNewRoundLoading}
                    onClick={handleNewRound}
                  >
                    {t('kanban.round.newRound')}
                  </Button>
                </span>
              </Tooltip>
            </Section>

            <Divider />

            {/* Trash */}
            <Section>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <DeleteOutlineIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {t('kanban.trash.title')}
                </Typography>
              </Box>
              <TrashView nicheId={cardId} />
            </Section>
          </>
        )}
      </ModalBody>
    </Dialog>
  );
};

export default CardModal;
