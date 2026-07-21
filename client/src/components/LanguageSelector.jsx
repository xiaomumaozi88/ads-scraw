import React, { useMemo } from 'react';
import { Select } from 'antd';
import languageData from '../data/language.json';

function LanguageSelector({ value, onChange }) {
  const options = useMemo(() => {
    const seenCcodes = new Set();
    const allLanguages = languageData.data.filter((lang) => {
      if (!lang.ccode || seenCcodes.has(lang.ccode)) return false;
      seenCcodes.add(lang.ccode);
      return true;
    });

    const grouped = {};
    allLanguages.forEach((lang) => {
      const firstLetter = (lang.nameEn || lang.nameCn || '').charAt(0).toUpperCase();
      const letter = !firstLetter || !/^[A-Z]$/.test(firstLetter) ? '#' : firstLetter;
      if (!grouped[letter]) grouped[letter] = [];
      grouped[letter].push(lang);
    });

    Object.keys(grouped).forEach((letter) => {
      grouped[letter].sort((a, b) => a.nameCn.localeCompare(b.nameCn, 'zh-CN'));
    });

    const sortedLetters = Object.keys(grouped).sort((a, b) => {
      if (a === '#') return 1;
      if (b === '#') return -1;
      return a.localeCompare(b);
    });

    return [
      {
        label: '全部 (默认)',
        value: '',
        key: 'language-all',
      },
      ...sortedLetters.map((letter) => ({
        label: letter,
        options: grouped[letter].map((lang) => ({
          key: lang.elementCode || lang.ccode,
          label: lang.nameCn,
          value: lang.ccode,
        })),
      })),
    ];
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
