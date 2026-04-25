// ============================================================
// NAVEGAÃ‡ÃƒO PRINCIPAL â€” 002
// ============================================================

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, FONTS, SPACING, STORAGE_KEYS } from '../constants';
import type { MainTabParamList, RootStackParamList } from '../types';
import { useAuth } from '../auth/AuthContext';

import TabDashboardSvg from '../assets/icons/tab_dashboard.svg';
import TabRegistarSvg from '../assets/icons/tab_registar.svg';
import TabProdutosSvg from '../assets/icons/tab_produtos.svg';
import TabFiadoSvg from '../assets/icons/tab_fiado.svg';
import TabMaisSvg from '../assets/icons/tab_mais.svg';

const Tab = createBottomTabNavigator<MainTabParamList>();
const RootStack = createStackNavigator<RootStackParamList>();

import DashboardScreen from '../screens/dashboard/DashboardScreen';
import SalesScreen from '../screens/sales/SalesScreen';
import InventoryScreen from '../screens/inventory/InventoryScreen';
import DebtsScreen from '../screens/debts/DebtsScreen';
import MoreScreen from '../screens/settings/MoreScreen';
import OnboardingScreen from '../screens/auth/OnboardingScreen';
import AuthScreen from '../screens/auth/AuthScreen';
import VerifyScreen from '../screens/auth/VerifyScreen';

// Ãcone simples para a tab bar (substitui quando tiveres react-native-vector-icons)
const TAB_ICONS: Record<string, React.ComponentType<any>> = {
  Dashboard: TabDashboardSvg,
  Sales: TabRegistarSvg,
  Inventory: TabProdutosSvg,
  Debts: TabFiadoSvg,
  More: TabMaisSvg,
};

const TabIcon = ({ name, focused }: { name: string; focused: boolean }) => {
  const Icon = TAB_ICONS[name] ?? TabDashboardSvg;
  const size = focused ? 26 : 24;
  return (
    <View style={[styles.tabIconContainer, focused && styles.tabIconFocused]}>
      <Icon width={size} height={size} />
    </View>
  );
};
// ---- TAB NAVIGATOR ----
const MainTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarActiveTintColor: COLORS.primary,
      tabBarInactiveTintColor: COLORS.textMuted,
      tabBarStyle: styles.tabBar,
      tabBarLabelStyle: styles.tabLabel,
      tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
    })}
  >
    <Tab.Screen
      name="Dashboard"
      component={DashboardScreen as any}
      options={{ tabBarLabel: 'Inicio' }}
    />
    <Tab.Screen
      name="Sales"
      component={SalesScreen as any}
      options={{ tabBarLabel: 'Vendas' }}
    />
    <Tab.Screen
      name="Inventory"
      component={InventoryScreen as any}
      options={{ tabBarLabel: 'Produtos' }}
    />
    <Tab.Screen
      name="Debts"
      component={DebtsScreen as any}
      options={{ tabBarLabel: 'Fiado' }}
    />
    <Tab.Screen
      name="More"
      component={MoreScreen as any}
      options={{ tabBarLabel: 'Mais' }}
    />
  </Tab.Navigator>
);

// ---- ROOT NAVIGATOR ----
export const AppNavigator = () => {
  const auth = useAuth();
  const [isOnboarded, setIsOnboarded] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEYS.onboarded)
      .then((v) => {
        if (!cancelled) setIsOnboarded(v === '1');
      })
      .catch(() => {
        if (!cancelled) setIsOnboarded(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (isOnboarded === null || auth.status === 'loading') return <LoadingScreen />;

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {!isOnboarded ? (
          <RootStack.Screen name="Onboarding">
            {(props) => (
              <OnboardingScreen
                {...props}
                onDone={() => {
                  setIsOnboarded(true);
                }}
              />
            )}
          </RootStack.Screen>
        ) : auth.status === 'unauthenticated' ? (
          <RootStack.Screen name="Auth" component={AuthScreen as any} />
        ) : auth.status === 'unverified' ? (
          <RootStack.Screen name="Verify" component={VerifyScreen as any} />
        ) : (
          <RootStack.Screen name="Main" component={MainTabs} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
};

const LoadingScreen = () => (
  <View style={styles.loading}>
    <Text style={styles.loadingText}>MyPME</Text>
  </View>
);

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.surface,
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.sm,
    height: 64,
  },
  tabLabel: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.medium,
    marginTop: 2,
  },
  tabIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconFocused: {
    transform: [{ translateY: -1 }],
  },
  tabIconText: {
    lineHeight: 26,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
  loadingText: {
    color: COLORS.textOnPrimary,
    fontSize: FONTS.sizes.xxl,
    fontWeight: FONTS.weights.bold,
  },
});

