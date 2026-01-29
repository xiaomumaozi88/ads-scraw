import React, { useState, useEffect, useMemo } from 'react';
import { Dropdown, Input, Button, Checkbox, Space } from 'antd';
import creativeSpecData from '../data/creativeSpec.json';
import './CreativeSpecSelector.css';

function CreativeSpecSelector({ value = {}, onChange }) {
  const [open, setOpen] = useState(false);
  const [specs, setSpecs] = useState({
    size: '', // 尺寸（预设选项的ccode）
    customWidth: '', // 自定义宽度
    customHeight: '', // 自定义高度
    videoDuration: '', // 视频时长
    clarity: '', // 清晰度
    format: [] // 格式（多选）
  });

  // 处理数据：分离不同类别的选项
  const { sizes, videoDurations, clarities, formats } = useMemo(() => {
    const sizes = [];
    const videoDurations = [];
    const clarities = [];
    const formats = [];

    creativeSpecData.data.forEach(item => {
      if (item.level === 2) {
        // 主分类，跳过
        return;
      }
      
      if (item.parentElementCode === '306_0_sz') {
        // 尺寸
        sizes.push(item);
      } else if (item.parentElementCode === '305_0_spsc') {
        // 视频时长
        videoDurations.push(item);
      } else if (item.parentElementCode === '304_0_qxd') {
        // 清晰度
        clarities.push(item);
      } else if (item.parentElementCode === '303_0_gs') {
        // 格式
        formats.push(item);
      }
    });

    // 排序
    sizes.sort((a, b) => (a.orderNum || 0) - (b.orderNum || 0));
    videoDurations.sort((a, b) => (a.orderNum || 0) - (b.orderNum || 0));
    clarities.sort((a, b) => (a.orderNum || 0) - (b.orderNum || 0));
    formats.sort((a, b) => (a.orderNum || 0) - (b.orderNum || 0));

    return { sizes, videoDurations, clarities, formats };
  }, []);

  // 当外部 value 变化时更新内部状态
  useEffect(() => {
    if (value) {
      setSpecs({
        size: value.size || '',
        customWidth: value.customWidth || '',
        customHeight: value.customHeight || '',
        videoDuration: value.videoDuration || '',
        clarity: value.clarity || '',
        format: value.format || []
      });
    }
  }, [value]);

  // 处理尺寸选择
  const handleSizeChange = (sizeCode) => {
    const newSpecs = { ...specs, size: sizeCode };
    setSpecs(newSpecs);
    onChange(newSpecs);
  };

  // 处理自定义尺寸输入
  const handleCustomSizeChange = (field, val) => {
    const newSpecs = { ...specs, [field]: val };
    setSpecs(newSpecs);
    onChange(newSpecs);
  };

  // 处理视频时长选择
  const handleVideoDurationChange = (durationCode) => {
    const newSpecs = { ...specs, videoDuration: durationCode };
    setSpecs(newSpecs);
    onChange(newSpecs);
  };

  // 处理清晰度选择
  const handleClarityChange = (clarityCode) => {
    const newSpecs = { ...specs, clarity: clarityCode };
    setSpecs(newSpecs);
    onChange(newSpecs);
  };

  // 处理格式选择（多选）
  const handleFormatToggle = (formatCode) => {
    const newFormat = specs.format.includes(formatCode)
      ? specs.format.filter(f => f !== formatCode)
      : [...specs.format, formatCode];
    const newSpecs = { ...specs, format: newFormat };
    setSpecs(newSpecs);
    onChange(newSpecs);
  };

  // 重置选择
  const handleReset = () => {
    const emptySpecs = {
      size: '',
      customWidth: '',
      customHeight: '',
      videoDuration: '',
      clarity: '',
      format: []
    };
    setSpecs(emptySpecs);
    onChange(emptySpecs);
  };

  // 确认选择
  const handleConfirm = () => {
    setOpen(false);
  };

  // 获取显示文本
  const displayText = useMemo(() => {
    const parts = [];
    if (specs.size) {
      const size = sizes.find(s => s.ccode === specs.size);
      if (size) parts.push(size.nameCn);
    }
    if (specs.customWidth && specs.customHeight) {
      parts.push(`${specs.customWidth}*${specs.customHeight}`);
    }
    if (specs.videoDuration) {
      const duration = videoDurations.find(d => d.ccode === specs.videoDuration);
      if (duration) parts.push(duration.nameCn);
    }
    if (specs.clarity) {
      const clarity = clarities.find(c => c.ccode === specs.clarity);
      if (clarity) parts.push(clarity.nameCn);
    }
    if (specs.format.length > 0) {
      const formatNames = specs.format.map(f => {
        const format = formats.find(fmt => fmt.ccode === f);
        return format ? format.nameCn : f;
      });
      parts.push(formatNames.join(', '));
    }
    return parts.length > 0 ? parts.join(' | ') : '创意规格';
  }, [specs, sizes, videoDurations, clarities, formats]);

  // 下拉面板内容
  const dropdownContent = (
    <div className="creative-spec-dropdown">
      <div className="spec-content">
        {/* 尺寸 */}
        <div className="spec-row">
          <div className="spec-label">尺寸</div>
          <div className="spec-controls spec-controls-inline">
            <Space size={8} wrap className="spec-options-group">
              <span
                className={`spec-link ${!specs.size ? 'active' : ''}`}
                onClick={() => handleSizeChange('')}
              >
                全部(默认)
              </span>
              {sizes.map(size => (
                <span
                  key={size.elementCode}
                  className={`spec-link ${specs.size === size.ccode ? 'active' : ''}`}
                  onClick={() => handleSizeChange(size.ccode)}
                >
                  {size.nameCn}
                </span>
              ))}
            </Space>
            <div className="custom-size-inputs">
              <Input
                type="number"
                placeholder="宽"
                value={specs.customWidth}
                onChange={(e) => handleCustomSizeChange('customWidth', e.target.value)}
                className="size-input"
                size="small"
              />
              <span className="size-separator">*</span>
              <Input
                type="number"
                placeholder="高"
                value={specs.customHeight}
                onChange={(e) => handleCustomSizeChange('customHeight', e.target.value)}
                className="size-input"
                size="small"
              />
            </div>
          </div>
        </div>

        {/* 视频时长 */}
        <div className="spec-row">
          <div className="spec-label">视频时长</div>
          <div className="spec-controls">
            <Space size={8} wrap>
              <span
                className={`spec-link ${!specs.videoDuration ? 'active' : ''}`}
                onClick={() => handleVideoDurationChange('')}
              >
                全部(默认)
              </span>
              {videoDurations.map(duration => (
                <span
                  key={duration.elementCode}
                  className={`spec-link ${specs.videoDuration === duration.ccode ? 'active' : ''}`}
                  onClick={() => handleVideoDurationChange(duration.ccode)}
                >
                  {duration.nameCn}
                </span>
              ))}
            </Space>
          </div>
        </div>

        {/* 清晰度 */}
        <div className="spec-row">
          <div className="spec-label">清晰度</div>
          <div className="spec-controls">
            <Space size={8} wrap>
              <span
                className={`spec-link ${!specs.clarity ? 'active' : ''}`}
                onClick={() => handleClarityChange('')}
              >
                全部(默认)
              </span>
              {clarities.map(clarity => (
                <span
                  key={clarity.elementCode}
                  className={`spec-link ${specs.clarity === clarity.ccode ? 'active' : ''}`}
                  onClick={() => handleClarityChange(clarity.ccode)}
                >
                  {clarity.nameCn}
                </span>
              ))}
            </Space>
          </div>
        </div>

        {/* 格式 */}
        <div className="spec-row">
          <div className="spec-label">格式</div>
          <div className="spec-controls">
            <Space size={8} wrap>
              <span
                className={`spec-link ${specs.format.length === 0 ? 'active' : ''}`}
                onClick={() => {
                  const newSpecs = { ...specs, format: [] };
                  setSpecs(newSpecs);
                  onChange(newSpecs);
                }}
              >
                全部(默认)
              </span>
              {formats.map(format => (
                <Checkbox
                  key={format.elementCode}
                  checked={specs.format.includes(format.ccode)}
                  onChange={() => handleFormatToggle(format.ccode)}
                >
                  {format.nameCn}
                </Checkbox>
              ))}
            </Space>
          </div>
        </div>
      </div>

      <div className="spec-footer">
        <Button onClick={handleReset}>重置</Button>
        <Button type="primary" onClick={handleConfirm}>确定</Button>
      </div>
    </div>
  );

  return (
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      dropdownRender={() => dropdownContent}
      trigger={['click']}
      placement="bottomLeft"
    >
      <div className="creative-spec-selector-trigger">
        <Input
          readOnly
          value={displayText}
          placeholder="创意规格"
          onClick={() => setOpen(!open)}
          className="creative-spec-input"
        />
      </div>
    </Dropdown>
  );
}

export default CreativeSpecSelector;
