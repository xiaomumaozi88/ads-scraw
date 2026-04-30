import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Button, Input, message } from 'antd';
import './GuangdadaAiFileSearchModal.css';

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_VIDEO_BYTES = 30 * 1024 * 1024;

/**
 * 广大大国际版「素材内容」：按图/视频/链接做多模态搜索（与 guangdada.net multi-modal-search 一致）。
 * @param {(payload: { mode:'url', url:string } | { mode:'file', media:'image'|'video', file: File }) => void} onConfirm
 */
export default function GuangdadaAiFileSearchModal({ open, onCancel, onConfirm }) {
  const [linkUrl, setLinkUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewKind, setPreviewKind] = useState('empty');
  const [pickedFile, setPickedFile] = useState(null);
  const [pickedMedia, setPickedMedia] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef(null);
  const previewObjectUrlRef = useRef(null);

  const revokePreviewObjectUrl = useCallback(() => {
    if (previewObjectUrlRef.current) {
      try {
        URL.revokeObjectURL(previewObjectUrlRef.current);
      } catch (e) {
        /* ignore */
      }
      previewObjectUrlRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    revokePreviewObjectUrl();
    setLinkUrl('');
    setPreviewUrl(null);
    setPreviewKind('empty');
    setPickedFile(null);
    setPickedMedia(null);
    setSubmitting(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [revokePreviewObjectUrl]);

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const applyImageFile = useCallback(
    (file) => {
      if (file.size > MAX_IMAGE_BYTES) {
        message.error('图片大小不超过3MB');
        return;
      }
      revokePreviewObjectUrl();
      const objUrl = URL.createObjectURL(file);
      previewObjectUrlRef.current = objUrl;
      setPreviewUrl(objUrl);
      setPreviewKind('image');
      setPickedFile(file);
      setPickedMedia('image');
    },
    [revokePreviewObjectUrl]
  );

  const applyVideoFile = useCallback(
    (file) => {
      if (file.size > MAX_VIDEO_BYTES) {
        message.error('视频大小不超过30MB');
        return;
      }
      revokePreviewObjectUrl();
      const objUrl = URL.createObjectURL(file);
      previewObjectUrlRef.current = objUrl;
      setPreviewUrl(objUrl);
      setPreviewKind('video');
      setPickedFile(file);
      setPickedMedia('video');
    },
    [revokePreviewObjectUrl]
  );

  const handlePickedFile = useCallback(
    (file) => {
      if (!file) return;
      setLinkUrl('');
      if (file.type.startsWith('image/')) {
        applyImageFile(file);
        return;
      }
      if (file.type.startsWith('video/')) {
        applyVideoFile(file);
        return;
      }
      message.warning('请选择图片或视频文件');
    },
    [applyImageFile, applyVideoFile]
  );

  const onFileInputChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) handlePickedFile(file);
    e.target.value = '';
  };

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer?.files?.[0];
    if (file) handlePickedFile(file);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleSearch = async () => {
    const trimmed = (linkUrl || '').trim();
    if (trimmed) {
      onConfirm({ mode: 'url', url: trimmed });
      return;
    }
    if (pickedFile && pickedMedia) {
      setSubmitting(true);
      try {
        onConfirm({ mode: 'file', media: pickedMedia, file: pickedFile });
      } finally {
        setSubmitting(false);
      }
      return;
    }
    message.warning('请上传图片/视频，或粘贴图片/视频链接');
  };

  return (
    <Modal
      title={<span className="guangdada-ai-file-modal-title">根据此图片/视频搜索相似的创意</span>}
      open={open}
      onCancel={() => {
        onCancel();
        reset();
      }}
      footer={null}
      width={520}
      centered
      destroyOnClose
      className="guangdada-ai-file-modal"
      maskClosable
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="guangdada-ai-file-input-hidden"
        aria-hidden
        onChange={onFileInputChange}
      />
      <div className="guangdada-ai-file-modal-card">
        <div
          className={`guangdada-ai-file-preview-box${previewKind === 'empty' ? ' guangdada-ai-file-preview-box--clickable' : ''}`}
          onClick={() => {
            if (previewKind === 'empty') fileInputRef.current?.click();
          }}
          onKeyDown={(e) => {
            if (previewKind === 'empty' && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDrop={onDrop}
          onDragOver={onDragOver}
          role={previewKind === 'empty' ? 'button' : undefined}
          tabIndex={previewKind === 'empty' ? 0 : undefined}
        >
          {previewKind === 'video' && previewUrl ? (
            <video
              src={previewUrl}
              controls
              className="guangdada-ai-file-preview-video"
              onClick={(ev) => ev.stopPropagation()}
            />
          ) : previewKind === 'image' && previewUrl ? (
            <img
              src={previewUrl}
              alt="预览"
              className="guangdada-ai-file-preview-img"
              onClick={(ev) => {
                ev.stopPropagation();
                fileInputRef.current?.click();
              }}
            />
          ) : (
            <div className="guangdada-ai-file-preview-placeholder">点击上传图片或视频，或拖拽到此处</div>
          )}
        </div>
        <div className="guangdada-ai-file-hint-row">
          <span className="guangdada-ai-file-size-hint">图片大小不超过3MB，视频大小不超过30MB</span>
        </div>
        <div className="guangdada-ai-file-or-sep">
          <span>或</span>
        </div>
        <Input
          allowClear
          placeholder="粘贴图片/视频链接到此处"
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          className="guangdada-ai-file-link-input"
        />
      </div>
      <Button
        type="primary"
        block
        size="large"
        className="guangdada-ai-file-submit-btn"
        loading={submitting}
        onClick={handleSearch}
      >
        搜索
      </Button>
    </Modal>
  );
}
