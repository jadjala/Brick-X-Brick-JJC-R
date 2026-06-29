import { View, type ViewStyle, type StyleProp } from 'react-native';
import { colors, shadowOffset } from '../../theme';

// Brutalist hard offset shadow: a same-sized ink View placed behind the child at
// (offset, offset). iOS's native shadow is soft/blurred — this is the only way
// to get the 4px hard offset (CLAUDE.md gotcha #6).
export function HardShadow({
  children,
  offset = shadowOffset,
  color = colors.ink,
  style,
}: {
  children: React.ReactNode;
  offset?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ position: 'relative' }, style]}>
      <View
        pointerEvents="none"
        style={{ position: 'absolute', top: offset, left: offset, width: '100%', height: '100%', backgroundColor: color }}
      />
      {children}
    </View>
  );
}
