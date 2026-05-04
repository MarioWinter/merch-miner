import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { useTranslation } from 'react-i18next';
import FloatingIconButton from '@/components/FloatingIconButton';

interface JumpToLatestButtonProps {
  onClick: () => void;
  visible: boolean;
}

/**
 * Floating "jump to latest" pill anchored bottom-right of the message list.
 * Visual is provided by the shared `FloatingIconButton`; this wrapper only
 * pins position and supplies the chevron icon.
 */
const JumpToLatestButton = ({ onClick, visible }: JumpToLatestButtonProps) => {
  const { t } = useTranslation();
  return (
    <FloatingIconButton
      visible={visible}
      onClick={onClick}
      ariaLabel={t('search.scroll.jumpToLatest')}
      sx={{ position: 'absolute', bottom: 16, right: 16 }}
    >
      <KeyboardArrowDownIcon sx={{ fontSize: 22 }} />
    </FloatingIconButton>
  );
};

export default JumpToLatestButton;
