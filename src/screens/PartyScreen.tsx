import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  RefreshControl,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePartyStore } from '../store/usePartyStore';
import { useTheme } from '../context/ThemeContext';
import { ExpenseItem } from '../types';
import { ParticipantChips } from '../components/party/ParticipantChips';
import { BillItemList } from '../components/party/BillItemList';
import { AddItemModal } from '../components/party/AddItemModal';
import { CloudSyncModal } from '../components/party/CloudSyncModal';
import { formatRubles } from '../utils/currency';
import { Button } from '../components/common/Button';
import { useToast } from '../components/common/Toast';

interface PartyScreenProps {
  onNavigateToResults: () => void;
}

export const PartyScreen: React.FC<PartyScreenProps> = ({ onNavigateToResults }) => {
  const { theme } = useTheme();
  const currentParty = usePartyStore((s) => s.currentParty);
  const syncWithCloud = usePartyStore((s) => s.syncWithCloud);
  const { showToast } = useToast();

  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isCloudModalVisible, setIsCloudModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<ExpenseItem | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Compute live total of all expenses
  const totalExpenses = (currentParty.expenses || []).reduce(
    (sum, exp) => sum + (Number(exp.amount) || 0),
    0
  );

  const handleOpenAdd = () => {
    if ((currentParty.participants || []).length === 0) {
      showToast('Сначала добавьте себя или друга в сбор', { type: 'warning' });
      return;
    }
    setEditingItem(null);
    setIsAddModalVisible(true);
  };

  const handleEditItem = (item: ExpenseItem) => {
    setEditingItem(item);
    setIsAddModalVisible(true);
  };

  // Pull-to-refresh: Sync with Google Sheets
  const handleRefresh = async () => {
    if (!currentParty.code) {
      showToast('Свайпните вниз для обновления. Комната не подключена к Google Sheets', {
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screenContainer, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView
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
        {/* Cloud Room Status Indicator */}
        {currentParty.code && (
          <TouchableOpacity
            style={[
              styles.cloudBanner,
              {
                backgroundColor: `${theme.colors.neonCyan}12`,
                borderColor: `${theme.colors.neonCyan}40`,
              },
            ]}
            onPress={() => setIsCloudModalVisible(true)}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons
                name="cloud-done-outline"
                size={16}
                color={theme.colors.neonCyan}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.cloudBannerText, { color: theme.colors.neonCyan }]}>
                Google Sheets: Комната #{currentParty.code} • авто-обновление
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={theme.colors.neonCyan} />
          </TouchableOpacity>
        )}

        {/* Participants Section */}
        <ParticipantChips />

        {/* Expenses List Section */}
        <BillItemList
          onEditItem={handleEditItem}
          onOpenAddItem={handleOpenAdd}
        />
      </ScrollView>

      {/* Sticky Bottom Summary Bar */}
      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: theme.colors.surfaceElevated,
            borderTopColor: theme.colors.surfaceBorderActive,
          },
        ]}
      >
        <View style={styles.bottomBarLeft}>
          <Text style={[styles.bottomBarLabel, { color: theme.colors.textMuted }]}>
            ОБЩИЕ РАСХОДЫ
          </Text>
          <Text style={[styles.bottomBarAmount, { color: theme.colors.primary }]}>
            {formatRubles(totalExpenses)}
          </Text>
          <Text style={[styles.bottomBarHint, { color: theme.colors.textSecondary }]}>
            {currentParty.expenses?.length || 0} счетов • {currentParty.participants.length} чел.
          </Text>
        </View>

        <View style={styles.bottomBarActions}>
          <TouchableOpacity
            style={[
              styles.floatingAddBtn,
              {
                backgroundColor: theme.colors.primary,
              },
            ]}
            onPress={handleOpenAdd}
            activeOpacity={0.8}
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
            style={styles.resultsBtn}
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

      {/* Cloud Sync Modal */}
      <CloudSyncModal
        visible={isCloudModalVisible}
        onClose={() => setIsCloudModalVisible(false)}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 110,
  },
  cloudBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  cloudBannerText: {
    fontSize: 11,
    fontWeight: '700',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  bottomBarLeft: {
    flex: 1,
  },
  bottomBarLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  bottomBarAmount: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  bottomBarHint: {
    fontSize: 11,
  },
  bottomBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  floatingAddBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  resultsBtn: {
    paddingHorizontal: 18,
  },
});
