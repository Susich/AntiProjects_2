import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePartyStore } from '../store/usePartyStore';
import { ThemeTokens, useTheme } from '../context/ThemeContext';
import { ExpenseItem, ShoppingItem } from '../types';
import { ParticipantChips } from '../components/party/ParticipantChips';
import { BillItemList } from '../components/party/BillItemList';
import { AddItemModal } from '../components/party/AddItemModal';
import { CloudSyncModal } from '../components/party/CloudSyncModal';
import { ShoppingListView } from '../components/shopping/ShoppingListView';
import {
  AddShoppingItemModal,
  PARTY_PRESETS,
} from '../components/shopping/AddShoppingItemModal';
import { ConvertShoppingModal } from '../components/shopping/ConvertShoppingModal';
import { RoomQrModal } from '../components/party/RoomQrModal';
import { formatRubles } from '../utils/currency';
import { Button } from '../components/common/Button';
import { useToast } from '../components/common/Toast';
import { AnimatedNumber } from '../components/common/AnimatedNumber';

interface PartyScreenProps {
  onNavigateToResults: () => void;
}

export const PartyScreen: React.FC<PartyScreenProps> = ({ onNavigateToResults }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const currentParty = usePartyStore((s) => s.currentParty);
  const syncWithCloud = usePartyStore((s) => s.syncWithCloud);
  const { showToast } = useToast();

  const [subTab, setSubTab] = useState<'bill' | 'shopping'>('bill');

  // Expense Modals
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isCloudModalVisible, setIsCloudModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<ExpenseItem | null>(null);

  // Shopping Modals
  const [isAddShoppingModalVisible, setIsAddShoppingModalVisible] = useState(false);
  const [editingShoppingItem, setEditingShoppingItem] = useState<ShoppingItem | null>(null);
  const [shoppingPreset, setShoppingPreset] = useState<(typeof PARTY_PRESETS)[0] | null>(null);
  const [convertingShoppingItem, setConvertingShoppingItem] = useState<ShoppingItem | null>(null);
  const [isQrModalVisible, setIsQrModalVisible] = useState(false);

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Compute live total of all expenses
  const totalExpenses = (currentParty.expenses || []).reduce(
    (sum, exp) => sum + (Number(exp.amount) || 0),
    0
  );

  const shoppingList = currentParty.shoppingList || [];
  const boughtItems = shoppingList.filter((item) => item.isBought);
  const activeShoppingCount = shoppingList.filter((item) => !item.isBought).length;

  const totalShoppingActual = boughtItems.reduce(
    (sum, item) => sum + (item.actualAmount || item.estimatedAmount || 0),
    0
  );
  const totalShoppingEstimated = shoppingList.reduce(
    (sum, item) => sum + (item.estimatedAmount || 0),
    0
  );

  const handleOpenAddExpense = () => {
    if ((currentParty.participants || []).length === 0) {
      showToast('В комнате пока нет участников. Подключите общую комнату по коду.', {
        type: 'warning',
      });
      return;
    }
    setEditingItem(null);
    setIsAddModalVisible(true);
  };

  const handleEditExpenseItem = (item: ExpenseItem) => {
    setEditingItem(item);
    setIsAddModalVisible(true);
  };

  const handleOpenAddShopping = (preset?: (typeof PARTY_PRESETS)[0]) => {
    setEditingShoppingItem(null);
    setShoppingPreset(preset || null);
    setIsAddShoppingModalVisible(true);
  };

  const handleEditShoppingItem = (item: ShoppingItem) => {
    setEditingShoppingItem(item);
    setShoppingPreset(null);
    setIsAddShoppingModalVisible(true);
  };

  const handleConvertShoppingItem = (item: ShoppingItem) => {
    setConvertingShoppingItem(item);
  };

  // Pull-to-refresh: Sync with Google Sheets
  const handleRefresh = async () => {
    if (!currentParty.code) {
      showToast('Комната не подключена к Google Sheets. Создайте или войдите по коду.', {
        type: 'info',
      });
      return;
    }

    setIsRefreshing(true);
    const res = await syncWithCloud();
    setIsRefreshing(false);

    if (res.success) {
      showToast('Данные обновлены из Google Sheets!', { type: 'success' });
    } else {
      showToast(res.error || 'Ошибка синхронизации', { type: 'error' });
    }
  };

  return (
    <View style={styles.screenContainer}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
      >
        {/* Room Code & QR-code Header Bar */}
        {currentParty.code ? (
          <View style={styles.roomBar}>
            <TouchableOpacity
              style={styles.roomCodeChip}
              onPress={() => setIsCloudModalVisible(true)}
              activeOpacity={0.8}
            >
              <View style={styles.roomDot} />
              <Text style={styles.roomCodeText}>Комната #{currentParty.code}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.qrShareButton}
              onPress={() => setIsQrModalVisible(true)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Поделиться / QR-код"
            >
              <Ionicons name="qr-code-outline" size={15} color={theme.colors.neonCyan} />
              <Text style={styles.qrShareButtonText}>Поделиться / QR</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Participants Section */}
        <ParticipantChips onOpenCloud={() => setIsCloudModalVisible(true)} />

        {/* Segmented Sub-Tab Switcher */}
        <View style={styles.tabSwitcher}>
          <TouchableOpacity
            style={[styles.tabButton, subTab === 'bill' && styles.tabButtonActive]}
            onPress={() => setSubTab('bill')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="receipt-outline"
              size={16}
              color={subTab === 'bill' ? theme.colors.textInverse : theme.colors.textSecondary}
            />
            <Text
              style={[
                styles.tabButtonText,
                subTab === 'bill' && styles.tabButtonTextActive,
              ]}
            >
              Чек и траты
            </Text>
            {(currentParty.expenses || []).length > 0 && (
              <View
                style={[
                  styles.tabBadge,
                  subTab === 'bill' ? styles.tabBadgeActive : styles.tabBadgeInactive,
                ]}
              >
                <Text
                  style={[
                    styles.tabBadgeText,
                    subTab === 'bill'
                      ? styles.tabBadgeTextActive
                      : styles.tabBadgeTextInactive,
                  ]}
                >
                  {(currentParty.expenses || []).length}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, subTab === 'shopping' && styles.tabButtonActive]}
            onPress={() => setSubTab('shopping')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="cart-outline"
              size={16}
              color={subTab === 'shopping' ? theme.colors.textInverse : theme.colors.textSecondary}
            />
            <Text
              style={[
                styles.tabButtonText,
                subTab === 'shopping' && styles.tabButtonTextActive,
              ]}
            >
              Список покупок
            </Text>
            {shoppingList.length > 0 && (
              <View
                style={[
                  styles.tabBadge,
                  subTab === 'shopping'
                    ? styles.tabBadgeActive
                    : styles.tabBadgeInactive,
                ]}
              >
                <Text
                  style={[
                    styles.tabBadgeText,
                    subTab === 'shopping'
                      ? styles.tabBadgeTextActive
                      : styles.tabBadgeTextInactive,
                  ]}
                >
                  {boughtItems.length}/{shoppingList.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {subTab === 'bill' ? (
          <BillItemList
            onEditItem={handleEditExpenseItem}
            onOpenAddItem={handleOpenAddExpense}
          />
        ) : (
          <ShoppingListView
            onOpenAddItem={handleOpenAddShopping}
            onEditItem={handleEditShoppingItem}
            onConvertItem={handleConvertShoppingItem}
          />
        )}
      </ScrollView>

      {/* Docked Bottom Summary Bar */}
      <View style={styles.bottomBar}>
        {subTab === 'bill' ? (
          <View style={styles.bottomBarLeft}>
            <Text style={styles.bottomBarLabel}>ОБЩИЕ РАСХОДЫ</Text>
            <AnimatedNumber
              value={totalExpenses}
              formatter={formatRubles}
              style={styles.bottomBarAmount}
            />
            <Text style={styles.bottomBarHint} numberOfLines={1}>
              {currentParty.expenses?.length || 0} счетов • {currentParty.participants.length} чел.
            </Text>
          </View>
        ) : (
          <View style={styles.bottomBarLeft}>
            <Text style={styles.bottomBarLabel}>
              {boughtItems.length > 0 ? 'КУПЛЕНО В ЧЕК' : 'ПРИМЕРНЫЙ БЮДЖЕТ'}
            </Text>
            <AnimatedNumber
              value={boughtItems.length > 0 ? totalShoppingActual : totalShoppingEstimated}
              formatter={formatRubles}
              style={[
                styles.bottomBarAmount,
                boughtItems.length > 0 && { color: theme.colors.success },
              ]}
            />
            <Text style={styles.bottomBarHint} numberOfLines={1}>
              {boughtItems.length} из {shoppingList.length} куплено
              {activeShoppingCount > 0 ? ` • ${activeShoppingCount} осталось` : ' • всё готово!'}
            </Text>
          </View>
        )}

        <View style={styles.bottomBarActions}>
          <TouchableOpacity
            style={styles.floatingAddBtn}
            onPress={subTab === 'bill' ? handleOpenAddExpense : () => handleOpenAddShopping()}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={subTab === 'bill' ? 'Добавить расход' : 'Добавить покупку'}
          >
            <Ionicons name="add" size={24} color={theme.colors.textInverse} />
          </TouchableOpacity>

          <Button
            title="К расчёту"
            variant="primary"
            size="md"
            icon="arrow-forward"
            iconPosition="right"
            onPress={onNavigateToResults}
            disabled={(currentParty.expenses || []).length === 0}
          />
        </View>
      </View>

      {/* Add / Edit Expense Modal */}
      <AddItemModal
        visible={isAddModalVisible}
        onClose={() => {
          setIsAddModalVisible(false);
          setEditingItem(null);
        }}
        editItem={editingItem}
      />

      {/* Add / Edit Shopping Item Modal */}
      <AddShoppingItemModal
        visible={isAddShoppingModalVisible}
        onClose={() => {
          setIsAddShoppingModalVisible(false);
          setEditingShoppingItem(null);
          setShoppingPreset(null);
        }}
        editItem={editingShoppingItem}
        initialPreset={shoppingPreset}
      />

      {/* 1-Click Convert to Expense Modal */}
      <ConvertShoppingModal
        visible={Boolean(convertingShoppingItem)}
        onClose={() => setConvertingShoppingItem(null)}
        item={convertingShoppingItem}
      />

      {/* Cloud Sync Modal */}
      <CloudSyncModal
        visible={isCloudModalVisible}
        onClose={() => setIsCloudModalVisible(false)}
      />

      {/* Room QR Modal */}
      <RoomQrModal
        visible={isQrModalVisible}
        onClose={() => setIsQrModalVisible(false)}
        partyCode={currentParty.code || ''}
        partyTitle={currentParty.title}
        partyId={currentParty.id}
      />
    </View>
  );
};

function createStyles(theme: ThemeTokens) {
  return StyleSheet.create({
    screenContainer: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 40,
    },
    roomBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginBottom: 12,
    },
    roomCodeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },
    roomDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.success,
    },
    roomCodeText: {
      fontSize: 13,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      letterSpacing: 0.8,
    },
    qrShareButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      backgroundColor: `${theme.colors.neonCyan}16`,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: `${theme.colors.neonCyan}40`,
    },
    qrShareButtonText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.neonCyan,
    },
    tabSwitcher: {
      flexDirection: 'row',
      backgroundColor: theme.colors.surfaceElevated,
      borderRadius: 14,
      padding: 4,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      gap: 4,
    },
    tabButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 9,
      borderRadius: 10,
      gap: 6,
    },
    tabButtonActive: {
      backgroundColor: theme.colors.primary,
    },
    tabButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    tabButtonTextActive: {
      color: theme.colors.textInverse,
      fontWeight: '800',
    },
    tabBadge: {
      paddingVertical: 1,
      paddingHorizontal: 6,
      borderRadius: 10,
    },
    tabBadgeActive: {
      backgroundColor: 'rgba(255, 255, 255, 0.25)',
    },
    tabBadgeInactive: {
      backgroundColor: theme.colors.surfaceBorder,
    },
    tabBadgeText: {
      fontSize: 11,
      fontWeight: '800',
    },
    tabBadgeTextActive: {
      color: theme.colors.textInverse,
    },
    tabBadgeTextInactive: {
      color: theme.colors.textMuted,
    },
    cloudBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      backgroundColor: theme.colors.surfaceElevated,
      borderColor: theme.colors.surfaceBorder,
      marginBottom: 14,
    },
    cloudBannerText: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    bottomBar: {
      backgroundColor: theme.colors.surfaceElevated,
      borderTopWidth: 1,
      borderTopColor: theme.colors.surfaceBorderActive,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 16,
      minHeight: 68,
    },
    bottomBarLeft: {
      flex: 1,
      marginRight: 10,
      justifyContent: 'center',
    },
    bottomBarLabel: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.6,
      color: theme.colors.textMuted,
    },
    bottomBarAmount: {
      fontSize: 19,
      fontWeight: '800',
      letterSpacing: -0.3,
      color: theme.colors.primary,
    },
    bottomBarHint: {
      fontSize: 11,
      marginTop: 1,
      color: theme.colors.textSecondary,
    },
    bottomBarActions: {
      flexDirection: 'row',
      alignItems: 'center',
      flexShrink: 0,
    },
    floatingAddBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8,
    },
  });
}

