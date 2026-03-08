import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useTranslation } from 'react-i18next';
import { workspaceService } from '../../services/workspaceService';

type State = 'loading' | 'success' | 'already_member' | 'error';

export default function InviteAcceptView() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [state, setState] = useState<State>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(false);
  const [resetUid, setResetUid] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    const token = searchParams.get('token');
    if (!token) {
      setErrorMsg(t('invite.missingToken'));
      setState('error');
      return;
    }
    workspaceService
      .acceptInvite(token)
      .then((result) => {
        setNeedsPasswordSetup(result.needs_password_setup ?? false);
        setResetUid(result.password_reset_uid ?? null);
        setResetToken(result.password_reset_token ?? null);
        if (result.already_accepted) {
          setState('already_member');
        } else {
          setState('success');
        }
      })
      .catch((err) => {
        const detail =
          err?.response?.data?.error ||
          err?.response?.data?.detail ||
          t('invite.invalidLink');
        setErrorMsg(detail);
        setState('error');
      });
  }, [searchParams, t]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3,
      }}
    >
      {state === 'loading' && <CircularProgress />}

      {state === 'success' && (
        <Stack alignItems="center" spacing={2} maxWidth={400} textAlign="center">
          <CheckCircleOutlineIcon color="success" sx={{ fontSize: 64 }} />
          <Typography variant="h5">{t('invite.successTitle')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('invite.successBody')}
          </Typography>
          {needsPasswordSetup ? (
            <Button variant="contained" onClick={() => navigate(`/password-reset/confirm?uid=${resetUid}&token=${resetToken}`)}>
              {t('invite.setPassword')}
            </Button>
          ) : (
            <Button variant="contained" onClick={() => navigate('/login')}>
              {t('invite.goToLogin')}
            </Button>
          )}
        </Stack>
      )}

      {state === 'already_member' && (
        <Stack alignItems="center" spacing={2} maxWidth={400} textAlign="center">
          <InfoOutlinedIcon color="info" sx={{ fontSize: 64 }} />
          <Typography variant="h5">{t('invite.alreadyMemberTitle')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('invite.alreadyMemberBody')}
          </Typography>
          {needsPasswordSetup ? (
            <Button variant="contained" onClick={() => navigate(`/password-reset/confirm?uid=${resetUid}&token=${resetToken}`)}>
              {t('invite.setPassword')}
            </Button>
          ) : (
            <Button variant="contained" onClick={() => navigate('/login')}>
              {t('invite.goToLogin')}
            </Button>
          )}
        </Stack>
      )}

      {state === 'error' && (
        <Stack alignItems="center" spacing={2} maxWidth={400} textAlign="center">
          <ErrorOutlineIcon color="error" sx={{ fontSize: 64 }} />
          <Typography variant="h5">{t('invite.errorTitle')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {errorMsg}
          </Typography>
          <Button variant="outlined" onClick={() => navigate('/login')}>
            {t('invite.backToLogin')}
          </Button>
        </Stack>
      )}
    </Box>
  );
}
