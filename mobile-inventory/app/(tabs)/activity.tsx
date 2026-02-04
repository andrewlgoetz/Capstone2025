import React, { useState, useCallback } from 'react';
import { StyleSheet, FlatList, View, Text, ActivityIndicator, RefreshControl, Platform } from 'react-native';
import axios from 'axios';
import { useFocusEffect } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';

// !!! REPLACE WITH YOUR IP !!!
const API_URL = 'http://xxx:8000'; 

interface ActivityItem {
  id: number;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  location: string;
  expiration: string | null;
}

export default function ActivityScreen() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const colorScheme = useColorScheme();

  const fetchItems = async () => {
    try {
      const response = await axios.get<ActivityItem[]>(`${API_URL}/inventory/history?limit=20`);
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

  const renderItem = ({ item }: { item: ActivityItem }) => {
    return (
      <View style={[styles.card, { backgroundColor: colorScheme === 'dark' ? '#1C1C1E' : '#FFFFFF' }]}>
        {/* Icon Box */}
        <View style={styles.iconBox}>
          <IconSymbol size={24} name="archivebox.fill" color="#4F46E5" />
        </View>

        {/* Details Column */}
        <View style={styles.details}>
          <ThemedText type="defaultSemiBold" style={styles.itemName}>{item.name}</ThemedText>
          <ThemedText style={styles.subtext}>
            {item.category} • {item.location}
          </ThemedText>
        </View>

        {/* Quantity Column */}
        <View style={styles.quantityBox}>
          <Text style={[styles.quantity, { color: colorScheme === 'dark' ? '#FFF' : '#000' }]}>
            {item.quantity}
          </Text>
          <Text style={styles.unit}>{item.unit}</Text>
        </View>
      </View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title">Recently Added</ThemedText>
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
              <ThemedText>No items found.</ThemedText>
            </View>
          }
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 10,
  },
  listContent: { paddingHorizontal: 20, paddingBottom: 20 },
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
    backgroundColor: 'rgba(79, 70, 229, 0.1)', // Light Indigo
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  details: { flex: 1 },
  itemName: { fontSize: 16, marginBottom: 4 },
  subtext: { fontSize: 12, color: '#8E8E93' },
  quantityBox: { minWidth: 40, alignItems: 'flex-end' },
  quantity: { fontSize: 18, fontWeight: '700' },
  unit: { fontSize: 12, color: '#8E8E93' },
});