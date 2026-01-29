import React, { useState, useMemo, useEffect } from 'react';
import { Dropdown, Checkbox, Row, Col, Button, Input } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import gameThemeData from '../data/gameTheme.json';
import './GameThemeSelector.css';

const { Search } = Input;

function GameThemeSelector({ value = [], onChange }) {
  const [open, setOpen] = useState(false);
  const [selectedThemes, setSelectedThemes] = useState(new Set(value));
  const [searchText, setSearchText] = useState('');

  // 处理数据：按 orderNum 排序
  const gameThemes = useMemo(() => {
    return [...gameThemeData.data].sort((a, b) => (b.orderNum || 0) - (a.orderNum || 0));
  }, []);

  // 过滤后的题材列表
  const filteredThemes = useMemo(() => {
    if (!searchText) return gameThemes;
    const lowerSearch = searchText.toLowerCase();
    return gameThemes.filter(theme =>
      theme.nameCn.toLowerCase().includes(lowerSearch) ||
      theme.nameEn?.toLowerCase().includes(lowerSearch)
    );
  }, [gameThemes, searchText]);

  // 将题材列表分成三列
  const themesByColumn = useMemo(() => {
    const column1 = [];
    const column2 = [];
    const column3 = [];
    
    filteredThemes.forEach((theme, index) => {
      if (index % 3 === 0) {
        column1.push(theme);
      } else if (index % 3 === 1) {
        column2.push(theme);
      } else {
        column3.push(theme);
      }
    });
    
    return [column1, column2, column3];
  }, [filteredThemes]);

  // 当外部 value 变化时更新内部状态
  useEffect(() => {
    setSelectedThemes(new Set(value));
  }, [value]);

  // 切换题材选择
  const handleThemeChange = (themeCode, checked) => {
    const newSet = new Set(selectedThemes);
    if (checked) {
      newSet.add(themeCode);
    } else {
      newSet.delete(themeCode);
    }
    setSelectedThemes(newSet);
  };

  // 重置选择
  const handleReset = () => {
    setSelectedThemes(new Set());
    setSearchText('');
    onChange([]);
  };

  // 确认选择
  const handleConfirm = () => {
    onChange(Array.from(selectedThemes));
    setOpen(false);
    setSearchText('');
  };

  // 获取显示文本
  const displayText = useMemo(() => {
    if (selectedThemes.size === 0) {
      return '搜索游戏题材';
    }
    if (selectedThemes.size <= 3) {
      const themeNames = Array.from(selectedThemes).map(code => {
        const theme = gameThemes.find(t => t.ccode === code);
        return theme ? theme.nameCn : code;
      });
      return themeNames.join(', ');
    }
    return `已选择 ${selectedThemes.size} 个题材`;
  }, [selectedThemes, gameThemes]);

  // 下拉面板内容
  const dropdownContent = (
    <div className="game-theme-dropdown">
      <div className="dropdown-search">
        <Search
          placeholder="搜索游戏题材"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          prefix={<SearchOutlined />}
          style={{ marginBottom: 12 }}
        />
      </div>
      
      <div className="dropdown-content">
        <Row gutter={[16, 8]}>
          {themesByColumn.map((column, colIndex) => (
            <Col span={8} key={colIndex}>
              <div className="themes-column">
                {column.map(theme => (
                  <Checkbox
                    key={theme.elementCode}
                    checked={selectedThemes.has(theme.ccode)}
                    onChange={(e) => handleThemeChange(theme.ccode, e.target.checked)}
                    className="theme-checkbox-item"
                  >
                    {theme.nameCn}
                  </Checkbox>
                ))}
              </div>
            </Col>
          ))}
        </Row>
      </div>
      
      <div className="dropdown-footer">
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
      <div className="game-theme-selector-trigger">
        <Input
          readOnly
          value={displayText}
          placeholder="搜索游戏题材"
          onClick={() => setOpen(!open)}
          className="game-theme-input"
        />
      </div>
    </Dropdown>
  );
}

export default GameThemeSelector;
