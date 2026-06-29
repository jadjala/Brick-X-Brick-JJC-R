import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Button } from './brutalist';
import { colors, fonts, borderW, space } from '../theme';
import { phtIso, nowPhtTime } from '../lib/format';

const pad = (n: number) => String(n).padStart(2, '0');
const addDay = (ymd: string, n: number) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

/** Native time picker / web text fallback. value+onChange are "HH:mm" strings. */
function TimeSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(Platform.OS === 'ios');
  if (Platform.OS === 'web') {
    return (
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="HH:MM"
        style={styles.webTime}
        placeholderTextColor={colors.concrete}
      />
    );
  }
  const [h, m] = value.split(':').map(Number);
  const asDate = new Date();
  asDate.setHours(h, m, 0, 0);
  return (
    <View>
      {Platform.OS === 'android' && (
        <Pressable style={styles.androidTime} onPress={() => setShow(true)}>
          <Text style={styles.androidTimeText}>{value}</Text>
        </Pressable>
      )}
      {show && (
        <DateTimePicker
          value={asDate}
          mode="time"
          is24Hour
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_e, d) => {
            if (Platform.OS === 'android') setShow(false);
            if (d) onChange(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
          }}
        />
      )}
    </View>
  );
}

export function TimeConfirmModal({
  visible,
  kind,
  workerName,
  workDate,
  clockInAt,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  kind: 'clock-in' | 'clock-out';
  workerName: string;
  workDate: string;
  clockInAt: string | null;
  onCancel: () => void;
  onConfirm: (iso: string) => void;
}) {
  const [time, setTime] = useState(nowPhtTime());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setTime(nowPhtTime());
      setError(null);
    }
  }, [visible]);

  const confirm = () => {
    const [hh] = time.split(':').map(Number);
    if (kind === 'clock-in') {
      if (hh < 5 || hh > 23) return setError('Work hours are 05:00–23:00 PHT.');
      return onConfirm(phtIso(workDate, time));
    }
    // clock-out: times before 05:00 are treated as next-day (4h cross-midnight grace, §3).
    const isGrace = hh < 5;
    if (!isGrace && (hh < 5 || hh > 23)) return setError('Work hours are 05:00–23:00 PHT.');
    const iso = phtIso(isGrace ? addDay(workDate, 1) : workDate, time);
    if (clockInAt && new Date(iso).getTime() <= new Date(clockInAt).getTime()) {
      return setError('Clock-out must be after clock-in.');
    }
    onConfirm(iso);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel} />
      <View style={styles.sheet}>
        <Text style={styles.kicker}>{kind === 'clock-in' ? 'CLOCKING IN' : 'CLOCKING OUT'}</Text>
        <Text style={styles.worker}>{workerName}</Text>

        <Text style={styles.label}>TIME (PHT)</Text>
        <TimeSelector value={time} onChange={(v) => { setTime(v); setError(null); }} />
        {error && <Text style={styles.error}>{error}</Text>}
        <Text style={styles.hint}>05:00–23:00 PHT. Clock-out before 05:00 counts as next-day grace.</Text>

        <View style={styles.actions}>
          <Button label="Cancel" variant="ghost" onPress={onCancel} style={{ flex: 1 }} />
          <Button label="Confirm" variant="primary" onPress={confirm} style={{ flex: 1 }} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(10,10,10,0.5)' },
  sheet: { backgroundColor: colors.paper, borderTopWidth: borderW, borderColor: colors.ink, padding: space.g3, paddingBottom: space.g4, gap: 10 },
  kicker: { fontFamily: fonts.monoBold, fontSize: 12, letterSpacing: 2, color: colors.orange },
  worker: { fontFamily: fonts.display, fontSize: 24, color: colors.ink, marginBottom: space.g1 },
  label: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1.5, color: colors.steel, textTransform: 'uppercase' },
  webTime: { height: 48, borderWidth: borderW, borderColor: colors.ink, paddingHorizontal: 14, fontFamily: fonts.mono, fontSize: 18, color: colors.ink, backgroundColor: colors.paper },
  androidTime: { height: 48, borderWidth: borderW, borderColor: colors.ink, justifyContent: 'center', paddingHorizontal: 14, backgroundColor: colors.paper },
  androidTimeText: { fontFamily: fonts.mono, fontSize: 18, color: colors.ink },
  error: { fontFamily: fonts.mono, fontSize: 13, color: colors.red },
  hint: { fontFamily: fonts.mono, fontSize: 11, color: colors.concrete, lineHeight: 16 },
  actions: { flexDirection: 'row', gap: space.g2, marginTop: space.g2 },
});
