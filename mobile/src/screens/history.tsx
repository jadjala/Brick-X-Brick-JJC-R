import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBanner } from '../components/error-banner';
import { api } from '../lib/api';
import { formatDateHeader, formatHours, formatTimePHT, toPhtDate, todayPhtDate } from '../lib/format';
import type { Project, AttendanceJoined } from '../lib/types';
import { StatusPill } from '../components/brutalist';
import { colors, fonts, borderW, space } from '../theme';

type Section = { title: string; data: AttendanceJoined[] };

export function HistoryScreen() {
  const { showError } = useBanner();
  const [project, setProject] = useState<Project | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    api.get<Project[]>('/me/projects').then((p) => setProject(p[0] ?? null)).catch(showError);
  }, []);

  const load = useCallback(async () => {
    if (!project) return;
    const to = todayPhtDate();
    const from = toPhtDate(new Date(Date.now() - 30 * 86_400_000));
    try {
      const rows = await api.get<AttendanceJoined[]>(`/attendance?from=${from}&to=${to}&project_id=${project.id}`);
      // group by work_date, newest first
      const byDate = new Map<string, AttendanceJoined[]>();
      for (const r of rows) {
        if (!byDate.has(r.work_date)) byDate.set(r.work_date, []);
        byDate.get(r.work_date)!.push(r);
      }
      const ordered = [...byDate.entries()]
        .sort((a, b) => (a[0] < b[0] ? 1 : -1))
        .map(([date, data]) => ({ title: date, data: data.sort((a, b) => a.full_name.localeCompare(b.full_name)) }));
      setSections(ordered);
    } catch (err) {
      showError(err);
      setSections([]);
    }
  }, [project]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>HISTORY</Text>
        <Text style={styles.sub}>{project?.name ?? '—'} · LAST 30 DAYS</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.orange} size="large" />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.orange} />}
          stickySectionHeadersEnabled
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>NO HISTORY</Text>
            </View>
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionText}>{formatDateHeader(section.title)}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.full_name}</Text>
                <Text style={styles.pos}>{item.position ?? '—'}</Text>
              </View>
              <View style={styles.mid}>
                <StatusPill status={item.status} />
                <Text style={styles.times}>
                  {formatTimePHT(item.clock_in_at)} – {formatTimePHT(item.clock_out_at)}
                </Text>
              </View>
              <View style={styles.hoursCol}>
                <Text style={styles.hours}>{formatHours(item.total_hours)}</Text>
                {item.overtime ? <Text style={styles.ot}>+{formatHours(item.overtime)}</Text> : null}
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  header: { backgroundColor: colors.ink, paddingHorizontal: space.g2, paddingVertical: space.g2 },
  title: { fontFamily: fonts.display, fontSize: 24, color: colors.paper, letterSpacing: 1 },
  sub: { fontFamily: fonts.mono, fontSize: 11, color: colors.concrete, letterSpacing: 1, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sectionHeader: { backgroundColor: colors.paper, borderBottomWidth: borderW, borderBottomColor: colors.ink, paddingHorizontal: space.g2, paddingVertical: 6 },
  sectionText: { fontFamily: fonts.monoBold, fontSize: 13, letterSpacing: 1, color: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.g2, paddingHorizontal: space.g2, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.ink },
  name: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.ink },
  pos: { fontFamily: fonts.mono, fontSize: 11, color: colors.steel, marginTop: 1 },
  mid: { alignItems: 'flex-start', gap: 4 },
  times: { fontFamily: fonts.mono, fontSize: 11, color: colors.steel },
  hoursCol: { alignItems: 'flex-end', width: 70 },
  hours: { fontFamily: fonts.monoBold, fontSize: 14, color: colors.ink },
  ot: { fontFamily: fonts.mono, fontSize: 11, color: colors.orange },
  empty: { margin: space.g3, borderWidth: borderW, borderColor: colors.steel, borderStyle: 'dashed', padding: space.g5, alignItems: 'center' },
  emptyText: { fontFamily: fonts.monoBold, fontSize: 14, letterSpacing: 3, color: colors.steel },
});
