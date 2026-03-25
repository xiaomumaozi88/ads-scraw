/**
 * 国内版 BBA ad-info「创意类型」级联选项（与广大大前端结构一致）
 *
 * - 「所有创意类型」→ API creative_type = 0（表单内用 undefined 表示未选细分）
 * - 「视频」→ 2
 * - 「图片」子项 → 单图 10、双图 11、三图 12、多图 13
 *
 * 若线上接口返回值与预期不符，只需改本文件中的 value 映射。
 */

export const DOMESTIC_CREATIVE_TYPE_PARENT_IMAGE = '__domestic_creative_image__';

/** Ant Design Cascader 用（value 统一为 string，避免 number/string 混用） */
export const DOMESTIC_CREATIVE_TYPE_CASCADER_OPTIONS = [
  { value: '0', label: '所有创意类型' },
  {
    value: DOMESTIC_CREATIVE_TYPE_PARENT_IMAGE,
    label: '图片',
    children: [
      { value: '10', label: '单图' },
      { value: '11', label: '双图' },
      { value: '12', label: '三图' },
      { value: '13', label: '多图' },
    ],
  },
  { value: '2', label: '视频' },
];

const LEAF_LABEL_BY_API = {
  0: '所有创意类型',
  2: '视频',
  10: '单图',
  11: '双图',
  12: '三图',
  13: '多图',
};

/** 表单 / API 用的数字 → Cascader value 路径 */
export function domesticCreativeTypeToCascaderPath(api) {
  if (api == null || api === '' || Number(api) === 0) return ['0'];
  const n = Number(api);
  if (!Number.isFinite(n)) return ['0'];
  if (n === 2) return ['2'];
  if ([10, 11, 12, 13].includes(n)) return [DOMESTIC_CREATIVE_TYPE_PARENT_IMAGE, String(n)];
  return ['0'];
}

/** Cascader onChange 路径 → 表单 state（未选细分用 undefined，请求层仍会变成 0） */
export function cascaderPathToDomesticCreativeType(path) {
  if (!path?.length) return undefined;
  const last = path[path.length - 1];
  if (last === '0') return undefined;
  const num = Number(last);
  return Number.isFinite(num) ? num : undefined;
}

/** 已选条件标签、Cascader 展示用 */
export function domesticCreativeTypeDisplayLabel(api) {
  if (api == null || api === '' || Number(api) === 0) return '所有创意类型';
  const n = Number(api);
  if (!Number.isFinite(n)) return String(api);
  if ([10, 11, 12, 13].includes(n)) {
    const leaf = LEAF_LABEL_BY_API[n] ?? String(n);
    return `图片 / ${leaf}`;
  }
  return LEAF_LABEL_BY_API[n] ?? String(n);
}

/** 详情/列表展示用：仅素材类型短文案（单图、视频等） */
export function domesticMaterialTypeLabel(type) {
  const n = Number(type);
  if (!Number.isFinite(n)) return '—';
  return LEAF_LABEL_BY_API[n] ?? '—';
}
