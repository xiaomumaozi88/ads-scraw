/**
 * IAM data_url 目录：角色、业务线、数据源。
 * code 创建后保持稳定，名称与描述可按需调整。
 */

export const IAM_DATA_SOURCE_CODES = {
  INSIGHTRACKR: 'insightrackr',
  SENSORTOWER: 'sensortower',
  GUANGDADA: 'guangdada',
  MATERIAL_TOOLS: 'material_tools',
  HEALTH_ADMIN: 'health_admin',
  EXTERNAL_API: 'external_api',
};

export function buildIamCatalog() {
  return {
    roles: [
      {
        code: 'super_admin',
        name: '超级管理员',
        description: '拥有全部模块与运维权限（含系统健康、操作审计、转码队列）',
        enabled: true,
      },
      {
        code: 'employee',
        name: '普通员工',
        description: '仅素材处理（尺寸修改、处理历史）',
        enabled: true,
      },
      {
        code: 'related_employee',
        name: '业务相关人员',
        description: '可访问除运维管理和 Sensor Tower 外的业务模块（热云、广大大、素材处理）',
        enabled: true,
      },
    ],
    business_lines: [],
    data_sources: [
      {
        code: IAM_DATA_SOURCE_CODES.INSIGHTRACKR,
        name: 'Insightrackr 数据',
        description: 'Insightrackr 广告数据查询',
        access_scopes: ['ALL'],
        supported_products: null,
        enabled: true,
      },
      {
        code: IAM_DATA_SOURCE_CODES.SENSORTOWER,
        name: 'Sensor Tower 数据',
        description: 'Sensor Tower 广告数据查询（仅超级管理员可见）',
        access_scopes: ['ALL'],
        supported_products: null,
        enabled: true,
      },
      {
        code: IAM_DATA_SOURCE_CODES.GUANGDADA,
        name: '广大大数据',
        description: '广大大广告数据查询与国内版代理',
        access_scopes: ['ALL'],
        supported_products: null,
        enabled: true,
      },
      {
        code: IAM_DATA_SOURCE_CODES.MATERIAL_TOOLS,
        name: '素材处理',
        description: '视频尺寸修改、批量下载与处理历史',
        access_scopes: ['ALL', 'SELF'],
        supported_products: null,
        enabled: true,
      },
      {
        code: IAM_DATA_SOURCE_CODES.HEALTH_ADMIN,
        name: '运维管理',
        description: '健康检查、浏览器重启、日志清理',
        access_scopes: ['ALL'],
        supported_products: null,
        enabled: true,
      },
      {
        code: IAM_DATA_SOURCE_CODES.EXTERNAL_API,
        name: '外部聚合接口',
        description: 'Top50 等外部调用接口',
        access_scopes: ['ALL'],
        supported_products: null,
        enabled: true,
      },
    ],
  };
}
