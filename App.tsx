import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  ActivityIndicator,
  Text,
  Platform,
} from 'react-native';
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { usePartyStore } from './src/store/usePartyStore';
import { useCloudAutoSync } from './src/hooks/useCloudAutoSync';
import { ToastProvider } from './src/components/common/Toast';
import { Header } from './src/components/common/Header';
import { TabBar, TabId } from './src/components/common/TabBar';
import { PartyScreen } from './src/screens/PartyScreen';
import { ResultsScreen } from './src/screens/ResultsScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';

function MainApp() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const isHydrated = usePartyStore((s) => s.isHydrated);
  const hydrate = usePartyStore((s) => s.hydrate);
  const currentParty = usePartyStore((s) => s.currentParty);

  const [currentTab, setCurrentTab] = useState<TabId>('party');

  // Poll the shared Google Sheets room so other devices' changes show up.
  useCloudAutoSync();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!isHydrated) {
    return (
      <View
        style={[
          styles.loadingContainer,
          {
            backgroundColor: theme.colors.background,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        <ExpoStatusBar style={theme.statusBarStyle} />
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text
          style={[
            styles.loadingText,
            { color: theme.colors.textSecondary },
          ]}
        >
          Загрузка PartySplit...
        </Text>
      </View>
    );
  }

  return (
    <ToastProvider>
      <View
        style={[
          styles.webWrapper,
          { backgroundColor: theme.colors.backgroundSecondary },
        ]}
      >
        <SafeAreaView
          edges={['top', 'left', 'right']}
          style={[
            styles.rootSafeArea,
            {
              backgroundColor: theme.colors.background,
              borderColor:
                Platform.OS === 'web'
                  ? theme.colors.surfaceBorder
                  : 'transparent',
            },
          ]}
        >
          <ExpoStatusBar style={theme.statusBarStyle} />

          {/* Global Dynamic Header */}
          <Header />

          {/* Active Screen */}
          <View style={styles.mainContent}>
            {currentTab === 'party' && (
              <PartyScreen onNavigateToResults={() => setCurrentTab('results')} />
            )}
            {currentTab === 'results' && (
              <ResultsScreen
                onNavigateToParty={() => setCurrentTab('party')}
                onNavigateToProfile={() => setCurrentTab('profile')}
              />
            )}
            {currentTab === 'profile' && <ProfileScreen />}
            {currentTab === 'history' && (
              <HistoryScreen onNavigateToParty={() => setCurrentTab('party')} />
            )}
          </View>

          {/* Bottom Tab Bar */}
          <TabBar
            currentTab={currentTab}
            onSelectTab={setCurrentTab}
            itemsBadgeCount={(currentParty.expenses || []).length}
            participantsBadgeCount={(currentParty.participants || []).length}
          />
        </SafeAreaView>
      </View>
    </ToastProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <MainApp />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  webWrapper: {
    flex: 1,
  },
  rootSafeArea: {
    flex: 1,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 520 : undefined,
    alignSelf: 'center',
    borderLeftWidth: Platform.OS === 'web' ? 1 : 0,
    borderRightWidth: Platform.OS === 'web' ? 1 : 0,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 14,
    letterSpacing: 0.2,
  },
  mainContent: {
    flex: 1,
  },
});
