import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors, borderW } from '../../theme';
import { HardShadow } from './HardShadow';

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <HardShadow style={style}>
      <View style={styles.card}>{children}</View>
    </HardShadow>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: borderW, borderColor: colors.ink, backgroundColor: colors.paper, padding: 16 },
});
