import { IAM_PLATFORM_CODE } from '../../config/iam.js';
import { IAM_ROLE_CODES } from '../../config/iamRoles.js';

/** 本地开发 bypass 时注入的超级管理员 profile（勿用于生产） */
export function buildDevBypassProfile() {
  const name = process.env.IAM_DEV_BYPASS_USER_NAME?.trim() || '本地开发';
  return {
    platform_code: IAM_PLATFORM_CODE,
    feishu_user_id: process.env.IAM_DEV_BYPASS_USER_ID?.trim() || 'dev-local',
    user_name: name,
    email: process.env.IAM_DEV_BYPASS_EMAIL?.trim() || 'dev@local',
    is_super: true,
    is_platform_member: true,
    role_codes: [IAM_ROLE_CODES.SUPER_ADMIN],
    data_sources: [],
    session_expire_at: null,
  };
}
