import React, { useState, useEffect, useMemo } from 'react';
import { Dropdown, Input, Button, Space } from 'antd';
import callToActionData from '../data/callToAction.json';
import './CallToActionSelector.css';

function CallToActionSelector({ value = [], onChange }) {
  const [open, setOpen] = useState(false);
  const [selectedActions, setSelectedActions] = useState(new Set(value));

  // 处理数据：分离分类和选项，按指定顺序排列
  const { categories, actionsByCategory } = useMemo(() => {
    const categories = [];
    const actionsByCategory = {};

    // 先收集所有分类
    callToActionData.data.forEach(item => {
      if (item.level === 2 && !item.parentElementCode) {
        // 主分类
        categories.push(item);
        actionsByCategory[item.elementCode] = [];
      }
    });

    // 再收集所有子选项
    callToActionData.data.forEach(item => {
      if (item.level === 3 && item.parentElementCode) {
        // 子选项
        if (!actionsByCategory[item.parentElementCode]) {
          actionsByCategory[item.parentElementCode] = [];
        }
        actionsByCategory[item.parentElementCode].push(item);
      }
    });

    // 排序：按 orderNum 从大到小排序（其他 -> 互动 -> 了解更多 -> 购物 -> 下载 -> 销售线索）
    categories.sort((a, b) => (b.orderNum || 0) - (a.orderNum || 0));

    // 子选项排序：倒转（从大到小）
    Object.keys(actionsByCategory).forEach(key => {
      actionsByCategory[key].sort((a, b) => (b.orderNum || 0) - (a.orderNum || 0));
    });

    return { categories, actionsByCategory };
  }, []);

  // 当外部 value 变化时更新内部状态
  useEffect(() => {
    setSelectedActions(new Set(value));
  }, [value]);

  // 切换选项选择
  const toggleAction = (actionCode) => {
    const newSet = new Set(selectedActions);
    if (newSet.has(actionCode)) {
      newSet.delete(actionCode);
    } else {
      newSet.add(actionCode);
    }
    setSelectedActions(newSet);
  };

  // 处理"全部 (默认)"点击
  const handleSelectAll = () => {
    setSelectedActions(new Set());
    onChange([]);
  };

  // 重置选择
  const handleReset = () => {
    setSelectedActions(new Set());
    onChange([]);
  };

  // 确认选择
  const handleConfirm = () => {
    onChange(Array.from(selectedActions));
    setOpen(false);
  };

  // 获取显示文本
  const displayText = useMemo(() => {
    if (selectedActions.size === 0) {
      return '行动号召';
    }
    if (selectedActions.size <= 3) {
      const actionNames = Array.from(selectedActions).map(code => {
        let action = null;
        Object.values(actionsByCategory).forEach(actions => {
          const found = actions.find(a => a.ccode === code);
          if (found) action = found;
        });
        return action ? action.nameCn : code;
      });
      return actionNames.join(', ');
    }
    return `已选择 ${selectedActions.size} 个行动号召`;
  }, [selectedActions, actionsByCategory]);

  // 下拉面板内容
  const dropdownContent = (
    <div className="call-to-action-dropdown">
      <div className="call-to-action-content">
        {/* 全部 (默认) 选项 */}
        <div className="action-all-option">
          <span
            className={`action-all-link ${selectedActions.size === 0 ? 'active' : ''}`}
            onClick={handleSelectAll}
          >
            全部 (默认)
          </span>
        </div>

        {/* 按分类显示 */}
        {categories.map((category, index) => {
          const actions = actionsByCategory[category.elementCode] || [];
          if (actions.length === 0) return null;

          return (
            <div key={category.elementCode} className="action-category-section">
              {index > 0 && <div className="category-divider"></div>}
              <div className="category-header">{category.nameCn}</div>
              <div className="category-actions">
                <Space size={8} wrap>
                  {actions.map(action => {
                    const isSelected = selectedActions.has(action.ccode);
                    return (
                      <span
                        key={action.elementCode}
                        className={`action-tag ${isSelected ? 'selected' : ''}`}
                        onClick={() => toggleAction(action.ccode)}
                      >
                        {action.nameCn}
                      </span>
                    );
                  })}
                </Space>
              </div>
            </div>
          );
        })}
      </div>

      <div className="call-to-action-footer">
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
      <div className="call-to-action-selector-trigger">
        <Input
          readOnly
          value={displayText}
          placeholder="行动号召"
          onClick={() => setOpen(!open)}
          className="call-to-action-input"
        />
      </div>
    </Dropdown>
  );
}

export default CallToActionSelector;
