import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  unlinkSync,
  readdirSync,
  statSync,
} from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { isDbEnabled } from '../db/pool.js';
import {
  loadAllJobsFromDb,
  upsertJobToDb,
  deleteJobFromDb,
  pruneOldJobsFromDb,
} from '../repositories/transcodeJobRepository.js';

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../data');
const JOBS_FILE = join(DATA_DIR, 'transcode-jobs.json');
export const TRANSCODE_OUTPUT_DIR = join(DATA_DIR, 'transcode-output');

const MAX_JOBS = 500;
const TERMINAL_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_OUTPUT_RETENTION_MS = 24 * 60 * 60 * 1000;
const DEFAULT_OUTPUT_MAX_BYTES = 2 * 1024 * 1024 * 1024;
export const TRANSCODE_OUTPUT_RETENTION_MS = parsePositiveInt(
  process.env.TRANSCODE_OUTPUT_RETENTION_MS,
  DEFAULT_OUTPUT_RETENTION_MS
);
export const TRANSCODE_OUTPUT_MAX_BYTES = parsePositiveInt(
  process.env.TRANSCODE_OUTPUT_MAX_BYTES,
  DEFAULT_OUTPUT_MAX_BYTES
);

/** @type {Map<string, object>} */
const jobsById = new Map();
let loaded = false;

function parsePositiveInt(value, fallback) {
  const parsed = parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function ensureDirs() {
  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(TRANSCODE_OUTPUT_DIR, { recursive: true });
}

function listOutputFiles() {
  ensureDirs();
  return readdirSync(TRANSCODE_OUTPUT_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.mp4'))
    .map((entry) => {
      const path = join(TRANSCODE_OUTPUT_DIR, entry.name);
      const stat = statSync(path);
      const jobId = entry.name.replace(/\.mp4$/, '');
      const job = jobsById.get(jobId);
      return {
        path,
        jobId,
        size: stat.size,
        mtimeMs: stat.mtimeMs,
        cleanupTimeMs: job?.finishedAt || stat.mtimeMs,
      };
    });
}

function removeOutputFile(file, reason, removed) {
  try {
    unlinkSync(file.path);
    removed.push({
      jobId: file.jobId,
      path: file.path,
      size: file.size,
      reason,
    });
    return true;
  } catch {
    return false;
  }
}

function pruneOldJobsLocal() {
  const cutoff = Date.now() - TERMINAL_RETENTION_MS;
  for (const [id, job] of jobsById) {
    if (
      (job.status === 'completed' || job.status === 'failed')
      && job.finishedAt
      && job.finishedAt < cutoff
    ) {
      deleteJobOutput(id);
      jobsById.delete(id);
    }
  }
}

async function pruneOldJobsDb() {
  if (!isDbEnabled()) return;
  const cutoff = Date.now() - TERMINAL_RETENTION_MS;
  await pruneOldJobsFromDb(cutoff);
  for (const [id, job] of jobsById) {
    if (
      (job.status === 'completed' || job.status === 'failed')
      && job.finishedAt
      && job.finishedAt < cutoff
    ) {
      deleteJobOutput(id);
      jobsById.delete(id);
    }
  }
}

function loadFromDiskFile() {
  if (!existsSync(JOBS_FILE)) return;
  try {
    const arr = JSON.parse(readFileSync(JOBS_FILE, 'utf8'));
    if (Array.isArray(arr)) {
      for (const job of arr) {
        if (job?.id) jobsById.set(job.id, job);
      }
    }
  } catch {
    jobsById.clear();
  }
}

function persistToDiskFile() {
  ensureDirs();
  const arr = [...jobsById.values()]
    .sort((a, b) => b.enqueuedAt - a.enqueuedAt)
    .slice(0, MAX_JOBS);
  writeFileSync(JOBS_FILE, JSON.stringify(arr, null, 2), 'utf8');
}

async function migrateFileToDbIfNeeded() {
  if (!isDbEnabled() || jobsById.size === 0) return;
  const existing = await loadAllJobsFromDb();
  if (existing.length > 0) return;
  for (const job of jobsById.values()) {
    await upsertJobToDb(job);
  }
}

export async function initJobStore() {
  if (loaded) return;
  ensureDirs();

  if (isDbEnabled()) {
    const jobs = await loadAllJobsFromDb();
    for (const job of jobs) {
      jobsById.set(job.id, job);
    }
    if (jobs.length === 0) {
      loadFromDiskFile();
      await migrateFileToDbIfNeeded();
    }
  } else {
    loadFromDiskFile();
  }

  loaded = true;
  await pruneOldJobsDb();
  pruneOldJobsLocal();
  pruneTranscodeOutputFiles();
  if (!isDbEnabled()) persistToDiskFile();
}

export function getOutputPath(jobId) {
  return join(TRANSCODE_OUTPUT_DIR, `${jobId}.mp4`);
}

export function deleteJobOutput(jobId) {
  try {
    const p = getOutputPath(jobId);
    if (existsSync(p)) unlinkSync(p);
  } catch {
    /* ignore */
  }
}

export function pruneTranscodeOutputFiles({
  now = Date.now(),
  retentionMs = TRANSCODE_OUTPUT_RETENTION_MS,
  maxBytes = TRANSCODE_OUTPUT_MAX_BYTES,
} = {}) {
  let files;
  try {
    files = listOutputFiles();
  } catch {
    return {
      totalBytesBefore: 0,
      totalBytesAfter: 0,
      removedCount: 0,
      removedBytes: 0,
      removed: [],
    };
  }

  const removed = [];
  const cutoff = now - retentionMs;
  let totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  const totalBytesBefore = totalBytes;
  const kept = [];

  for (const file of files) {
    if (file.cleanupTimeMs < cutoff) {
      if (removeOutputFile(file, 'expired', removed)) totalBytes -= file.size;
    } else {
      kept.push(file);
    }
  }

  if (maxBytes > 0 && totalBytes > maxBytes) {
    kept.sort((a, b) => a.cleanupTimeMs - b.cleanupTimeMs);
    for (const file of kept) {
      if (totalBytes <= maxBytes) break;
      if (removeOutputFile(file, 'size-limit', removed)) totalBytes -= file.size;
    }
  }

  const removedBytes = removed.reduce((sum, file) => sum + file.size, 0);
  return {
    totalBytesBefore,
    totalBytesAfter: totalBytes,
    removedCount: removed.length,
    removedBytes,
    removed,
    retentionMs,
    maxBytes,
  };
}

export function getJob(jobId) {
  return jobsById.get(jobId) ?? null;
}

export function upsertJob(job) {
  jobsById.set(job.id, job);
  if (isDbEnabled()) {
    upsertJobToDb(job).catch(() => {});
  } else {
    persistToDiskFile();
  }
  return job;
}

export function removeJob(jobId) {
  jobsById.delete(jobId);
  if (isDbEnabled()) {
    deleteJobFromDb(jobId).catch(() => {});
  } else {
    persistToDiskFile();
  }
}

export function listJobs({ activeOnly = false, limit = 200 } = {}) {
  let jobs = [...jobsById.values()];
  if (activeOnly) {
    jobs = jobs.filter((j) => j.status === 'queued' || j.status === 'running');
  }
  jobs.sort((a, b) => b.enqueuedAt - a.enqueuedAt);
  return jobs.slice(0, limit);
}

export function listRecoverableJobs() {
  return [...jobsById.values()]
    .filter((j) => j.status === 'queued' || j.status === 'running')
    .sort((a, b) => a.enqueuedAt - b.enqueuedAt);
}
