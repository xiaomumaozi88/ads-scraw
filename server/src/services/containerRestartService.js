import fs from 'fs';
import http from 'http';
import { logger } from '../utils/logger.js';

function resolveContainerName() {
  return (process.env.CONTAINER_NAME || 'ads-scraw').trim();
}

function resolveDockerSocketPath() {
  return process.env.DOCKER_SOCKET_PATH || '/var/run/docker.sock';
}

/** 供健康检查页展示 */
export function getContainerRestartInfo() {
  const enabled = process.env.DOCKER_CONTAINER_RESTART_ENABLED === 'true';
  const socketPath = resolveDockerSocketPath();
  const socketAvailable = fs.existsSync(socketPath);
  return {
    enabled,
    available: enabled && socketAvailable,
    containerName: resolveContainerName(),
    socketPath: socketAvailable ? socketPath : null,
  };
}

function dockerApiRestart(containerName, timeoutSec = 10) {
  const socketPath = resolveDockerSocketPath();
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        socketPath,
        path: `/containers/${encodeURIComponent(containerName)}/restart?t=${timeoutSec}`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ statusCode: res.statusCode, body });
            return;
          }
          reject(new Error(`Docker API 重启失败 (${res.statusCode}): ${body || res.statusMessage}`));
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

/**
 * 触发 Docker 容器重启（需挂载 docker.sock 且 DOCKER_CONTAINER_RESTART_ENABLED=true）
 */
export async function restartApplicationContainer() {
  const info = getContainerRestartInfo();
  if (!info.enabled) {
    throw new Error('未启用容器重启（需设置 DOCKER_CONTAINER_RESTART_ENABLED=true）');
  }
  if (!info.available) {
    throw new Error('Docker 套接字不可用（需挂载 /var/run/docker.sock 到容器）');
  }

  const containerName = info.containerName;
  logger.info(`[Container] 请求重启容器: ${containerName}`);
  await dockerApiRestart(containerName);
  logger.info(`[Container] 重启指令已发送: ${containerName}`);
  return { containerName };
}
