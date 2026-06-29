import { useState } from 'react';
import { Text, TextInput, View, StyleSheet, type KeyboardTypeOptions } from 'react-native';
import { colors, fonts, borderW, shadowOffset, space } from '../../theme';

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  error,
  keyboardType,
  autoCapitalize = 'none',
  autoComplete,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  error?: string;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoComplete?: 'email' | 'password' | 'off';
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={{ position: 'relative' }}>
        {focused && <View pointerEvents="none" style={styles.shadow} />}
        <TextInput
          style={[styles.input, focused && { transform: [{ translateX: -shadowOffset }, { translateY: -shadowOffset }] }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.concrete}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          autoCorrect={false}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.steel },
  shadow: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: colors.ink },
  input: {
    height: 48,
    borderWidth: borderW,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    paddingHorizontal: space.g2,
    fontFamily: fonts.mono,
    fontSize: 15,
    color: colors.ink,
  },
  error: { fontFamily: fonts.mono, fontSize: 12, color: colors.red },
});
