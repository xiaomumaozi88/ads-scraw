// 登录状态枚举
export const LoginStatus = Object.freeze({
    LOGGED_OUT: 'LOGGED_OUT', // 未登录
    AWAITING_VERIFICATION: 'AWAITING_VERIFICATION', // 验证码等待填写中
    VERIFYING_CODE: 'VERIFYING_CODE', // 验证码验证中
    ONLINE: 'ONLINE', // 已登录,
    NO_AUTH_ONLINE: 'NO_AUTH_ONLINE', // 已登录但无查看订单权限,
    AWAITING_IMG_CODE: 'AWAITING_IMG_CODE', // 图形验证码等待填写中
});

