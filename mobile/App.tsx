import 'react-native-url-polyfill/auto';
import { ActivityIndicator, Text, View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useFonts } from 'expo-font';
import { JetBrainsMono_400Regular, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';
import { SpaceGrotesk_500Medium, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { ClipboardList, History as HistoryIcon } from 'lucide-react-native';

import { colors, fonts } from './src/theme';
import { AuthProvider, useAuth } from './src/contexts/auth';
import { BannerProvider } from './src/components/error-banner';
import { LoginScreen } from './src/screens/login';
import { RosterScreen } from './src/screens/roster';
import { HistoryScreen } from './src/screens/history';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.paper, card: colors.ink, border: colors.ink, primary: colors.orange },
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.orange,
        tabBarInactiveTintColor: colors.concrete,
        tabBarStyle: { backgroundColor: colors.ink, borderTopWidth: 2, borderTopColor: colors.ink, height: 64, paddingBottom: 8, paddingTop: 8 },
        tabBarLabelStyle: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
      }}
    >
      <Tab.Screen
        name="Roster"
        component={RosterScreen}
        options={{ tabBarIcon: ({ color }) => <ClipboardList color={color} size={22} strokeWidth={2.5} /> }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{ tabBarIcon: ({ color }) => <HistoryIcon color={color} size={22} strokeWidth={2.5} /> }}
      />
    </Tab.Navigator>
  );
}

function Boot({ label }: { label: string }) {
  return (
    <View style={styles.boot}>
      <Text style={styles.bootKicker}>BRICK × BRICK</Text>
      <ActivityIndicator color={colors.orange} size="large" />
      <Text style={styles.bootLabel}>{label}</Text>
    </View>
  );
}

function Root() {
  const { session, loading } = useAuth();
  if (loading) return <Boot label="AUTHORIZING" />;
  return (
    <NavigationContainer theme={navTheme}>
      {session ? (
        <MainTabs />
      ) : (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    JetBrainsMono_400Regular,
    JetBrainsMono_700Bold,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
    Inter_400Regular,
    Inter_600SemiBold,
  });

  if (!fontsLoaded && !fontError) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={colors.orange} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <BannerProvider>
        <AuthProvider>
          <Root />
        </AuthProvider>
      </BannerProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', gap: 16 },
  bootKicker: { fontFamily: fonts.mono, fontSize: 12, letterSpacing: 3, color: colors.orange },
  bootLabel: { fontFamily: fonts.monoBold, fontSize: 12, letterSpacing: 4, color: colors.steel, textTransform: 'uppercase' },
});
