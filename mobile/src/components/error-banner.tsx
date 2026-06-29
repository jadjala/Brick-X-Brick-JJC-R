import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Text, View, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, borderW } from '../theme';
import { ApiError } from '../lib/api';

// RN has no global toast; this is a simple top error banner (auto-dismiss 4s).
type BannerCtx = { showError: (err: unknown) => void; showMessage: (message: string, code?: string) => void };
const Ctx = createContext<BannerCtx | undefined>(undefined);

export function BannerProvider({ children }: { children: ReactNode }) {
  const [banner, setBanner] = useState<{ message: string; code: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showMessage = useCallback((message: string, code = 'ERROR') => {
    setBanner({ message, code });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setBanner(null), 4000);
  }, []);

  const showError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError) showMessage(err.message, err.code);
      else showMessage(err instanceof Error ? err.message : 'Something went wrong.', 'ERROR');
    },
    [showMessage],
  );

  return (
    <Ctx.Provider value={{ showError, showMessage }}>
      {children}
      {banner && (
        <SafeAreaView edges={['top']} style={styles.safe} pointerEvents="box-none">
          <Pressable onPress={() => setBanner(null)} style={styles.banner}>
            <View style={styles.codeBox}>
              <Text style={styles.code}>{banner.code}</Text>
            </View>
            <Text style={styles.message} numberOfLines={2}>
              {banner.message}
            </Text>
          </Pressable>
        </SafeAreaView>
      )}
    </Ctx.Provider>
  );
}

export function useBanner(): BannerCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useBanner must be used within <BannerProvider>');
  return ctx;
}

const styles = StyleSheet.create({
  safe: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100 },
  banner: {
    flexDirection: 'row',
    alignItems: 'stretch',
    margin: 12,
    borderWidth: borderW,
    borderColor: colors.ink,
    backgroundColor: colors.red,
  },
  codeBox: { justifyContent: 'center', paddingHorizontal: 10, borderRightWidth: borderW, borderRightColor: colors.paper },
  code: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1, color: colors.paper, textTransform: 'uppercase' },
  message: { flex: 1, paddingHorizontal: 10, paddingVertical: 10, fontFamily: fonts.mono, fontSize: 13, color: colors.paper },
});
