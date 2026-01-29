import React, { useMemo } from 'react';
import { Select } from 'antd';
import languageData from '../data/language.json';

function LanguageSelector({ value, onChange }) {
  // 处理数据：按英文名称的首字母分组
  const options = useMemo(() => {
    const allLanguages = [...languageData.data];
    
    // 按英文名称的首字母分组
    const grouped = {};
    allLanguages.forEach(lang => {
      const firstLetter = (lang.nameEn || lang.nameCn || '').charAt(0).toUpperCase();
      if (!firstLetter || !/^[A-Z]$/.test(firstLetter)) {
        // 如果不是A-Z，归入其他
        const otherKey = '#';
        if (!grouped[otherKey]) {
          grouped[otherKey] = [];
        }
        grouped[otherKey].push(lang);
      } else {
        if (!grouped[firstLetter]) {
          grouped[firstLetter] = [];
        }
        grouped[firstLetter].push(lang);
      }
    });
    
    // 对每个字母组内的语言按中文名称排序
    Object.keys(grouped).forEach(letter => {
      grouped[letter].sort((a, b) => a.nameCn.localeCompare(b.nameCn, 'zh-CN'));
    });
    
    // 获取所有字母并排序（#放在最后）
    const sortedLetters = Object.keys(grouped).sort((a, b) => {
      if (a === '#') return 1;
      if (b === '#') return -1;
      return a.localeCompare(b);
    });
    
    // 转换为 antd Select 的 options 格式（使用 optgroup）
    const options = [
      {
        label: '全部 (默认)',
        value: '',
      },
      ...sortedLetters.map(letter => ({
        label: letter,
        options: grouped[letter].map(lang => ({
          label: lang.nameCn,
          value: lang.ccode,
        }))
      }))
    ];
    
    return options;
  }, []);

  return (
    <Select
      value={value || ''}
      onChange={onChange}
      options={options}
      placeholder="标题语言"
      showSearch
      filterOption={(input, option) => {
        // 对于分组标题，不进行过滤
        if (option.options) return true;
        return (option?.label ?? '').toLowerCase().includes(input.toLowerCase());
      }}
      style={{ width: '100%' }}
    />
  );
}

export default LanguageSelector;
