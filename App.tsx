import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  ActivityIndicator,
  Text,
  Platform,
  AppState,
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
import { SwipeTabPager } from './src/components/common/SwipeTabPager';
import { PartyScreen } from './src/screens/PartyScreen';
import { ResultsScreen } from './src/screens/ResultsScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { InAppNotificationBanner } from './src/components/notifications/InAppNotificationBanner';
import { useNotificationStore } from './src/store/useNotificationStore';
import {
  addNotificationResponseListener,
  getInitialNotificationResponse,
} from './src/services/notificationService';
import { OfflineStatusBar } from './src/components/common/OfflineStatusBar';
import { initializeNetworkService } from './src/services/networkService';
import {
  addQueueDrainedListener,
  flushOfflineQueue,
  hasPendingCloudWrites,
  hydrateOfflineQueue,
} from './src/api/cloudQueue';
import {
  checkForAppUpdate,
  UpdateCheckResult,
} from './src/services/updateService';
import { UpdateModal } from './src/components/update/UpdateModal';

function MainApp() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const isHydrated = usePartyStore((s) => s.isHydrated);
  const hydrate = usePartyStore((s) => s.hydrate);
  const currentParty = usePartyStore((s) => s.currentParty);
  const session = usePartyStore((s) => s.session);

  const [currentTab, setCurrentTab] = useState<TabId>('party');
  const initNotifications = useNotificationStore((s) => s.init);

  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);

  // Poll the shared Google Sheets room so other devices' changes show up.
  useCloudAutoSync();

  useEffect(() => {
    hydrate();
    initNotifications();
    void hydrateOfflineQueue();

    const unsubNet = initializeNetworkService({
      onReconnect: () => {
        if (hasPendingCloudWrites()) {
          flushOfflineQueue();
        } else {
          void usePartyStore.getState().syncWithCloud({ background: true });
        }
      },
    });

    const unsubDrained = addQueueDrainedListener(() => {
      void usePartyStore.getState().syncWithCloud({ background: true });
    });

    return () => {
      unsubNet();
      unsubDrained();
    };
  }, [hydrate, initNotifications]);

  useEffect(() => {
    const handleNotificationData = (data: any) => {
      if (data?.type === 'debt_reminder' || data?.type === 'payment_status') {
        setCurrentTab('results');
      } else if (data?.type === 'party_closed') {
        setCurrentTab('history');
      } else {
        setCurrentTab('party');
      }
    };

    // Cold-start handling when app opened from killed state by tapping notification
    void getInitialNotificationResponse().then((initial) => {
      if (initial) {
        handleNotificationData(initial.notification.request.content.data);
      }
    });

    const unsub = addNotificationResponseListener((response) => {
      handleNotificationData(response.notification.request.content.data);
    });
    return unsub;
  }, []);

  // Automatically detect when user grants notification permission in system settings
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void useNotificationStore.getState().refreshPermissionStatus();
      }
    });

    return () => {
      sub.remove();
    };
  }, []);

  // Check for updates automatically upon app launch
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const res = await checkForAppUpdate();
        if (res.hasUpdate) {
          setUpdateInfo(res);
          setIsUpdateModalOpen(true);
        }
      } catch {
        // Silent fail on auto-check
      }
    }, 2800);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.body.style.backgroundColor = theme.colors.backgroundSecondary;
      if (document.documentElement) {
        document.documentElement.style.backgroundColor = theme.colors.backgroundSecondary;
      }
    }
  }, [theme.colors.backgroundSecondary]);

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

          {/* Interactive In-App Notification Banner */}
          <InAppNotificationBanner
            onPressNotification={(notif) => {
              if (notif.type === 'debt_reminder' || notif.type === 'payment_status') {
                setCurrentTab('results');
              } else if (notif.type === 'party_closed') {
                setCurrentTab('history');
              } else {
                setCurrentTab('party');
              }
            }}
          />

          {!session ? (
            <AuthScreen />
          ) : (
            <>
              {/* Global Dynamic Header */}
              <Header />

              {/* Offline & Sync Status Indicator Banner */}
              <OfflineStatusBar />

              {/* Swipeable Screen Content with Gesture Navigation */}
              <SwipeTabPager currentTab={currentTab} onSelectTab={setCurrentTab}>
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
                {currentTab === 'history' && <HistoryScreen />}
              </SwipeTabPager>

              {/* Bottom Tab Bar */}
              <TabBar
                currentTab={currentTab}
                onSelectTab={setCurrentTab}
                itemsBadgeCount={(currentParty.expenses || []).length}
                participantsBadgeCount={(currentParty.participants || []).length}
              />
            </>
          )}
        </SafeAreaView>

        {/* In-App Update Modal */}
        <UpdateModal
          visible={isUpdateModalOpen}
          onClose={() => setIsUpdateModalOpen(false)}
          updateInfo={updateInfo}
        />
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
