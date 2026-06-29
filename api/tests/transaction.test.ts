import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool, withTransaction } from '../src/lib/db.js';

// SPEC §6: the data write and the audit-log write share one transaction. If the
// log write fails, the attendance write must roll back. We force the failure by
// writing a log row with a non-existent actor_id (FK violation).
let BGC = '', WID = '';
const NAME = `__TXN_${Date.now()}`;
const yday = '2026-01-15'; // arbitrary in-range date, isolated to this temp worker

beforeAll(async () => {
  BGC = (await pool.query(`select id from projects where name='BGC Verdana Tower'`)).rows[0].id;
  WID = (
    await pool.query(`insert into workers (project_id, full_name, position) values ($1,$2,'Tester') returning id`, [
      BGC,
      NAME,
    ])
  ).rows[0].id;
});

afterAll(async () => {
  await pool.query('delete from attendance_logs where worker_id=$1', [WID]);
  await pool.query('delete from attendance where worker_id=$1', [WID]);
  await pool.query('delete from workers where id=$1', [WID]);
  await pool.end();
});

describe('transaction integrity (§6)', () => {
  it('rolls back the attendance insert when the log write fails', async () => {
    const badActor = '00000000-0000-0000-0000-000000000000';
    await expect(
      withTransaction(async (client) => {
        const r = await client.query(
          `insert into attendance (worker_id, project_id, work_date, status, recorded_by)
           values ($1,$2,$3,'absent',(select id from profiles limit 1)) returning id`,
          [WID, BGC, yday],
        );
        // This violates attendance_logs.actor_id FK → whole txn must roll back.
        await client.query(
          `insert into attendance_logs (attendance_id, worker_id, work_date, action, actor_id)
           values ($1,$2,$3,'mark_absent',$4)`,
          [r.rows[0].id, WID, yday, badActor],
        );
      }),
    ).rejects.toThrow();

    const rows = await pool.query('select 1 from attendance where worker_id=$1 and work_date=$2', [WID, yday]);
    expect(rows.rowCount).toBe(0); // rolled back — no orphaned attendance row
  });
});
