import React, { useState, useEffect } from 'react';
import { Modal, Select, message } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { translateTextGuangdada } from '../utils/api';
import './CopyTranslationModal.css';

/** 目标语言选项（与广大大 API target_lan 一致） */
const TARGET_LANG_OPTIONS = [
  { value: 'en', label: '英语' },
  { value: 'zh-CN', label: '中文' },
  { value: 'zh-TW', label: '繁体中文' },
  { value: 'fr', label: '法语' },
  { value: 'de', label: '德语' },
  { value: 'ko', label: '韩语' },
  { value: 'ja', label: '日语' },
  { value: 'es', label: '西班牙语' },
  { value: 'it', label: '意大利语' },
  { value: 'ru', label: '俄语' },
  { value: 'hi', label: '印度语' },
  { value: 'pt', label: '葡萄牙语' },
  { value: 'tr', label: '土耳其语' },
  { value: 'vi', label: '越南语' },
  { value: 'th', label: '泰语' },
  { value: 'ar', label: '阿拉伯语' },
  { value: 'bn', label: '孟加拉语' },
];

const DEFAULT_TARGET = 'zh-CN';

/** textType: 'title' 显示【标题】前缀，'description' 显示【描述】前缀 */
function CopyTranslationModal({ open, onClose, initialText = '', textType }) {
  const [originalText, setOriginalText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [targetLang, setTargetLang] = useState(DEFAULT_TARGET);
  const [loading, setLoading] = useState(false);

  const prefix = textType === 'title' ? '【标题】' : textType === 'description' ? '【描述】' : '';
  const displayOriginal = prefix ? (originalText ? `${prefix}${originalText}` : '—') : (originalText || '—');
  const displayTranslated = prefix ? (translatedText ? `${prefix}${translatedText}` : '—') : (translatedText || '—');
  const copyOriginal = prefix && originalText ? `${prefix}${originalText}` : originalText;
  const copyTranslated = prefix && translatedText ? `${prefix}${translatedText}` : translatedText;

  const doTranslate = (text, target) => {
    if (!text || !text.trim()) return;
    setLoading(true);
    translateTextGuangdada(text, target)
      .then((result) => setTranslatedText(result != null ? String(result) : ''))
      .catch((err) => {
        message.error(err?.message || '翻译请求失败，请确保已登录广大大');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (open) {
      const text = (initialText && String(initialText).trim()) || '';
      setOriginalText(text);
      setTranslatedText('');
      setTargetLang(DEFAULT_TARGET);
      if (text) doTranslate(text, DEFAULT_TARGET);
    }
  }, [open, initialText]);

  const handleTargetLangChange = (value) => {
    const v = value || DEFAULT_TARGET;
    setTargetLang(v);
    if (originalText.trim()) doTranslate(originalText, v);
  };

  const copyToClipboard = (text, label) => {
    if (text == null || String(text).trim() === '') return;
    navigator.clipboard.writeText(String(text).trim()).then(
      () => message.success(`${label}已复制`),
      () => message.error('复制失败')
    );
  };

  return (
    <Modal
      title="文案翻译"
      open={open}
      onCancel={onClose}
      footer={null}
      width={720}
      destroyOnClose
      className="copy-translation-modal"
    >
      <div className="copy-translation-langs">
        <div className="copy-translation-lang-row">
          <span className="copy-translation-lang-label">源语言</span>
          <Select
            placeholder="自动检测"
            value="auto"
            disabled
            options={[{ value: 'auto', label: '自动检测' }]}
            style={{ width: 160 }}
          />
        </div>
        <div className="copy-translation-lang-row">
          <span className="copy-translation-lang-label">目标语言</span>
          <Select
            value={targetLang}
            onChange={handleTargetLangChange}
            options={TARGET_LANG_OPTIONS}
            style={{ width: 160 }}
          />
        </div>
      </div>
      <div className="copy-translation-panels">
        <div className="copy-translation-panel">
          <div className="copy-translation-panel-content copy-translation-original">
            {displayOriginal}
          </div>
          <button
            type="button"
            className="copy-translation-copy-btn"
            onClick={() => copyToClipboard(copyOriginal, '原文')}
            disabled={!originalText}
            title="复制原文"
          >
            <CopyOutlined />
          </button>
        </div>
        <div className="copy-translation-panel">
          <div className="copy-translation-panel-content copy-translation-result">
            {loading ? '翻译中…' : displayTranslated}
          </div>
          <button
            type="button"
            className="copy-translation-copy-btn"
            onClick={() => copyToClipboard(copyTranslated, '译文')}
            disabled={!translatedText || loading}
            title="复制译文"
          >
            <CopyOutlined />
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default CopyTranslationModal;
