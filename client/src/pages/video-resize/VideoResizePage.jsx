import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Input,
  InputNumber,
  Space,
  Tabs,
  Typography,
  Upload,
  message,
} from 'antd';
import { InboxOutlined, LinkOutlined } from '@ant-design/icons';
import {
  BATCH_DOWNLOAD_SIZE_OPTIONS,
  CUSTOM_SIZE_MIN,
  CUSTOM_SIZE_MAX,
  getMediaDimensions,
} from '../../utils/batchDownloadProcessor';
import { getProxiedMediaUrl } from '../../utils/api';
import { useMaterialProcessing } from '../../contexts/MaterialProcessingContext';
import FolderPickerField from '../../components/FolderPickerField';
import {
  buildManualTask,
  detectMediaTypeFromFile,
  detectMediaTypeFromUrl,
  displayNameFromUrl,
  normalizeHttpUrl,
  sanitizeBaseName,
} from './utils/mediaSource';
import './VideoResizePage.css';

const { Dragger } = Upload;
const { Title, Paragraph, Text } = Typography;

const PRESET_SIZE_OPTIONS = BATCH_DOWNLOAD_SIZE_OPTIONS.filter((opt) => !opt.originalSize);
const CUSTOM_SIZE_OPTION_INDEX = PRESET_SIZE_OPTIONS.length;

