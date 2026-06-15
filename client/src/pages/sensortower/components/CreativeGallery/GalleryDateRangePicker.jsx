import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { DATE_PRESETS } from '../../constants/galleryConstants.js';
import { formatDateRangeLabel } from '../../utils/formatGallery.js';
import {
  compareDateKeys,
  CUSTOM_DATE_PRESET_ID,
  formatSlashDate,
  GALLERY_DATE_GRANULARITIES,
  getCalendarWeeks,
  getDatePresetLabel,
  getPresetRangeSubtitle,
  isDateInRange,
  parseSlashDate,
  resolveDatePresetRange,
  startOfDay,
  toDateKey,
} from '../../utils/galleryDatePresets.js';

const WEEKDAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function CalendarIcon() {
  return (
    <svg
      className="st-date-picker__icon-svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 2v4M16 2v4" />
    </svg>
  );
}

function monthTitle(year, month) {
  const d = new Date(year, month, 1);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function MonthCalendar({ year, month, rangeStart, rangeEnd, onDayClick }) {
  const weeks = getCalendarWeeks(year, month);

  return (
    <div className="st-date-picker__month">
      <p className="st-date-picker__month-title">{monthTitle(year, month)}</p>
      <div className="st-date-picker__weekdays">
        {WEEKDAY_LABELS.map((w) => (
          <span key={w} className="st-date-picker__weekday">
            {w}
          </span>
        ))}
      </div>
      <div className="st-date-picker__days">
        {weeks.map((week, wi) => (
          <div key={wi} className="st-date-picker__week">
            {week.map((day) => {
              const inMonth = day.getMonth() === month;
              const key = toDateKey(day);
              const hasEnd = rangeEnd && !Number.isNaN(rangeEnd.getTime());
              const inRange =
                hasEnd && rangeStart && isDateInRange(day, rangeStart, rangeEnd);
              const isStart = rangeStart && key === toDateKey(rangeStart);
              const isEnd = hasEnd && rangeEnd && key === toDateKey(rangeEnd);
              const isSingle = isStart && isEnd;
              let className = 'st-date-picker__day';
              if (!inMonth) className += ' st-date-picker__day--outside';
              if (inRange && !isStart && !isEnd) className += ' st-date-picker__day--in-range';
              if (isStart) className += ' st-date-picker__day--start';
              if (isEnd && !isSingle) className += ' st-date-picker__day--end';
              if (isSingle) className += ' st-date-picker__day--single';

              return (
                <button
                  key={key}
                  type="button"
                  className={className}
                  onClick={() => onDayClick(day)}
                  aria-label={day.toLocaleDateString('zh-CN')}
                >
                  <span className="st-date-picker__day-num">{day.getDate()}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function GalleryDateRangePicker({
  datePresetId,
  onDatePresetChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  presetRangeOptions = {},
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });

  const [draftStart, setDraftStart] = useState(() => startOfDay(startDate));
  const [draftEnd, setDraftEnd] = useState(() => startOfDay(endDate));
  const [draftPresetId, setDraftPresetId] = useState(datePresetId);
  const [draftGranularity, setDraftGranularity] = useState('weekly');
  const [viewYear, setViewYear] = useState(() => startDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => startDate.getMonth());
  const [startInput, setStartInput] = useState(() => formatSlashDate(startDate));
  const [endInput, setEndInput] = useState(() => formatSlashDate(endDate));

  const presetLabel = getDatePresetLabel(datePresetId);
  const rangeLabel = formatDateRangeLabel(startDate, endDate);

  const syncDraftFromProps = useCallback(() => {
    setDraftStart(startOfDay(startDate));
    setDraftEnd(startOfDay(endDate));
    setDraftPresetId(datePresetId);
    setStartInput(formatSlashDate(startDate));
    setEndInput(formatSlashDate(endDate));
    setViewYear(startDate.getFullYear());
    setViewMonth(startDate.getMonth());
  }, [startDate, endDate, datePresetId]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const width = 700;
    let left = rect.left;
    if (left + width > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - width - 12);
    }
    setPopoverPos({ top: rect.bottom + 6, left });
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    syncDraftFromProps();
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        syncDraftFromProps();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, syncDraftFromProps]);

  const rightYear = viewMonth === 11 ? viewYear + 1 : viewYear;
  const rightMonth = viewMonth === 11 ? 0 : viewMonth + 1;

  const shiftMonth = (delta) => {
    let m = viewMonth + delta;
    let y = viewYear;
    while (m < 0) {
      m += 12;
      y -= 1;
    }
    while (m > 11) {
      m -= 12;
      y += 1;
    }
    setViewMonth(m);
    setViewYear(y);
  };

  const shiftYear = (delta) => {
    setViewYear((y) => y + delta);
  };

  const handleDayClick = (day) => {
    const clicked = startOfDay(day);
    if (!draftStart || (draftStart && draftEnd)) {
      setDraftStart(clicked);
      setDraftEnd(null);
      setStartInput(formatSlashDate(clicked));
      setEndInput('');
    } else {
      let start = draftStart;
      let end = clicked;
      if (compareDateKeys(clicked, draftStart) < 0) {
        start = clicked;
        end = draftStart;
      }
      setDraftStart(start);
      setDraftEnd(end);
      setStartInput(formatSlashDate(start));
      setEndInput(formatSlashDate(end));
    }
    setDraftPresetId(CUSTOM_DATE_PRESET_ID);
  };

  const pickPreset = (presetId) => {
    const range = resolveDatePresetRange(presetId, new Date(), presetRangeOptions);
    setDraftStart(range.startDate);
    setDraftEnd(range.endDate);
    setDraftPresetId(presetId);
    setStartInput(formatSlashDate(range.startDate));
    setEndInput(formatSlashDate(range.endDate));
    setViewYear(range.startDate.getFullYear());
    setViewMonth(range.startDate.getMonth());
  };

  const commitInput = (which, value) => {
    const parsed = parseSlashDate(value);
    if (!parsed) {
      if (which === 'start' && draftStart) setStartInput(formatSlashDate(draftStart));
      if (which === 'end' && draftEnd) setEndInput(formatSlashDate(draftEnd));
      return;
    }
    setDraftPresetId(CUSTOM_DATE_PRESET_ID);
    if (which === 'start') {
      setDraftStart(parsed);
      setStartInput(formatSlashDate(parsed));
      if (draftEnd && compareDateKeys(parsed, draftEnd) > 0) {
        setDraftEnd(parsed);
        setEndInput(formatSlashDate(parsed));
      }
    } else {
      setDraftEnd(parsed);
      setEndInput(formatSlashDate(parsed));
      if (draftStart && compareDateKeys(parsed, draftStart) < 0) {
        setDraftStart(parsed);
        setStartInput(formatSlashDate(parsed));
      }
    }
  };

  const handleApply = () => {
    const start = draftStart ? startOfDay(draftStart) : startOfDay(startDate);
    const end = draftEnd ? startOfDay(draftEnd) : start;
    onDatePresetChange(draftPresetId);
    onStartDateChange(start);
    onEndDateChange(end);
    setOpen(false);
  };

  const handleCancel = () => {
    syncDraftFromProps();
    setOpen(false);
  };

  const toggleOpen = () => {
    if (open) {
      syncDraftFromProps();
      setOpen(false);
    } else {
      syncDraftFromProps();
      setOpen(true);
    }
  };

  return (
    <div className="st-date-picker" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="st-date-picker__trigger"
        onClick={toggleOpen}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`日期范围：${presetLabel}，${rangeLabel}`}
      >
        <span className="st-date-picker__text">
          <span className="st-date-picker__preset">{presetLabel}</span>
          <span className="st-date-picker__range">{rangeLabel}</span>
        </span>
        <span className="st-date-picker__icon">
          <CalendarIcon />
        </span>
      </button>
      {open ? (
        <div
          className="st-date-picker__popover"
          role="dialog"
          aria-label="选择日期范围"
          style={{ top: popoverPos.top, left: popoverPos.left }}
        >
          <aside className="st-date-picker__presets-sidebar">
            <ul className="st-date-picker__presets-list">
              {DATE_PRESETS.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className={`st-date-picker__preset-item${
                      draftPresetId === p.id ? ' st-date-picker__preset-item--active' : ''
                    }`}
                    onClick={() => pickPreset(p.id)}
                  >
                    <span className="st-date-picker__preset-item-label">{p.label}</span>
                    <span className="st-date-picker__preset-item-range">
                      {getPresetRangeSubtitle(p.id, new Date(), presetRangeOptions)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
          <div className="st-date-picker__main">
            <div className="st-date-picker__inputs">
              <label className="st-date-picker__input-wrap">
                <span className="st-date-picker__input-label">开始日期</span>
                <input
                  type="text"
                  className="st-date-picker__input-field"
                  value={startInput}
                  placeholder="yyyy/mm/dd"
                  onChange={(e) => setStartInput(e.target.value)}
                  onBlur={() => commitInput('start', startInput)}
                />
              </label>
              <label className="st-date-picker__input-wrap">
                <span className="st-date-picker__input-label">结束日期</span>
                <input
                  type="text"
                  className="st-date-picker__input-field"
                  value={endInput}
                  placeholder="yyyy/mm/dd"
                  onChange={(e) => setEndInput(e.target.value)}
                  onBlur={() => commitInput('end', endInput)}
                />
              </label>
            </div>
            <div className="st-date-picker__calendars">
              <div className="st-date-picker__cal-nav">
                <button type="button" className="st-date-picker__nav-btn" onClick={() => shiftYear(-1)} aria-label="上一年">
                  «
                </button>
                <button type="button" className="st-date-picker__nav-btn" onClick={() => shiftMonth(-1)} aria-label="上一月">
                  ‹
                </button>
              </div>
              <div className="st-date-picker__cal-grid">
                <MonthCalendar
                  year={viewYear}
                  month={viewMonth}
                  rangeStart={draftStart}
                  rangeEnd={draftEnd}
                  onDayClick={handleDayClick}
                />
                <MonthCalendar
                  year={rightYear}
                  month={rightMonth}
                  rangeStart={draftStart}
                  rangeEnd={draftEnd}
                  onDayClick={handleDayClick}
                />
              </div>
              <div className="st-date-picker__cal-nav st-date-picker__cal-nav--right">
                <button type="button" className="st-date-picker__nav-btn" onClick={() => shiftMonth(1)} aria-label="下一月">
                  ›
                </button>
                <button type="button" className="st-date-picker__nav-btn" onClick={() => shiftYear(1)} aria-label="下一年">
                  »
                </button>
              </div>
            </div>
            <div className="st-date-picker__footer">
              <select
                className="st-date-picker__granularity"
                value={draftGranularity}
                onChange={(e) => setDraftGranularity(e.target.value)}
                aria-label="粒度"
              >
                {GALLERY_DATE_GRANULARITIES.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
              <div className="st-date-picker__footer-actions">
                <button type="button" className="st-date-picker__btn st-date-picker__btn--cancel" onClick={handleCancel}>
                  取消
                </button>
                <button type="button" className="st-date-picker__btn st-date-picker__btn--apply" onClick={handleApply}>
                  应用
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default GalleryDateRangePicker;
