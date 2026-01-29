import React, { useState, useEffect } from 'react';
import { Checkbox, Button } from 'antd';
import { GUANGDADA_FB_AUDIENCE_GENDER, GUANGDADA_FB_AUDIENCE_AGE } from '../data/guangdadaFbAudience';

const defaultValue = { gender: [], age: [] };

function GuangdadaFbAudiencePopover({ value = defaultValue, onChange, onConfirm, onCancel, open }) {
  const [draft, setDraft] = useState(() => ({
    gender: [...(value?.gender || [])],
    age: [...(value?.age || [])],
  }));

  useEffect(() => {
    if (open) {
      setDraft({
        gender: [...(value?.gender || [])],
        age: [...(value?.age || [])],
      });
    }
  }, [open, value]);

  const handleGenderChange = (checkedValues) => {
    setDraft((prev) => ({ ...prev, gender: checkedValues }));
  };

  const handleAgeChange = (checkedValues) => {
    setDraft((prev) => ({ ...prev, age: checkedValues }));
  };

  const handleConfirm = () => {
    onChange({ gender: draft.gender, age: draft.age });
    onConfirm?.();
  };

  return (
    <div className="guangdada-fb-audience-popover">
      <div className="guangdada-fb-audience-popover-content">
        <div className="guangdada-fb-audience-popover-grid">
          <div className="guangdada-fb-audience-popover-label">性别</div>
          <Checkbox.Group
            value={draft.gender}
            onChange={handleGenderChange}
            className="guangdada-fb-audience-popover-group"
          >
            {GUANGDADA_FB_AUDIENCE_GENDER.map((item) => (
              <Checkbox key={item.value} value={item.value} className="guangdada-fb-audience-popover-checkbox">
                {item.label}
              </Checkbox>
            ))}
          </Checkbox.Group>
          <div className="guangdada-fb-audience-popover-label">年龄</div>
          <Checkbox.Group
            value={draft.age}
            onChange={handleAgeChange}
            className="guangdada-fb-audience-popover-group"
          >
            {GUANGDADA_FB_AUDIENCE_AGE.map((item) => (
              <Checkbox key={item.value} value={item.value} className="guangdada-fb-audience-popover-checkbox">
                {item.label}
              </Checkbox>
            ))}
          </Checkbox.Group>
        </div>
      </div>
      <div className="guangdada-fb-audience-popover-footer">
        <Button onClick={onCancel}>取 消</Button>
        <Button type="primary" onClick={handleConfirm}>
          确 定
        </Button>
      </div>
    </div>
  );
}

export default GuangdadaFbAudiencePopover;
