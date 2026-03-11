import React, { useState, useCallback } from 'react';
import { StyleSheet, FlatList, View, Text, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';
import api from '../../services/api';

// Updated interface to match the backend history endpoint
interface ActivityItem {
  id: number;
  item_name: string;
  category: string | null;
  quantity_change: number;
  movement_type: string;
  unit: string | null;
  location_name: string | null;
  user_name: string;
  timestamp: string;
}

export default function ActivityScreen() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const colorScheme = useColorScheme();

  const fetchItems = async () => {
    try {
      // Using the configured 'api' instance to include auth tokens automatically
      const response = await api.get<ActivityItem[]>('/inventory/history?limit=30');
      setItems(response.data);
    } catch (error) {
      console.log('Error fetching recent items:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchItems();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchItems();
  };

  // Helper to determine styling based on movement type/quantity
  const getActionStyles = (item: ActivityItem) => {
    const isPositive = item.quantity_change > 0;
    
    if (isPositive) {
      return { icon: 'arrow.down.circle.fill', color: '#10B981', bg: 'rgba(16, 185, 129, 0.1)' }; // Green
    } else {
      return { icon: 'arrow.up.circle.fill', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.1)' }; // Red
    }
  };

  const renderItem = ({ item }: { item: ActivityItem }) => {
    const stylesConfig = getActionStyles(item);
    
    // Format timestamp: "Oct 24" and "2:30 PM"
    const date = new Date(item.timestamp);
    const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const timeStr = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

    // Format quantity (add + sign for positive changes)
    const qtyText = item.quantity_change > 0 ? `+${item.quantity_change}` : `${item.quantity_change}`;

    return (
      <View style={[styles.card, { backgroundColor: colorScheme === 'dark' ? '#1C1C1E' : '#FFFFFF' }]}>
        {/* Icon Box */}
        <View style={[styles.iconBox, { backgroundColor: stylesConfig.bg }]}>
          <IconSymbol size={24} name={stylesConfig.icon as any} color={stylesConfig.color} />
        </View>

        {/* Details Column */}
        <View style={styles.details}>
          <ThemedText type="defaultSemiBold" style={styles.itemName}>{item.item_name}</ThemedText>
          
          <ThemedText style={styles.subtext}>
            {item.movement_type} • {item.location_name || 'No Location'} • By {item.user_name}
          </ThemedText>
          
          <ThemedText style={styles.timestamp}>
             {dateStr} at {timeStr}
          </ThemedText>
        </View>

        {/* Quantity Column */}
        <View style={styles.quantityBox}>
          <Text style={[styles.quantity, { color: stylesConfig.color }]}>
            {qtyText}
          </Text>
          {item.unit && <Text style={styles.unit}>{item.unit}</Text>}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Recent Activity</Text>
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <ThemedText>No recent activity found.</ThemedText>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    backgroundColor: '#4f46e5',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  listContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  details: { flex: 1 },
  itemName: { fontSize: 16, marginBottom: 2 },
  subtext: { fontSize: 12, color: '#8E8E93', marginBottom: 2, textTransform: 'capitalize' },
  timestamp: { fontSize: 11, color: '#C7C7CC' },
  quantityBox: { minWidth: 40, alignItems: 'flex-end' },
  quantity: { fontSize: 18, fontWeight: '700' },
  unit: { fontSize: 12, color: '#8E8E93' },
});