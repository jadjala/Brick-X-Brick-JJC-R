import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';

// Sprint 0 boot smoke test only. Real screens (Login/Roster/History) arrive in
// Sprint 2; bundled fonts (JetBrains Mono) load there too — here we use the
// platform monospace so the bundle has no asset dependency.
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

type ApiState = 'checking' | 'ok' | 'down';

export default function App() {
  const [status, setStatus] = useState<ApiState>('checking');
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/health`);
        const json = (await res.json()) as { ok?: boolean; version?: string };
        if (!alive) return;
        setStatus(json.ok ? 'ok' : 'down');
        setVersion(json.version ?? null);
      } catch {
        if (alive) setStatus('down');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const pill =
    status === 'ok' ? styles.pillOk : status === 'down' ? styles.pillDown : styles.pillChecking;

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <Text style={styles.kicker}>BRICK × BRICK</Text>
      <Text style={styles.title}>BxB ATTENDANCE</Text>
      <Text style={styles.mono}>EXPO_PUBLIC_API_BASE_URL</Text>
      <Text style={styles.monoDim}>{API_BASE_URL || '(unset)'}</Text>

      <View style={[styles.pill, pill]}>
        <Text style={styles.pillText}>
          {status === 'ok' ? `API: OK${version ? ` · v${version}` : ''}` : status === 'down' ? 'API: DOWN' : 'API: …'}
        </Text>
      </View>

      <Text style={styles.footer}>SITE MANAGER APP · SPRINT 0 BOOT</Text>
    </View>
  );
}

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0A0A0A', padding: 24, justifyContent: 'center', gap: 12 },
  kicker: { color: '#FF6B00', fontFamily: MONO, fontSize: 12, letterSpacing: 2 },
  title: { color: '#F5F5F0', fontSize: 34, fontWeight: '900', letterSpacing: 1 },
  mono: { color: '#8A8A8A', fontFamily: MONO, fontSize: 12, marginTop: 16, letterSpacing: 1 },
  monoDim: { color: '#F5F5F0', fontFamily: MONO, fontSize: 14 },
  pill: { alignSelf: 'flex-start', borderWidth: 2, borderColor: '#0A0A0A', paddingVertical: 8, paddingHorizontal: 14, marginTop: 16 },
  pillOk: { backgroundColor: '#1F7A3A' },
  pillDown: { backgroundColor: '#B91C1C' },
  pillChecking: { backgroundColor: '#8A8A8A' },
  pillText: { color: '#F5F5F0', fontFamily: MONO, fontWeight: '700', letterSpacing: 1 },
  footer: { position: 'absolute', bottom: 32, left: 24, color: '#3D3D3D', fontFamily: MONO, fontSize: 10, letterSpacing: 2 },
});
