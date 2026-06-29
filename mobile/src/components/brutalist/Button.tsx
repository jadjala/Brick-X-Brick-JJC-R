import { useState } from 'react';
import { Pressable, Text, View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts, borderW, shadowOffset } from '../../theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'blue' | 'ghost';

const FILL: Record<Variant, string> = {
  primary: colors.orange,
  secondary: colors.paper,
  danger: colors.red,
  blue: colors.blue,
  ghost: 'transparent',
};
const LABEL_COLOR: Record<Variant, string> = {
  primary: colors.paper,
  secondary: colors.ink,
  danger: colors.paper,
  blue: colors.paper,
  ghost: colors.ink,
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const [pressed, setPressed] = useState(false);
  const showShadow = variant !== 'ghost' && !pressed && !disabled;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={disabled}
      style={[{ position: 'relative' }, style]}
    >
      {showShadow && <View pointerEvents="none" style={styles.shadow} />}
      <View
        style={[
          styles.body,
          { backgroundColor: FILL[variant] },
          pressed && !disabled && { transform: [{ translateX: shadowOffset }, { translateY: shadowOffset }] },
          disabled && { opacity: 0.5 },
        ]}
      >
        <Text style={[styles.label, { color: LABEL_COLOR[variant] }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shadow: { position: 'absolute', top: shadowOffset, left: shadowOffset, width: '100%', height: '100%', backgroundColor: colors.ink },
  body: {
    minHeight: 48,
    borderWidth: borderW,
    borderColor: colors.ink,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontFamily: fonts.monoBold, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase' },
});
