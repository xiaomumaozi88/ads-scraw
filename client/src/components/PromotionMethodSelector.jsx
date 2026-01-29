import React, { useMemo } from 'react';
import { Cascader } from 'antd';
import promotionMethodData from '../data/promotionMethod.json';
import './PromotionMethodSelector.css';

function PromotionMethodSelector({ value = [], onChange }) {
  // 将数据转换为 antd Cascader 需要的格式
  const options = useMemo(() => {
    const mainOptions = [];
    const subOptionsByMain = {};

    // 先收集所有主选项和子选项
    promotionMethodData.data.forEach(item => {
      if (item.level === 1 && !item.parentElementCode) {
        // 主选项（如"应用下载"、"应用唤起"等）
        mainOptions.push(item);
        subOptionsByMain[item.elementCode] = [];
      } else if (item.level === 2 && item.parentElementCode) {
        // 子选项（如"苹果应用商店跳转"等）
        if (!subOptionsByMain[item.parentElementCode]) {
          subOptionsByMain[item.parentElementCode] = [];
        }
        subOptionsByMain[item.parentElementCode].push(item);
      }
    });

    // 按 orderNum 排序
    mainOptions.sort((a, b) => (a.orderNum || 0) - (b.orderNum || 0));
    Object.keys(subOptionsByMain).forEach(key => {
      subOptionsByMain[key].sort((a, b) => (a.orderNum || 0) - (b.orderNum || 0));
    });

    // 转换为 antd Cascader 格式
    return mainOptions.map(mainOption => ({
      value: mainOption.elementCode,
      label: mainOption.nameCn,
      children: (subOptionsByMain[mainOption.elementCode] || []).map(subOption => ({
        value: subOption.ccode,
        label: subOption.nameCn,
      }))
    }));
  }, []);

  // 将 value (方法代码数组) 转换为 Cascader 需要的路径格式
  const cascaderValue = useMemo(() => {
    if (!value || value.length === 0) return [];
    
    // 建立方法代码到路径的映射
    const methodToPathMap = {};
    promotionMethodData.data.forEach(item => {
      if (item.level === 2 && item.parentElementCode) {
        methodToPathMap[item.ccode] = [item.parentElementCode, item.ccode];
      }
    });
    
    // 为每个选中的方法代码找到对应的路径
    return value
      .map(methodCode => methodToPathMap[methodCode])
      .filter(Boolean);
  }, [value]);

  // 处理 Cascader 的变化
  const handleChange = (selectedPaths, selectedOptions) => {
    // selectedPaths 是二维数组，例如 [[mainCode1, subCode1], [mainCode2, subCode2]]
    // 我们需要提取所有的子选项代码
    const methodCodes = selectedPaths.map(path => path[1]).filter(Boolean);
    onChange(methodCodes);
  };

  return (
    <Cascader
      options={options}
      value={cascaderValue}
      onChange={handleChange}
      multiple
      maxTagCount="responsive"
      expandTrigger="hover"
      placeholder="搜索推广方式"
      showSearch={{
        filter: (inputValue, path) => {
          return path.some(option => 
            option.label.toLowerCase().includes(inputValue.toLowerCase())
          );
        }
      }}
      style={{ width: '100%' }}
      popupClassName="promotion-method-cascader-popup"
    />
  );
}

export default PromotionMethodSelector;
