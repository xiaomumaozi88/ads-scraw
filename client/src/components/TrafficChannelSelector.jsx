import React, { useState, useMemo, useEffect } from 'react';
import { Tree, Input, Button, Dropdown } from 'antd';
import { SearchOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import channelData from '../data/type2.json';
import './TrafficChannelSelector.css';

const { Search } = Input;

function TrafficChannelSelector({ value = [], onChange }) {
  const [open, setOpen] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState([]);
  const [searchValue, setSearchValue] = useState('');
  const [autoExpandParent, setAutoExpandParent] = useState(true);

  // 处理数据：转换为 Tree 组件需要的格式
  const { treeData, keyToChannelMap, platformToChannelMap } = useMemo(() => {
    const platforms = [];
    const channelsByPlatform = {};
    const keyToChannelMap = {};
    const platformToChannelMap = {}; // 平台 key 到子渠道 key 的映射（用于处理隐藏子项的情况）

    // 收集所有平台（level 2，parentElementCode 为 null 或 ""）
    channelData.data.forEach(item => {
      if (item.level === 2 && (item.parentElementCode === null || item.parentElementCode === '')) {
        platforms.push(item);
        channelsByPlatform[item.elementCode] = [];
        keyToChannelMap[item.ccode] = item;
      }
    });

    // 收集所有子渠道（level 3）
    channelData.data.forEach(item => {
      if (item.level === 3 && item.parentElementCode) {
        if (!channelsByPlatform[item.parentElementCode]) {
          channelsByPlatform[item.parentElementCode] = [];
        }
        channelsByPlatform[item.parentElementCode].push(item);
        keyToChannelMap[item.ccode] = item;
      }
    });

    // 按 orderNum 排序
    platforms.sort((a, b) => (a.orderNum || 0) - (b.orderNum || 0));
    Object.keys(channelsByPlatform).forEach(key => {
      channelsByPlatform[key].sort((a, b) => (a.orderNum || 0) - (b.orderNum || 0));
    });

    // 转换为 Tree 格式
    const treeData = platforms.map(platform => {
      const channels = channelsByPlatform[platform.elementCode] || [];
      
      // 如果只有一个子渠道，且子渠道名称与平台名称相同，则不显示子渠道
      const shouldHideChildren = channels.length === 1 && 
                                 channels[0].nameCn === platform.nameCn;
      
      // 如果隐藏子项，记录映射关系（选择平台时应该选择子渠道）
      if (shouldHideChildren) {
        platformToChannelMap[platform.ccode] = channels[0].ccode;
      }
      
      return {
        title: (
          <div className="tree-platform-item">
            {platform.colorIcon && (
              <img 
                src={platform.colorIcon} 
                alt={platform.nameCn}
                className="tree-platform-icon"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            )}
            <span className="tree-platform-name">{platform.nameCn}</span>
            {platform.nameCn === 'Facebook Ads' && (
              <span className="tree-platform-note">
                (Instagram、Messenger、Audience Network等渠道素材合并在Facebook(FB)中展示)
              </span>
            )}
          </div>
        ),
        key: platform.ccode,
        // 如果应该隐藏子项，则不设置 children
        children: shouldHideChildren ? undefined : (channels.length > 0 ? channels.map(channel => ({
          title: (
            <div className="tree-channel-item">
              {channel.colorIcon && (
                <img 
                  src={channel.colorIcon} 
                  alt={channel.nameCn}
                  className="tree-channel-icon"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              )}
              <span className="tree-channel-name">{channel.nameCn}</span>
            </div>
          ),
          key: channel.ccode,
        })) : undefined),
      };
    });

    return { treeData, keyToChannelMap, platformToChannelMap };
  }, []);

  // 根据搜索值过滤树数据
  const filteredTreeData = useMemo(() => {
    if (!searchValue) return treeData;

    const filterTree = (nodes) => {
      return nodes
        .map(node => {
          const title = keyToChannelMap[node.key]?.nameCn || '';
          const match = title.toLowerCase().includes(searchValue.toLowerCase());
          
          const children = node.children ? filterTree(node.children) : undefined;
          const hasMatchingChild = children && children.length > 0;

          if (match || hasMatchingChild) {
            return {
              ...node,
              children: hasMatchingChild ? children : node.children,
            };
          }
          return null;
        })
        .filter(Boolean);
    };

    return filterTree(treeData);
  }, [treeData, searchValue, keyToChannelMap]);

  // 处理展开/收起
  const onExpand = (expandedKeysValue) => {
    setExpandedKeys(expandedKeysValue);
    setAutoExpandParent(false);
  };

  // 处理选择变化
  const onCheck = (checkedKeys, info) => {
    const newSelectedKeys = new Set(checkedKeys);
    
    // 处理隐藏子项的情况：如果选择了平台，应该选择对应的子渠道
    Object.keys(platformToChannelMap).forEach(platformKey => {
      const channelKey = platformToChannelMap[platformKey];
      if (newSelectedKeys.has(platformKey)) {
        // 选择了平台，自动选择子渠道
        newSelectedKeys.add(channelKey);
      } else {
        // 取消选择平台，自动取消选择子渠道
        newSelectedKeys.delete(channelKey);
      }
    });
    
    // 处理子渠道选择：如果选择了子渠道，应该选择对应的平台
    Object.keys(platformToChannelMap).forEach(platformKey => {
      const channelKey = platformToChannelMap[platformKey];
      if (newSelectedKeys.has(channelKey)) {
        // 选择了子渠道，自动选择平台
        newSelectedKeys.add(platformKey);
      } else {
        // 取消选择子渠道，自动取消选择平台
        newSelectedKeys.delete(platformKey);
      }
    });
    
    // 检查是否有平台被选中/取消选中（有多个子渠道的情况）
    treeData.forEach(platform => {
      const platformKey = platform.key;
      // 跳过已经处理过的隐藏子项的平台
      if (platformToChannelMap[platformKey]) return;
      
      const wasChecked = value.includes(platformKey);
      const isChecked = newSelectedKeys.has(platformKey);
      
      if (wasChecked !== isChecked && platform.children) {
        // 平台状态改变，同步所有子渠道
        platform.children.forEach(child => {
          if (isChecked) {
            newSelectedKeys.add(child.key);
          } else {
            newSelectedKeys.delete(child.key);
          }
        });
      }
    });

    // 检查是否有子渠道被选中/取消选中，更新平台状态（有多个子渠道的情况）
    treeData.forEach(platform => {
      // 跳过已经处理过的隐藏子项的平台
      if (platformToChannelMap[platform.key]) return;
      
      if (platform.children && platform.children.length > 0) {
        const allSelected = platform.children.every(child => 
          newSelectedKeys.has(child.key)
        );
        if (allSelected) {
          newSelectedKeys.add(platform.key);
        } else {
          newSelectedKeys.delete(platform.key);
        }
      }
    });

    // 对于隐藏子项的平台，返回子渠道的 key 而不是平台的 key
    const finalSelectedKeys = Array.from(newSelectedKeys).map(key => {
      // 如果这个 key 是隐藏子项的平台 key，返回对应的子渠道 key
      if (platformToChannelMap[key]) {
        return platformToChannelMap[key];
      }
      return key;
    }).filter((key, index, arr) => arr.indexOf(key) === index); // 去重

    onChange(finalSelectedKeys);
  };

  // 初始化展开所有节点
  useEffect(() => {
    if (open) {
      const allKeys = treeData.map(p => p.key);
      setExpandedKeys(allKeys);
    }
  }, [open, treeData]);

  // 重置选择
  const handleReset = () => {
    onChange([]);
    setSearchValue('');
  };

  // 确认选择
  const handleConfirm = () => {
    setOpen(false);
    setSearchValue('');
  };

  // 获取显示文本
  const displayText = useMemo(() => {
    if (value.length === 0) {
      return '搜索流量渠道';
    }
    if (value.length <= 3) {
      const channelNames = value.map(code => {
        const item = keyToChannelMap[code];
        return item ? item.nameCn : code;
      });
      return channelNames.join(', ');
    }
    return `已选择 ${value.length} 个渠道`;
  }, [value, keyToChannelMap]);

  // 下拉面板内容
  const dropdownContent = (
    <div className="traffic-channel-dropdown">
      <div className="dropdown-header">
        <div className="dropdown-title">全球渠道</div>
        <div className="dropdown-search">
          <Search
            placeholder="搜索流量渠道"
            value={searchValue}
            onChange={(e) => {
              setSearchValue(e.target.value);
              if (e.target.value) {
                const allKeys = treeData.map(p => p.key);
                setExpandedKeys(allKeys);
                setAutoExpandParent(true);
              }
            }}
            prefix={<SearchOutlined />}
            suffix={<QuestionCircleOutlined style={{ color: '#999', cursor: 'help' }} />}
          />
        </div>
      </div>
      
      <div className="dropdown-content">
        <Tree
          checkable
          checkedKeys={(() => {
            // 将 value 中的子渠道 key 转换为平台 key（用于隐藏子项的情况）
            const channelToPlatformMap = {};
            Object.keys(platformToChannelMap).forEach(platformKey => {
              channelToPlatformMap[platformToChannelMap[platformKey]] = platformKey;
            });
            
            return value.map(key => {
              // 如果这个 key 是隐藏子项的子渠道 key，返回对应的平台 key
              if (channelToPlatformMap[key]) {
                return channelToPlatformMap[key];
              }
              return key;
            });
          })()}
          onCheck={onCheck}
          expandedKeys={expandedKeys}
          autoExpandParent={autoExpandParent}
          onExpand={onExpand}
          treeData={filteredTreeData}
          className="traffic-channel-tree"
        />
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
      <div className="traffic-channel-selector-trigger">
        <Input
          readOnly
          value={displayText}
          placeholder="搜索流量渠道"
          onClick={() => setOpen(!open)}
          className="traffic-channel-input"
        />
      </div>
    </Dropdown>
  );
}

export default TrafficChannelSelector;
