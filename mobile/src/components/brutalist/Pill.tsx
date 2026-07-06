import { Text, View, StyleSheet } from 'react-native';
import { colors, fonts, borderW, statusColor } from '../../theme';
import type { RowStatus, Role } from '../../lib/types';

const LABEL: Record<RowStatus, string> = {
  clocked_in: 'Clocked In',
  clocked_out: 'Clocked Out',
  absent: 'Absent',
  no_record: 'No Record',
};

export function StatusPill({ status }: { status: RowStatus }) {
  const fill = statusColor[status];
  const textColor = status === 'no_record' ? colors.ink : colors.paper;
  return (
    <View style={[styles.pill, { backgroundColor: fill }]}>
      <Text style={[styles.text, { color: textColor }]}>{LABEL[status]}</Text>
    </View>
  );
}

export const ROLE_ABBR: Record<Role, string> = {
  admin: 'ADMIN',
  general_manager: 'GM',
  project_manager: 'PM',
  site_manager: 'SM',
};

export function RolePill({ role }: { role: Role }) {
  return (
    <View style={[styles.pill, { backgroundColor: colors.ink }]}>
      <Text style={[styles.text, { color: colors.paper, fontSize: 10 }]}>{ROLE_ABBR[role]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderWidth: borderW,
    borderColor: colors.ink,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  text: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
});
