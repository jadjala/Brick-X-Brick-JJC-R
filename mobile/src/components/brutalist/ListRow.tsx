import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors, borderW, space } from '../../theme';

// Roster / history row container: 2px ink bottom border.
export function ListRow({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  row: {
    borderBottomWidth: borderW,
    borderBottomColor: colors.ink,
    paddingHorizontal: space.g2,
    paddingVertical: space.g2,
    backgroundColor: colors.paper,
  },
});
