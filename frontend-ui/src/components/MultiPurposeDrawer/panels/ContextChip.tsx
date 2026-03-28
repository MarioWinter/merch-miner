import { Chip } from '@mui/material';
import SellOutlinedIcon from '@mui/icons-material/SellOutlined';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setNicheContext } from '@/store/chatBarSlice';

const ContextChip = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const nicheContext = useAppSelector((s) => s.chatBar.nicheContext);

  if (!nicheContext) return null;

  return (
    <Chip
      icon={<SellOutlinedIcon sx={{ fontSize: 16 }} />}
      label={t('search.context.label', { name: nicheContext.name })}
      onDelete={() => dispatch(setNicheContext(null))}
      size="small"
      color="secondary"
      variant="outlined"
      sx={{ alignSelf: 'flex-start' }}
      aria-label={t('search.context.removeTooltip')}
    />
  );
};

export default ContextChip;
