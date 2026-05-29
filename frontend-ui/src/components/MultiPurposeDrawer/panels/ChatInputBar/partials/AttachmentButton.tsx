/**
 * PROJ-20 Phase 7.5 — opens a hidden <input type=file> for image attachments.
 */
import { memo, useRef } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import { useTranslation } from 'react-i18next';

import { useAttachmentUpload } from '../hooks/useAttachmentUpload';

const ACCEPT = 'image/jpeg,image/png,image/webp';

const AttachmentButton = () => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const { upload } = useAttachmentUpload();

  const handleClick = () => inputRef.current?.click();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) {
      void upload(files);
    }
    // Reset so the same file can be re-selected after a remove.
    e.target.value = '';
  };

  return (
    <Tooltip title={t('search.attachments.upload')}>
      <span>
        <IconButton
          size="small"
          onClick={handleClick}
          data-testid="chat-input-attachment-button"
          aria-label={t('search.attachments.upload')}
        >
          <AttachFileIcon sx={{ fontSize: 20 }} />
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            hidden
            onChange={handleChange}
          />
        </IconButton>
      </span>
    </Tooltip>
  );
};

// Memo: no props, reads Redux only.
export default memo(AttachmentButton);
