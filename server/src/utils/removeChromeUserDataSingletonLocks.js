import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { logger } from './logger.js';

/** Chrome/Chromium 在用户数据目录下的单例锁文件（崩溃或未正常退出时残留会导致下次启动失败） */
const LOCK_ENTRY_NAMES = ['SingletonLock', 'SingletonCookie', 'SingletonSocket', 'lockfile'];

function resolveUserDataDir(userDataDirRelativeOrAbsolute) {
    if (!userDataDirRelativeOrAbsolute || typeof userDataDirRelativeOrAbsolute !== 'string') return null;
    return path.isAbsolute(userDataDirRelativeOrAbsolute)
        ? userDataDirRelativeOrAbsolute
        : path.resolve(process.cwd(), userDataDirRelativeOrAbsolute);
}

/**
 * 终止仍占用该 userDataDir 的 Chrome/Chromium 进程（nodemon 热重载或异常退出后常见）
 * @returns {boolean} 是否执行过 kill 命令（不代表一定杀掉了进程）
 */
export function killChromeProcessesUsingUserDataDir(userDataDirRelativeOrAbsolute) {
    const dir = resolveUserDataDir(userDataDirRelativeOrAbsolute);
    if (!dir) return false;

    if (process.platform !== 'darwin' && process.platform !== 'linux') {
        return false;
    }

    try {
        // 命令行中通常包含 user-data-dir 路径；用目录名片段匹配，避免 shell 转义问题
        const needle = path.basename(dir) || dir;
        execSync(`pkill -f ${JSON.stringify(needle)}`, { stdio: 'ignore' });
        logger.info(`[Chrome] 已尝试结束占用 profile 的进程 (${needle})`);
        return true;
    } catch {
        // pkill 退出码 1：无匹配进程
        return false;
    }
}

/**
 * 删除 profile 目录下的单例锁文件，便于 Puppeteer 下次启动同一 userDataDir。
 * @param {string} userDataDirRelativeOrAbsolute - 与 puppeteer launch 的 userDataDir 一致
 */
export function removeChromeUserDataSingletonLocks(userDataDirRelativeOrAbsolute) {
    const dir = resolveUserDataDir(userDataDirRelativeOrAbsolute);
    if (!dir || !fs.existsSync(dir)) return;

    for (const name of LOCK_ENTRY_NAMES) {
        const p = path.join(dir, name);
        try {
            if (fs.existsSync(p)) {
                fs.unlinkSync(p);
            }
        } catch (e) {
            logger.warn(`[Chrome] 删除锁文件失败 ${p}:`, e.message);
        }
    }
}

function isSingletonLockLaunchError(err) {
    const msg = String(err?.message || err || '');
    return /SingletonLock|ProcessSingleton|profile directory/i.test(msg);
}

/**
 * 启动前准备：结束孤儿 Chrome + 清理锁（避免 SingletonLock: File exists）
 * @param {string} userDataDirRelativeOrAbsolute
 * @param {{ forceKill?: boolean }} [options]
 */
export function prepareChromeUserDataDirForLaunch(userDataDirRelativeOrAbsolute, options = {}) {
    const { forceKill = true } = options;
    if (forceKill) {
        killChromeProcessesUsingUserDataDir(userDataDirRelativeOrAbsolute);
    }
    removeChromeUserDataSingletonLocks(userDataDirRelativeOrAbsolute);
}

export { isSingletonLockLaunchError };
