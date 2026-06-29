// SPEC §13.1 tokens, as React Native constants.

export const colors = {
  ink: '#0A0A0A',
  paper: '#F5F5F0',
  steel: '#3D3D3D',
  concrete: '#8A8A8A',
  orange: '#FF6B00',
  yellow: '#FFD60A',
  green: '#1F7A3A', // clocked_in
  red: '#B91C1C', // absent / errors
  blue: '#1E40AF', // clocked_out
} as const;

// Bundled Google Fonts (loaded in App.tsx via expo-font).
export const fonts = {
  mono: 'JetBrainsMono_400Regular',
  monoBold: 'JetBrainsMono_700Bold',
  display: 'SpaceGrotesk_700Bold',
  displayMed: 'SpaceGrotesk_500Medium',
  body: 'Inter_400Regular',
  bodySemi: 'Inter_600SemiBold',
} as const;

export const space = { g1: 8, g2: 16, g3: 24, g4: 32, g5: 48 } as const;

export const borderW = 2;
export const shadowOffset = 4; // hard offset for <HardShadow>

// Status pill fills (SPEC §13.2).
export const statusColor = {
  clocked_in: colors.green,
  clocked_out: colors.blue,
  absent: colors.red,
  no_record: colors.paper, // ink outline, ink text
} as const;
