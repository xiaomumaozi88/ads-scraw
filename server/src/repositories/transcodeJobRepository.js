import { isDbEnabled, getPool } from '../db/pool.js';

function rowToJob(row) {
  let createdBy = null;
  if (row.created_by) {
    try {
      createdBy = typeof row.created_by === 'string' ? JSON.parse(row.created_by) : row.created_by;
    } catch {
      createdBy = null;
    }
  }
  return {
    id: row.id,
    status: row.status,
    phase: row.phase,
    enqueuedAt: Number(row.enqueued_at),
    startedAt: row.started_at != null ? Number(row.started_at) : null,
    finishedAt: row.finished_at != null ? Number(row.finished_at) : null,
    targetW: row.target_w,
    targetH: row.target_h,
    videoUrl: row.video_url,
    videoUrlPreview: row.video_url_preview,
    queuePosition: row.queue_position,
    createdBy,
    clientBatchId: row.client_batch_id,
    clientTaskId: row.client_task_id,
    sourceLabel: row.source_label,
    errorMessage: row.error_message,
  };
}

function jobToParams(job) {
  return [
    job.id,
    job.status,
    job.phase,
    job.enqueuedAt,
    job.startedAt ?? null,
    job.finishedAt ?? null,
    job.targetW,
    job.targetH,
    job.videoUrl,
    job.videoUrlPreview ?? null,
    job.queuePosition ?? null,
    job.createdBy ? JSON.stringify(job.createdBy) : null,
    job.clientBatchId ?? null,
    job.clientTaskId ?? null,
    job.sourceLabel ?? null,
    job.errorMessage ?? null,
  ];
}

const UPSERT_SQL = `
INSERT INTO transcode_jobs (
  id, status, phase, enqueued_at, started_at, finished_at,
  target_w, target_h, video_url, video_url_preview, queue_position,
  created_by, client_batch_id, client_task_id, source_label, error_message
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
  status = VALUES(status),
  phase = VALUES(phase),
  started_at = VALUES(started_at),
  finished_at = VALUES(finished_at),
  queue_position = VALUES(queue_position),
  error_message = VALUES(error_message),
  updated_at = CURRENT_TIMESTAMP(3)
`;

export async function loadAllJobsFromDb() {
  if (!isDbEnabled()) return [];
  const [rows] = await getPool().query(
    'SELECT * FROM transcode_jobs ORDER BY enqueued_at ASC'
  );
  return rows.map(rowToJob);
}

export async function upsertJobToDb(job) {
  if (!isDbEnabled()) return;
  await getPool().query(UPSERT_SQL, jobToParams(job));
}

export async function deleteJobFromDb(jobId) {
  if (!isDbEnabled()) return;
  await getPool().query('DELETE FROM transcode_jobs WHERE id = ?', [jobId]);
}

export async function pruneOldJobsFromDb(cutoffMs) {
  if (!isDbEnabled()) return [];
  const [result] = await getPool().query(
    `DELETE FROM transcode_jobs
     WHERE status IN ('completed', 'failed') AND finished_at IS NOT NULL AND finished_at < ?`,
    [cutoffMs]
  );
  return result;
}

export async function listJobsFromDb({ activeOnly = false, limit = 200 } = {}) {
  if (!isDbEnabled()) return [];
  let sql = 'SELECT * FROM transcode_jobs';
  if (activeOnly) {
    sql += " WHERE status IN ('queued', 'running')";
  }
  sql += ' ORDER BY enqueued_at DESC LIMIT ?';
  const [rows] = await getPool().query(sql, [limit]);
  return rows.map(rowToJob);
}

export async function getJobFromDb(jobId) {
  if (!isDbEnabled()) return null;
  const [rows] = await getPool().query('SELECT * FROM transcode_jobs WHERE id = ? LIMIT 1', [jobId]);
  return rows[0] ? rowToJob(rows[0]) : null;
}
