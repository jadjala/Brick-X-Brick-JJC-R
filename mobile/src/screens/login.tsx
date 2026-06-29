import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TriangleAlert } from 'lucide-react-native';
import { useAuth } from '../contexts/auth';
import { Button, TextField } from '../components/brutalist';
import { colors, fonts, borderW, space } from '../theme';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const e: { email?: string; password?: string } = {};
    if (!email) e.email = 'Required';
    else if (!EMAIL_RE.test(email)) e.email = 'Enter a valid email';
    if (!password) e.password = 'Required';
    setErrors(e);
    if (Object.keys(e).length) return;

    setServerError(null);
    setSubmitting(true);
    try {
      await signIn(email.trim(), password); // navigation auto-switches on session
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.wordmark}>BRICK × BRICK</Text>
            <Text style={styles.subtitle}>SITE MANAGER</Text>
          </View>

          <View style={styles.hazard}>
            <TriangleAlert color={colors.ink} size={16} strokeWidth={2.5} />
            <Text style={styles.hazardText}>AUTHORIZED PERSONNEL ONLY</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.signin}>SIGN IN</Text>

            {serverError && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorCode}>DENIED</Text>
                <Text style={styles.errorMsg}>{serverError}</Text>
              </View>
            )}

            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@bxb.test"
              keyboardType="email-address"
              autoComplete="email"
              error={errors.email}
            />
            <TextField
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              autoComplete="password"
              error={errors.password}
            />
            <Button
              label={submitting ? '[ Authenticating... ]' : 'Sign In'}
              variant="primary"
              onPress={submit}
              disabled={submitting}
              style={{ marginTop: space.g1 }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink },
  scroll: { flexGrow: 1, justifyContent: 'center' },
  header: { paddingHorizontal: space.g3, paddingBottom: space.g2 },
  wordmark: { fontFamily: fonts.display, fontSize: 36, color: colors.paper, letterSpacing: 1 },
  subtitle: { fontFamily: fonts.monoBold, fontSize: 13, color: colors.orange, letterSpacing: 4, marginTop: 4 },
  hazard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.yellow,
    borderTopWidth: borderW,
    borderBottomWidth: borderW,
    borderColor: colors.ink,
    paddingHorizontal: space.g3,
    paddingVertical: 8,
  },
  hazardText: { fontFamily: fonts.monoBold, fontSize: 12, letterSpacing: 2, color: colors.ink },
  form: { backgroundColor: colors.paper, padding: space.g3, paddingTop: space.g4, gap: space.g2, flex: 1 },
  signin: { fontFamily: fonts.display, fontSize: 26, color: colors.ink, letterSpacing: 1, marginBottom: space.g1 },
  errorBanner: { flexDirection: 'row', borderWidth: borderW, borderColor: colors.ink, backgroundColor: colors.red },
  errorCode: {
    fontFamily: fonts.monoBold,
    fontSize: 12,
    color: colors.paper,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRightWidth: borderW,
    borderRightColor: colors.paper,
    letterSpacing: 1,
  },
  errorMsg: { flex: 1, fontFamily: fonts.mono, fontSize: 13, color: colors.paper, padding: 10 },
});
