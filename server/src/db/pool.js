import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('mysql2/promise').Pool | null} */
let pool = null;
let dbEnabled = false;
let initPromise = null;

export function isDbEnabled() {
  return dbEnabled;
}

export function getPool() {
  if (!dbEnabled || !pool) {
    throw new Error('数据库未启用或未初始化');
  }
  return pool;
}

function readDbConfig() {
  const host = process.env.DB_HOST?.trim();
  const user = process.env.DB_USER?.trim();
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME?.trim();
  if (!host || !user || !password || !database) {
    return null;
  }
  return {
    host,
    port: parseInt(process.env.DB_PORT || '3306', 10) || 3306,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_POOL_SIZE || '10', 10) || 10,
    timezone: '+00:00',
    charset: 'utf8mb4',
  };
}

async function runSchema(poolInstance) {
  const sql = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'));
  for (const stmt of statements) {
    await poolInstance.query(stmt);
  }
}

export async function initDatabase() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const config = readDbConfig();
    if (!config) {
      logger.info('[DB] 未配置 DB_HOST/DB_USER/DB_PASSWORD/DB_NAME，使用内存/文件存储');
      return false;
    }

    try {
      pool = mysql.createPool(config);
      await pool.query('SELECT 1');
      await runSchema(pool);
      dbEnabled = true;
      logger.info(`[DB] 已连接 MySQL ${config.host}:${config.port}/${config.database}`);
      return true;
    } catch (err) {
      logger.error('[DB] 连接或初始化失败，回退内存/文件存储:', err.message);
      if (pool) {
        await pool.end().catch(() => {});
        pool = null;
      }
      dbEnabled = false;
      return false;
    }
  })();

  return initPromise;
}

export async function closeDatabase() {
  if (pool) {
    await pool.end().catch(() => {});
    pool = null;
  }
  dbEnabled = false;
  initPromise = null;
}