function VideoResizePage() {
  const { startBatch, downloading } = useMaterialProcessing();
  const [inputMode, setInputMode] = useState('upload');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaUrlInput, setMediaUrlInput] = useState('');
  const [resolvedUrl, setResolvedUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [mediaKind, setMediaKind] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [sourceLabel, setSourceLabel] = useState('');
  const [selectedSizeIndices, setSelectedSizeIndices] = useState([0]);
  const [customSizeWidth, setCustomSizeWidth] = useState(720);
  const [customSizeHeight, setCustomSizeHeight] = useState(1280);
  const [originalSize, setOriginalSize] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const objectUrlRef = useRef('');

  const hasSource = inputMode === 'upload' ? !!mediaFile : !!resolvedUrl;

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const resetSource = useCallback(() => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = '';
    setMediaFile(null);
    setResolvedUrl('');
    setPreviewUrl('');
    setMediaKind(null);
    setDisplayName('');
    setSourceLabel('');
    setOriginalSize(null);
  }, []);

  const getSizeOptionAtIndex = useCallback((index) => {
    if (index === CUSTOM_SIZE_OPTION_INDEX) {
      const w = Math.max(
        CUSTOM_SIZE_MIN,
        Math.min(CUSTOM_SIZE_MAX, Math.floor(Number(customSizeWidth)) || CUSTOM_SIZE_MIN)
      );
      const h = Math.max(
        CUSTOM_SIZE_MIN,
        Math.min(CUSTOM_SIZE_MAX, Math.floor(Number(customSizeHeight)) || CUSTOM_SIZE_MIN)
      );
      return { label: `${w}×${h}`, width: w, height: h };
    }
    return PRESET_SIZE_OPTIONS[index];
  }, [customSizeWidth, customSizeHeight]);

  const selectedSizes = useMemo(
    () => selectedSizeIndices.map(getSizeOptionAtIndex).filter(Boolean),
    [selectedSizeIndices, getSizeOptionAtIndex]
  );

  const toggleSizeIndex = (index) => {
    setSelectedSizeIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index].sort((a, b) => a - b)
    );
  };

  const applySource = async ({
    kind,
    preview,
    processUrl,
    name,
    label,
    sourceType,
  }) => {
    setMediaKind(kind);
    setPreviewUrl(preview);
    setResolvedUrl(processUrl);
    setDisplayName(name);
    setSourceLabel(label);
    setOriginalSize(null);
    const dims = await getMediaDimensions(processUrl, kind === 'video');
    setOriginalSize(dims);
    return dims;
  };

  const handleBeforeUpload = (file) => {
    const kind = detectMediaTypeFromFile(file);
    if (!kind) {
      message.error('请上传视频或图片文件');
      return Upload.LIST_IGNORE;
    }
    resetSource();
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setMediaFile(file);
    applySource({
      kind,
      preview: url,
      processUrl: url,
      name: file.name,
      label: `本地文件：${file.name}`,
      sourceType: 'local',
    });
    return false;
  };

  const handleLoadUrl = async () => {
    const raw = normalizeHttpUrl(mediaUrlInput);
    if (!raw) {
      message.warning('请输入有效的 http(s) 链接');
      return;
    }
    const kind = detectMediaTypeFromUrl(raw);
    if (!kind) {
      message.warning('无法从链接识别素材类型，请使用带 .mp4 / .jpg 等后缀的直链');
      return;
    }
    setLoadingPreview(true);
    resetSource();
    try {
      const processUrl = getProxiedMediaUrl(raw);
      const name = displayNameFromUrl(raw);
      await applySource({
        kind,
        preview: processUrl,
        processUrl,
        name,
        label: `远程链接：${raw}`,
        sourceType: 'remote',
      });
      setInputMode('url');
      message.success('链接已加载，请确认预览后选择输出尺寸');
    } catch (e) {
      message.error(e?.message || '链接加载失败');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleProcess = async () => {
    if (!hasSource || !mediaKind || !resolvedUrl) {
      message.warning(inputMode === 'upload' ? '请先上传视频或图片' : '请先填写并加载素材链接');
      return;
    }
    if (selectedSizes.length === 0) {
      message.warning('请至少选择一种输出尺寸');
      return;
    }
    if (selectedSizeIndices.includes(CUSTOM_SIZE_OPTION_INDEX)) {
      const w = Number(customSizeWidth);
      const h = Number(customSizeHeight);
      if (
        !Number.isInteger(w) || w < CUSTOM_SIZE_MIN || w > CUSTOM_SIZE_MAX
        || !Number.isInteger(h) || h < CUSTOM_SIZE_MIN || h > CUSTOM_SIZE_MAX
      ) {
        message.warning(`自定义尺寸宽、高须为 ${CUSTOM_SIZE_MIN}～${CUSTOM_SIZE_MAX} 之间的整数`);
        return;
      }
    }

    const baseName = sanitizeBaseName(displayName, mediaKind === 'video' ? 'video' : 'image');
    const dims = originalSize || (await getMediaDimensions(resolvedUrl, mediaKind === 'video'));
    const isVideo = mediaKind === 'video';
    const sourceType = inputMode === 'upload' ? 'local' : 'remote';
    const originalRemoteUrl = inputMode === 'url' ? normalizeHttpUrl(mediaUrlInput) : '';

    const tasks = selectedSizes.map((opt) => {
      const sizeSuffix = `${opt.width}x${opt.height}`;
      const baseFilename = `${baseName}_${sizeSuffix}`;
      return buildManualTask({
        url: resolvedUrl,
        sourceUrl: sourceType === 'remote' ? originalRemoteUrl : '',
        isVideo,
        displayName,
        sourceLabel,
        sourceType,
        originalWidth: dims?.width ?? null,
        originalHeight: dims?.height ?? null,
        targetWidth: opt.width,
        targetHeight: opt.height,
        sizeLabel: opt.label,
        baseFilename,
        localFile: sourceType === 'local' ? mediaFile : null,
      });
    });

    try {
      await startBatch({
        source: 'manual',
        sourceLabel: '素材尺寸修改',
        tasks,
      });
      message.success('已加入处理队列，可在右上角「下载列表」或「处理历史」查看进度');
    } catch (e) {
      message.error(e?.message || '处理启动失败');
    }
  };

  const previewNode = (() => {
    if (!previewUrl || !mediaKind) return null;
    if (mediaKind === 'video') {
      return (
        <video
          className="video-resize-page__preview video-resize-page__preview--video"
          src={previewUrl}
          controls
          playsInline
        />
      );
    }
    return (
      <img
        className="video-resize-page__preview video-resize-page__preview--image"
        src={previewUrl}
        alt={displayName || '预览'}
      />
    );
  })();

  return (
    <div className="video-resize-page">
      <Card className="video-resize-page__intro">
        <Title level={4} style={{ marginTop: 0 }}>素材尺寸修改</Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          支持本地上传或填写素材直链（视频 / 图片），按预设或自定义尺寸输出。处理记录写入「处理历史」，可重试并指定保存文件夹。
        </Paragraph>
      </Card>

      <Card title="1. 选择素材" className="video-resize-page__section">
        <Tabs
          activeKey={inputMode}
          onChange={(key) => {
            setInputMode(key);
            resetSource();
            if (key === 'url') setMediaUrlInput('');
          }}
          items={[
            {
              key: 'upload',
              label: '本地上传',
              children: !mediaFile ? (
                <Dragger
                  accept="video/*,image/*"
                  maxCount={1}
                  showUploadList={false}
                  beforeUpload={handleBeforeUpload}
                >
                  <p className="ant-upload-drag-icon">
                    <InboxOutlined />
                  </p>
                  <p className="ant-upload-text">点击或拖拽视频 / 图片到此区域</p>
                  <p className="ant-upload-hint">支持 mp4、mov、jpg、png、webp 等常见格式</p>
                </Dragger>
              ) : (
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <Alert
                    type="info"
                    showIcon
                    message={
                      <>
                        已选择：{mediaFile.name}
                        {mediaKind === 'video' ? '（视频）' : '（图片）'}
                        {originalSize ? ` · ${originalSize.width}×${originalSize.height}` : ''}
                      </>
                    }
                    action={
                      <Button size="small" onClick={resetSource}>
                        重新选择
                      </Button>
                    }
                  />
                  {previewNode}
                </Space>
              ),
            },
            {
              key: 'url',
              label: '链接输入',
              children: (
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <Space.Compact style={{ width: '100%' }}>
                    <Input
                      prefix={<LinkOutlined />}
                      placeholder="粘贴视频或图片直链，如 https://.../creative.mp4"
                      value={mediaUrlInput}
                      onChange={(e) => setMediaUrlInput(e.target.value)}
                      onPressEnter={handleLoadUrl}
                      allowClear
                    />
                    <Button type="primary" loading={loadingPreview} onClick={handleLoadUrl}>
                      加载预览
                    </Button>
                  </Space.Compact>
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    需为可访问的 http(s) 直链；部分域名会自动走后端代理以解决跨域。
                  </Text>
                  {resolvedUrl && previewNode && (
                    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                      <Alert
                        type="info"
                        showIcon
                        message={
                          <>
                            {sourceLabel}
                            {originalSize ? ` · ${originalSize.width}×${originalSize.height}` : ''}
                          </>
                        }
                        action={
                          <Button size="small" onClick={resetSource}>
                            清除
                          </Button>
                        }
                      />
                      {previewNode}
                    </Space>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Card title="2. 选择输出尺寸" className="video-resize-page__section">
        <div className="video-resize-page__size-list">
          {PRESET_SIZE_OPTIONS.map((opt, i) => (
            <Checkbox
              key={opt.label}
              checked={selectedSizeIndices.includes(i)}
              onChange={() => toggleSizeIndex(i)}
              disabled={!hasSource}
            >
              {opt.label}
            </Checkbox>
          ))}
          <div className="video-resize-page__custom-size">
            <Checkbox
              checked={selectedSizeIndices.includes(CUSTOM_SIZE_OPTION_INDEX)}
              onChange={() => toggleSizeIndex(CUSTOM_SIZE_OPTION_INDEX)}
              disabled={!hasSource}
            >
              自定义尺寸
            </Checkbox>
            {selectedSizeIndices.includes(CUSTOM_SIZE_OPTION_INDEX) && (
              <Space wrap>
                <label>
                  宽：
                  <InputNumber
                    min={CUSTOM_SIZE_MIN}
                    max={CUSTOM_SIZE_MAX}
                    value={customSizeWidth}
                    onChange={(v) => setCustomSizeWidth(v ?? CUSTOM_SIZE_MIN)}
                    style={{ width: 96, marginLeft: 8 }}
                  />
                </label>
                <label>
                  高：
                  <InputNumber
                    min={CUSTOM_SIZE_MIN}
                    max={CUSTOM_SIZE_MAX}
                    value={customSizeHeight}
                    onChange={(v) => setCustomSizeHeight(v ?? CUSTOM_SIZE_MIN)}
                    style={{ width: 96, marginLeft: 8 }}
                  />
                </label>
              </Space>
            )}
          </div>
        </div>
      </Card>

      <Card title="3. 保存与处理" className="video-resize-page__section">
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <FolderPickerField />
          <Button
            type="primary"
            size="large"
            loading={downloading}
            disabled={!hasSource || selectedSizes.length === 0}
            onClick={handleProcess}
          >
            开始处理
          </Button>
        </Space>
      </Card>
    </div>
  );
}

export default VideoResizePage;
