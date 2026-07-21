/**
 * 平台角色：超级管理员 / 业务相关人员 / 普通员工
 * IAM catalog 与权限判定共用。
 */

export const IAM_ROLE_CODES = {
  SUPER_ADMIN: 'super_admin',
  RELATED_EMPLOYEE: 'related_employee',
  EMPLOYEE: 'employee',
};

/** 普通员工可访问的数据源 */
export const EMPLOYEE_DATA_SOURCE_CODES = [
  'material_tools',
];

/** 业务相关人员可访问的数据源（不含运维管理） */
export const RELATED_EMPLOYEE_DATA_SOURCE_CODES = [
  'insightrackr',
  'guangdada',
  'material_tools',
];

const LEGACY_ROLE_MAP = {
  admin: IAM_ROLE_CODES.SUPER_ADMIN,
  operator: IAM_ROLE_CODES.EMPLOYEE,
  viewer: IAM_ROLE_CODES.EMPLOYEE,
};

export function normalizeRoleCodes(roleCodes) {
  if (!Array.isArray(roleCodes)) {
    if (typeof roleCodes === 'string') {
      roleCodes = roleCodes.split(/[,\s]+/);
    } else {
      return [];
    }
  }
  const normalized = new Set();
  for (const raw of roleCodes) {
    const code = String(raw?.code || raw?.role_code || raw || '').trim();
    if (!code) continue;
    normalized.add(LEGACY_ROLE_MAP[code] || code);
  }
  return [...normalized];
}

export function getProfileRoleCodes(profile) {
  const values = [
    ...(Array.isArray(profile?.role_codes) ? profile.role_codes : []),
    ...(Array.isArray(profile?.roles) ? profile.roles : []),
    profile?.role,
    profile?.role_code,
  ];
  return normalizeRoleCodes(values.filter(Boolean));
}

export function isSuperAdminProfile(profile) {
  if (!profile) return false;
  if (profile.is_super === true) return true;
  return getProfileRoleCodes(profile).includes(IAM_ROLE_CODES.SUPER_ADMIN);
}

export function isEmployeeProfile(profile) {
  if (!profile || isSuperAdminProfile(profile)) return false;
  return getProfileRoleCodes(profile).includes(IAM_ROLE_CODES.EMPLOYEE);
}

export function isRelatedEmployeeProfile(profile) {
  if (!profile || isSuperAdminProfile(profile)) return false;
  return getProfileRoleCodes(profile).includes(IAM_ROLE_CODES.RELATED_EMPLOYEE);
}

/** @returns {'super_admin' | 'related_employee' | 'employee' | null} */
export function resolveProfileRole(profile) {
  if (isSuperAdminProfile(profile)) return IAM_ROLE_CODES.SUPER_ADMIN;
  if (isRelatedEmployeeProfile(profile)) return IAM_ROLE_CODES.RELATED_EMPLOYEE;
  if (isEmployeeProfile(profile)) return IAM_ROLE_CODES.EMPLOYEE;
  return null;
}

/** 菜单/默认权限：未显式配置角色的登录用户视为普通员工 */
export function resolveEffectiveRole(profile) {
  return resolveProfileRole(profile) ?? IAM_ROLE_CODES.EMPLOYEE;
}

export function employeeCanAccessDataSource(code) {
  return EMPLOYEE_DATA_SOURCE_CODES.includes(code);
}

export function relatedEmployeeCanAccessDataSource(code) {
  return RELATED_EMPLOYEE_DATA_SOURCE_CODES.includes(code);
}

export function getRoleDataSourceCodes(profile) {
  const roleCodes = getProfileRoleCodes(profile);
  const effectiveRoleCodes = roleCodes.length ? roleCodes : [IAM_ROLE_CODES.EMPLOYEE];
  const dataSourceCodes = new Set();
  if (effectiveRoleCodes.includes(IAM_ROLE_CODES.EMPLOYEE)) {
    EMPLOYEE_DATA_SOURCE_CODES.forEach((code) => dataSourceCodes.add(code));
  }
  if (effectiveRoleCodes.includes(IAM_ROLE_CODES.RELATED_EMPLOYEE)) {
    RELATED_EMPLOYEE_DATA_SOURCE_CODES.forEach((code) => dataSourceCodes.add(code));
  }
  return [...dataSourceCodes];
}

export function roleCanAccessDataSource(profile, code) {
  return getRoleDataSourceCodes(profile).includes(code);
}
