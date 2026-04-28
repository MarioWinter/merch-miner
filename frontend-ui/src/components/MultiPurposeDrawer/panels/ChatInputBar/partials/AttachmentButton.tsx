import { IconButton, Tooltip } from '@mui/material';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import { useTranslation } from 'react-i18next';

// TODO(PROJ-20 Phase 7): enable upload (image/jpeg, image/png, image/webp).

const AttachmentButton = () => {
  const { t } = useTranslation();
  return (
    <Tooltip title={t('search.chatBar.attachComingSoon')}>
      {/* span wrapper required so Tooltip can listen to events on a disabled button */}
      <span>
        <IconButton
          size="small"
          disabled
          data-testid="chat-input-attachment-button"
          aria-label={t('search.chatBar.attachComingSoon')}
        >
          <AttachFileIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </span>
    </Tooltip>
  );
};

export default AttachmentButton;
