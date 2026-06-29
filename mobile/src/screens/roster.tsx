import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronDown } from 'lucide-react-native';
import { useAuth } from '../contexts/auth';
import { useBanner } from '../components/error-banner';
import { api } from '../lib/api';
import { todayPhtDate, yesterdayPhtDate } from '../lib/format';
import type { Project, RosterRow, RowStatus, AttendanceJoined } from '../lib/types';
import { Button, StatusPill } from '../components/brutalist';
import { TimeConfirmModal } from '../components/time-confirm-modal';
import { colors, fonts, borderW, space } from '../theme';

type DateChoice = 'today' | 'yesterday';

export function RosterScreen() {
  const { profile } = useAuth();
  const { showError } = useBanner();

  const [projects, setProjects] = useState<Project[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dateChoice, setDateChoice] = useState<DateChoice>('today');
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ kind: 'clock-in' | 'clock-out'; row: RosterRow } | null>(null);

  const workDate = dateChoice === 'today' ? todayPhtDate() : yesterdayPhtDate();

  // Tap-debounce: keys "<worker>:<action>" currently in flight. Ref is the guard;
  // state mirror drives button disabled state.
  const inFlightRef = useRef<Set<string>>(new Set());
  const [inFlight, setInFlight] = useState<Set<string>>(new Set());
  const syncInFlight = () => setInFlight(new Set(inFlightRef.current));
  const workerBusy = (workerId: string) => [...inFlight].some((k) => k.startsWith(`${workerId}:`));

  useEffect(() => {
    api
      .get<Project[]>('/me/projects')
      .then((p) => {
        setProjects(p);
        setProject((cur) => cur ?? p[0] ?? null);
      })
      .catch(showError);
  }, []);

  const loadRoster = useCallback(async () => {
    if (!project) return;
    setLoading(true);
    try {
      setRows(await api.get<RosterRow[]>(`/projects/${project.id}/roster?date=${workDate}`));
    } catch (err) {
      showError(err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [project, workDate]);

  useEffect(() => {
    void loadRoster();
  }, [loadRoster]);

  // ── optimistic action runner ──
  const runAction = async (
    workerId: string,
    action: string,
    patch: Partial<RosterRow>,
    call: () => Promise<unknown>,
    reconcile?: (row: RosterRow, res: any) => RosterRow,
  ) => {
    const key = `${workerId}:${action}`;
    if (inFlightRef.current.has(key)) return; // debounce double-tap
    inFlightRef.current.add(key);
    syncInFlight();

    let prev: RosterRow | null = null;
    setRows((curr) => curr.map((r) => (r.worker_id === workerId ? ((prev = { ...r }), { ...r, ...patch }) : r)));

    try {
      const res = await call();
      if (reconcile) setRows((curr) => curr.map((r) => (r.worker_id === workerId ? reconcile(r, res) : r)));
    } catch (err) {
      setRows((curr) => curr.map((r) => (r.worker_id === workerId && prev ? (prev as RosterRow) : r)));
      showError(err);
    } finally {
      inFlightRef.current.delete(key);
      syncInFlight();
    }
  };

  const me = profile?.full_name ?? null;

  const doClockIn = (row: RosterRow, iso: string) =>
    runAction(
      row.worker_id,
      'clock-in',
      { status: 'clocked_in', attendance_id: 'temp', clock_in_at: iso, clock_out_at: null, recorded_by_name: me },
      () => api.post<AttendanceJoined>('/attendance/clock-in', { worker_id: row.worker_id, work_date: workDate, clock_in_at: iso }),
      (r, res) => ({ ...r, status: 'clocked_in', attendance_id: res.id, clock_in_at: res.clock_in_at, total_hours: res.total_hours, overtime: res.overtime }),
    );

  const doClockOut = (row: RosterRow, iso: string) =>
    runAction(
      row.worker_id,
      'clock-out',
      { status: 'clocked_out', clock_out_at: iso },
      () => api.post<AttendanceJoined>('/attendance/clock-out', { worker_id: row.worker_id, work_date: workDate, clock_out_at: iso }),
      (r, res) => ({ ...r, status: 'clocked_out', clock_out_at: res.clock_out_at, total_hours: res.total_hours, overtime: res.overtime }),
    );

  const doMarkAbsent = (row: RosterRow) =>
    runAction(
      row.worker_id,
      'mark-absent',
      { status: 'absent', attendance_id: 'temp', clock_in_at: null, clock_out_at: null, recorded_by_name: me },
      () => api.post<AttendanceJoined>('/attendance/mark-absent', { worker_id: row.worker_id, work_date: workDate }),
      (r, res) => ({ ...r, status: 'absent', attendance_id: res.id }),
    );

  const doUndo = (row: RosterRow) => {
    if (!row.attendance_id) return;
    runAction(
      row.worker_id,
      'undo',
      { status: 'no_record', attendance_id: null, clock_in_at: null, clock_out_at: null, total_hours: null, overtime: null, recorded_by_name: null },
      () => api.post('/attendance/undo', { attendance_id: row.attendance_id }),
    );
  };

  const counts = rows.reduce(
    (acc, r) => ((acc[r.status] = (acc[r.status] ?? 0) + 1), acc),
    {} as Record<RowStatus, number>,
  );

  const renderActions = (row: RosterRow) => {
    const busy = workerBusy(row.worker_id);
    switch (row.status) {
      case 'no_record':
        return (
          <View style={styles.actionRow}>
            <Button label="Clock In" variant="primary" disabled={busy} onPress={() => setModal({ kind: 'clock-in', row })} style={{ flex: 1 }} />
            <Button label="Mark Absent" variant="ghost" disabled={busy} onPress={() => doMarkAbsent(row)} style={{ flex: 1 }} />
          </View>
        );
      case 'clocked_in':
        return <Button label="Clock Out" variant="blue" disabled={busy} onPress={() => setModal({ kind: 'clock-out', row })} />;
      case 'clocked_out':
      case 'absent':
        return <Button label="Undo" variant="secondary" disabled={busy} onPress={() => doUndo(row)} />;
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Project header */}
      <View style={styles.header}>
        <Pressable
          disabled={projects.length <= 1}
          onPress={() => setPickerOpen(true)}
          style={styles.projectBtn}
        >
          <View>
            <Text style={styles.projectName}>{project?.name ?? '—'}</Text>
            {project?.location ? <Text style={styles.projectLoc}>{project.location}</Text> : null}
          </View>
          {projects.length > 1 && <ChevronDown color={colors.paper} size={20} strokeWidth={2.5} />}
        </Pressable>

        {/* Date selector */}
        <View style={styles.dateRow}>
          {(['today', 'yesterday'] as const).map((d) => {
            const active = dateChoice === d;
            return (
              <Pressable key={d} onPress={() => setDateChoice(d)} style={[styles.datePill, active ? styles.datePillActive : styles.datePillIdle]}>
                <Text style={[styles.datePillText, { color: active ? colors.paper : colors.ink }]}>{d.toUpperCase()}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Worker list */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.orange} size="large" />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.worker_id}
          contentContainerStyle={{ paddingBottom: space.g3 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>NO WORKERS ON THIS ROSTER</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.rowTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.workerName}>{item.full_name}</Text>
                  {item.position ? <Text style={styles.workerPos}>{item.position}</Text> : null}
                </View>
                <StatusPill status={item.status} />
              </View>
              <View style={styles.actionWrap}>{renderActions(item)}</View>
            </View>
          )}
        />
      )}

      {/* Bottom summary chips */}
      <View style={styles.summary}>
        {(
          [
            ['Present', counts.clocked_in ?? 0, colors.green],
            ['Out', counts.clocked_out ?? 0, colors.blue],
            ['Absent', counts.absent ?? 0, colors.red],
            ['No Rec', counts.no_record ?? 0, colors.steel],
          ] as const
        ).map(([label, n, color]) => (
          <View key={label} style={[styles.chip, { backgroundColor: color }]}>
            <Text style={styles.chipNum}>{n}</Text>
            <Text style={styles.chipLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Time confirm modal */}
      {modal && (
        <TimeConfirmModal
          visible
          kind={modal.kind}
          workerName={modal.row.full_name}
          workDate={workDate}
          clockInAt={modal.row.clock_in_at}
          onCancel={() => setModal(null)}
          onConfirm={(iso) => {
            const { kind, row } = modal;
            setModal(null);
            if (kind === 'clock-in') doClockIn(row, iso);
            else doClockOut(row, iso);
          }}
        />
      )}

      {/* Project picker */}
      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)} />
        <View style={styles.pickerSheet}>
          <Text style={styles.pickerTitle}>SELECT PROJECT</Text>
          {projects.map((p) => (
            <Pressable key={p.id} style={styles.pickerItem} onPress={() => { setProject(p); setPickerOpen(false); }}>
              <Text style={styles.pickerItemText}>{p.name}</Text>
            </Pressable>
          ))}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  header: { backgroundColor: colors.ink, paddingHorizontal: space.g2, paddingTop: space.g1, paddingBottom: space.g2, gap: space.g2 },
  projectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  projectName: { fontFamily: fonts.display, fontSize: 22, color: colors.paper },
  projectLoc: { fontFamily: fonts.mono, fontSize: 12, color: colors.concrete, marginTop: 2 },
  dateRow: { flexDirection: 'row', gap: space.g1 },
  datePill: { flex: 1, height: 40, alignItems: 'center', justifyContent: 'center', borderWidth: borderW },
  datePillActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  datePillIdle: { backgroundColor: colors.ink, borderColor: colors.paper },
  datePillText: { fontFamily: fonts.monoBold, fontSize: 13, letterSpacing: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { borderBottomWidth: borderW, borderBottomColor: colors.ink, paddingHorizontal: space.g2, paddingVertical: space.g2, gap: space.g2 },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.g2 },
  workerName: { fontFamily: fonts.displayMed, fontSize: 17, color: colors.ink },
  workerPos: { fontFamily: fonts.mono, fontSize: 12, color: colors.steel, marginTop: 2 },
  actionWrap: {},
  actionRow: { flexDirection: 'row', gap: space.g2 },
  empty: { margin: space.g3, borderWidth: borderW, borderColor: colors.steel, borderStyle: 'dashed', padding: space.g5, alignItems: 'center' },
  emptyText: { fontFamily: fonts.monoBold, fontSize: 13, letterSpacing: 2, color: colors.steel },
  summary: { flexDirection: 'row', borderTopWidth: borderW, borderTopColor: colors.ink },
  chip: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRightWidth: borderW, borderRightColor: colors.ink },
  chipNum: { fontFamily: fonts.monoBold, fontSize: 18, color: colors.paper },
  chipLabel: { fontFamily: fonts.monoBold, fontSize: 10, letterSpacing: 1, color: colors.paper, textTransform: 'uppercase' },
  backdrop: { flex: 1, backgroundColor: 'rgba(10,10,10,0.5)' },
  pickerSheet: { backgroundColor: colors.paper, borderTopWidth: borderW, borderColor: colors.ink, padding: space.g3, gap: space.g1 },
  pickerTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.ink, marginBottom: space.g1 },
  pickerItem: { borderWidth: borderW, borderColor: colors.ink, padding: space.g2 },
  pickerItemText: { fontFamily: fonts.mono, fontSize: 15, color: colors.ink },
});
