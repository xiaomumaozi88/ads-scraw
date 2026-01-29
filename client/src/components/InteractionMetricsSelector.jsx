import React, { useState, useEffect, useMemo } from 'react';
import { Dropdown, Input, Button, Radio, Space } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import interactionMetricsData from '../data/interactionMetrics.json';
import './InteractionMetricsSelector.css';

function InteractionMetricsSelector({ value = {}, onChange }) {
  const [open, setOpen] = useState(false);
  const [metrics, setMetrics] = useState({
    share: {
      preset: '', // 预定义范围：'', '1-100', '101-1000', '1001-'
      customMin: '',
      customMax: ''
    },
    comment: {
      preset: '',
      customMin: '',
      customMax: ''
    },
    like: {
      preset: '',
      customMin: '',
      customMax: ''
    }
  });

  // 处理数据：分离三个指标及其预定义范围
  const { metricsList, rangesByMetric } = useMemo(() => {
    const metricsList = [];
    const rangesByMetric = {
      share: [],
      comment: [],
      like: []
    };

    interactionMetricsData.data.forEach(item => {
      if (item.level === 2) {
        // 主指标（分享、评论、点赞）
        metricsList.push(item);
      } else if (item.level === 3) {
        // 预定义范围
        if (item.parentElementCode === '308_0_share') {
          rangesByMetric.share.push(item);
        } else if (item.parentElementCode === '307_0_comment') {
          rangesByMetric.comment.push(item);
        } else if (item.parentElementCode === '306_0_like') {
          rangesByMetric.like.push(item);
        }
      }
    });

    // 排序：指标按 orderNum 排序（点赞、评论、分享）
    metricsList.sort((a, b) => (a.orderNum || 0) - (b.orderNum || 0));
    // 范围按 orderNum 从大到小排序（>1000, 101-1000, 1-100），这样显示顺序为：不限、>1000、101-1000、1-100
    Object.keys(rangesByMetric).forEach(key => {
      rangesByMetric[key].sort((a, b) => (b.orderNum || 0) - (a.orderNum || 0));
    });

    return { metricsList, rangesByMetric };
  }, []);

  // 当外部 value 变化时更新内部状态
  useEffect(() => {
    if (value && Object.keys(value).length > 0) {
      setMetrics({
        share: value.share || { preset: '', customMin: '', customMax: '' },
        comment: value.comment || { preset: '', customMin: '', customMax: '' },
        like: value.like || { preset: '', customMin: '', customMax: '' }
      });
    }
  }, [value]);

  // 处理预定义范围选择（单选）
  const handlePresetChange = (metricCode, presetCode) => {
    const newMetrics = {
      ...metrics,
      [metricCode]: {
        ...metrics[metricCode],
        preset: metrics[metricCode].preset === presetCode ? '' : presetCode,
        // 选择预定义范围时，清空自定义输入
        customMin: '',
        customMax: ''
      }
    };
    setMetrics(newMetrics);
    onChange(newMetrics);
  };

  // 处理自定义范围输入
  const handleCustomRangeChange = (metricCode, field, val) => {
    const newMetrics = {
      ...metrics,
      [metricCode]: {
        ...metrics[metricCode],
        [field]: val,
        // 输入自定义范围时，清空预定义选择
        preset: ''
      }
    };
    setMetrics(newMetrics);
    onChange(newMetrics);
  };

  // 重置选择
  const handleReset = () => {
    const emptyMetrics = {
      share: { preset: '', customMin: '', customMax: '' },
      comment: { preset: '', customMin: '', customMax: '' },
      like: { preset: '', customMin: '', customMax: '' }
    };
    setMetrics(emptyMetrics);
    onChange(emptyMetrics);
  };

  // 确认选择
  const handleConfirm = () => {
    setOpen(false);
  };

  // 获取显示文本
  const displayText = useMemo(() => {
    const parts = [];
    ['like', 'comment', 'share'].forEach(metricCode => {
      const metric = metrics[metricCode];
      const metricInfo = metricsList.find(m => m.ccode === metricCode);
      if (!metricInfo) return;

      let metricText = '';
      if (metric.preset) {
        const range = rangesByMetric[metricCode].find(r => r.ccode === metric.preset);
        if (range) {
          metricText = `${metricInfo.nameCn}: ${range.nameCn}`;
        }
      } else if (metric.customMin || metric.customMax) {
        const min = metric.customMin || '0';
        const max = metric.customMax || '∞';
        metricText = `${metricInfo.nameCn}: ${min}-${max}`;
      }

      if (metricText) {
        parts.push(metricText);
      }
    });

    return parts.length > 0 ? parts.join(' | ') : '互动指标';
  }, [metrics, metricsList, rangesByMetric]);

  // 渲染单个指标的筛选器
  const renderMetricFilter = (metricCode, metricInfo) => {
    const metric = metrics[metricCode];
    const ranges = rangesByMetric[metricCode] || [];

    return (
      <div key={metricCode} className="metric-row">
        <div className="metric-label">{metricInfo.nameCn}</div>
        <div className="metric-controls">
          {/* 预定义范围 */}
          <Radio.Group
            value={metric.preset || ''}
            onChange={(e) => handlePresetChange(metricCode, e.target.value)}
            className="preset-radio-group"
          >
            <Space size={8}>
              <Radio value="">不限</Radio>
              {ranges.map(range => (
                <Radio key={range.elementCode} value={range.ccode}>
                  {range.nameCn}
                </Radio>
              ))}
            </Space>
          </Radio.Group>

          {/* 自定义范围输入 */}
          <div className="custom-range">
            <Input
              type="number"
              className="range-input"
              placeholder="最小值"
              value={metric.customMin}
              onChange={(e) => handleCustomRangeChange(metricCode, 'customMin', e.target.value)}
              size="small"
            />
            <span className="range-separator">-</span>
            <Input
              type="number"
              className="range-input"
              placeholder="最大值"
              value={metric.customMax}
              onChange={(e) => handleCustomRangeChange(metricCode, 'customMax', e.target.value)}
              size="small"
            />
          </div>
        </div>
      </div>
    );
  };

  // 下拉面板内容
  const dropdownContent = (
    <div className="interaction-metrics-dropdown">
      <div className="metrics-content">
        {metricsList.map(metricInfo => {
          const metricCode = metricInfo.ccode;
          return renderMetricFilter(metricCode, metricInfo);
        })}
      </div>

      <div className="metrics-footer">
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
      <div className="interaction-metrics-selector-trigger">
        <Input
          readOnly
          value={displayText}
          placeholder="互动指标"
          onClick={() => setOpen(!open)}
          className="interaction-metrics-input"
          suffix={<QuestionCircleOutlined style={{ color: '#999', cursor: 'help' }} />}
        />
      </div>
    </Dropdown>
  );
}

export default InteractionMetricsSelector;
