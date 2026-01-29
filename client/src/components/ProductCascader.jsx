import React, { useMemo } from 'react';
import { Cascader } from 'antd';
import type5Data from '../data/type5.json';
import './ProductCascader.css';

function ProductCascader({ value = [], onChange }) {
  // 行业类型数据（type5.json）：level 2 为主分类（游戏、泛娱乐等），level 3 为子分类（卡牌、RPG 等）
  const options = useMemo(() => {
    const categories = [];
    const productsByCategory = {};

    // 先收集所有主分类和子分类
    type5Data.data.forEach(item => {
      if (item.level === 2 && (item.parentElementCode === '' || item.parentElementCode === null)) {
        // 主分类（如"游戏"、"电商"）
        categories.push(item);
        productsByCategory[item.elementCode] = [];
      } else if (item.level === 3 && item.parentElementCode) {
        // 子分类（如"RPG"、"策略"）
        if (!productsByCategory[item.parentElementCode]) {
          productsByCategory[item.parentElementCode] = [];
        }
        productsByCategory[item.parentElementCode].push(item);
      }
    });

    // 按 orderNum 排序
    categories.sort((a, b) => (b.orderNum || 0) - (a.orderNum || 0));
    Object.keys(productsByCategory).forEach(key => {
      productsByCategory[key].sort((a, b) => (a.orderNum || 0) - (b.orderNum || 0));
    });

    // 转换为 antd Cascader 格式
    return categories.map(category => ({
      value: category.elementCode,
      label: category.nameCn,
      children: (productsByCategory[category.elementCode] || []).map(product => ({
        value: product.ccode,
        label: product.nameCn,
      }))
    }));
  }, []);

  // 将 value (产品代码数组) 转换为 Cascader 需要的路径格式
  const cascaderValue = useMemo(() => {
    if (!value || value.length === 0) return [];
    
    // 建立行业/产品代码到路径的映射
    const productToPathMap = {};
    type5Data.data.forEach(item => {
      if (item.level === 3 && item.parentElementCode) {
        productToPathMap[item.ccode] = [item.parentElementCode, item.ccode];
      }
    });
    
    // 为每个选中的产品代码找到对应的路径
    return value
      .map(productCode => productToPathMap[productCode])
      .filter(Boolean);
  }, [value]);

  // 处理 Cascader 的变化
  const handleChange = (selectedPaths, selectedOptions) => {
    // selectedPaths 是二维数组，例如 [[categoryCode1, productCode1], [categoryCode2, productCode2]]
    // 我们需要提取所有的产品代码
    const productCodes = selectedPaths.map(path => path[1]).filter(Boolean);
    onChange(productCodes);
  };

  return (
    <Cascader
      options={options}
      value={cascaderValue}
      onChange={handleChange}
      multiple
      maxTagCount="responsive"
      expandTrigger="hover"
      placeholder="搜索行业类型"
      showSearch={{
        filter: (inputValue, path) => {
          return path.some(option => 
            option.label.toLowerCase().includes(inputValue.toLowerCase())
          );
        }
      }}
      style={{ width: '100%' }}
      popupClassName="product-cascader-popup"
    />
  );
}

export default ProductCascader;
