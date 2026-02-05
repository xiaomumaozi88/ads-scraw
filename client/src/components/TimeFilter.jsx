import React, { useState, useMemo } from 'react';
import { Radio, DatePicker } from 'antd';
import dayjs from 'dayjs';
import { getTodayBeijingDayjs, getTodayBeijingStr } from '../utils/beijingDate';

const { RangePicker } = DatePicker;

const PRESETS = [
  { value: '7', label: '7天' },
  { value: '30', label: '30天' },
  { value: '90', label: '90天' },
  { value: '365', label: '近1年' },
];

/** 广大大使用北京时间(UTC+8)，预设按北京“今天”判断 */
function getPresetFromRange(startTime, endTime) {
  if (!startTime || !endTime) return '365';
  const todayBeijing = getTodayBeijingStr();
  const start = dayjs(startTime);
  const end = dayjs(endTime);
  const days = end.diff(start, 'day');
  const preset = PRESETS.find((p) => Number(p.value) === days);
  if (preset && end.format('YYYY-MM-DD') === todayBeijing) return preset.value;
  return null; // 自定义范围
}

function TimeFilter({ value = {}, onChange, className }) {
  const { startTime, endTime } = value;
  const range = useMemo(() => {
    const todayBeijing = getTodayBeijingDayjs();
    if (!startTime || !endTime) return [todayBeijing.subtract(1, 'year'), todayBeijing];
    return [dayjs(startTime), dayjs(endTime)];
  }, [startTime, endTime]);

  const applyRange = (start, end) => {
    const s = start.format('YYYY-MM-DD');
    const e = end.format('YYYY-MM-DD');
    onChange?.({ startTime: s, endTime: e });
  };

  const handlePresetChange = (e) => {
    const days = Number(e.target.value);
    const end = getTodayBeijingDayjs();
    const start = end.subtract(days, 'day');
    applyRange(start, end);
  };

  const handleRangeChange = (dates) => {
    if (dates && dates[0] && dates[1]) applyRange(dates[0], dates[1]);
  };

  const currentPreset = getPresetFromRange(startTime, endTime);
  const radioValue = currentPreset != null ? currentPreset : undefined;

  return (
    <div className={`time-filter ${className || ''}`}>
      <Radio.Group
        optionType="button"
        buttonStyle="solid"
        value={radioValue}
        onChange={handlePresetChange}
        className="time-filter-presets"
      >
        {PRESETS.map((p) => (
          <Radio.Button key={p.value} value={p.value}>
            {p.label}
          </Radio.Button>
        ))}
      </Radio.Group>
      <RangePicker
        value={range}
        onChange={handleRangeChange}
        placeholder={['开始日期', '结束日期']}
        className="time-filter-range"
        allowClear={false}
      />
    </div>
  );
}

export default TimeFilter;
