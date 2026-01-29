import React, { useState, useEffect, useMemo } from 'react';
import { Dropdown, Input, Button, Radio, Checkbox, Space } from 'antd';
import audienceAnalysisData from '../data/audienceAnalysis.json';
import './AudienceAnalysisSelector.css';

function AudienceAnalysisSelector({ value = {}, onChange }) {
  const [open, setOpen] = useState(false);
  const [analysis, setAnalysis] = useState({
    gender: '', // 性别占比（单选）
    ageGroups: [] // 年龄段（多选）
  });

  // 处理数据：分离性别占比和年龄段
  const { genderOptions, ageOptions } = useMemo(() => {
    const genderOptions = [];
    const ageOptions = [];

    audienceAnalysisData.data.forEach(item => {
      if (item.level === 2) {
        // 主分类，跳过
        return;
      }
      
      if (item.parentElementCode === '5008_gender') {
        // 性别占比选项
        genderOptions.push(item);
      } else if (item.parentElementCode === '5008_age') {
        // 年龄段选项
        ageOptions.push(item);
      }
    });

    // 排序：性别选项按 orderNum 从大到小（男性在前，女性在后）
    genderOptions.sort((a, b) => (b.orderNum || 0) - (a.orderNum || 0));
    // 年龄段按 orderNum 从大到小
    ageOptions.sort((a, b) => (b.orderNum || 0) - (a.orderNum || 0));

    return { genderOptions, ageOptions };
  }, []);

  // 当外部 value 变化时更新内部状态
  useEffect(() => {
    if (value) {
      setAnalysis({
        gender: value.gender || '',
        ageGroups: value.ageGroups || []
      });
    }
  }, [value]);

  // 处理性别占比选择（单选）
  const handleGenderChange = (e) => {
    const genderCode = e.target.value;
    const newAnalysis = { ...analysis, gender: genderCode };
    setAnalysis(newAnalysis);
    onChange(newAnalysis);
  };

  // 处理年龄段选择（多选）
  const handleAgeGroupToggle = (ageCode) => {
    const newAgeGroups = analysis.ageGroups.includes(ageCode)
      ? analysis.ageGroups.filter(a => a !== ageCode)
      : [...analysis.ageGroups, ageCode];
    const newAnalysis = { ...analysis, ageGroups: newAgeGroups };
    setAnalysis(newAnalysis);
    onChange(newAnalysis);
  };

  // 重置选择
  const handleReset = () => {
    const emptyAnalysis = {
      gender: '',
      ageGroups: []
    };
    setAnalysis(emptyAnalysis);
    onChange(emptyAnalysis);
  };

  // 确认选择
  const handleConfirm = () => {
    setOpen(false);
  };

  // 获取显示文本
  const displayText = useMemo(() => {
    const parts = [];
    if (analysis.gender) {
      const gender = genderOptions.find(g => g.ccode === analysis.gender);
      if (gender) parts.push(gender.nameCn);
    }
    if (analysis.ageGroups.length > 0) {
      const ageNames = analysis.ageGroups.map(code => {
        const age = ageOptions.find(a => a.ccode === code);
        return age ? age.nameCn : code;
      });
      parts.push(ageNames.join(', '));
    }
    return parts.length > 0 ? parts.join(' | ') : '受众分析';
  }, [analysis, genderOptions, ageOptions]);

  // 下拉面板内容
  const dropdownContent = (
    <div className="audience-analysis-dropdown">
      <div className="analysis-content">
        {/* 性别占比 */}
        <div className="analysis-section">
          <div className="section-label">性别占比</div>
          <Radio.Group
            value={analysis.gender}
            onChange={handleGenderChange}
            className="gender-radio-group"
          >
            <div className="gender-options">
              {genderOptions.map(option => (
                <Radio key={option.elementCode} value={option.ccode} className="gender-radio">
                  {option.nameCn}
                </Radio>
              ))}
            </div>
          </Radio.Group>
        </div>

        {/* 年龄段 */}
        <div className="analysis-section">
          <div className="section-label">年龄段</div>
          <div className="age-options">
            <Space size={8} wrap>
              {ageOptions.map(option => {
                const isSelected = analysis.ageGroups.includes(option.ccode);
                return (
                  <Checkbox
                    key={option.elementCode}
                    checked={isSelected}
                    onChange={() => handleAgeGroupToggle(option.ccode)}
                    className="age-checkbox"
                  >
                    {option.nameCn}
                  </Checkbox>
                );
              })}
            </Space>
          </div>
        </div>
      </div>

      <div className="analysis-footer">
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
      <div className="audience-analysis-selector-trigger">
        <Input
          readOnly
          value={displayText}
          placeholder="受众分析"
          onClick={() => setOpen(!open)}
          className="audience-analysis-input"
        />
      </div>
    </Dropdown>
  );
}

export default AudienceAnalysisSelector;
