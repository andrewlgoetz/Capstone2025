import React, { useState, useCallback, useMemo } from 'react';
import { StyleSheet, FlatList, View, Text, ActivityIndicator, RefreshControl, TextInput, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

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
  const { userLocations } = useAuth();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const colorScheme = useColorScheme();

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [movementFilter, setMovementFilter] = useState<string>('All');
  const [locationFilter, setLocationFilter] = useState<string>('All');
  const [showMovementPicker, setShowMovementPicker] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

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

  // Filter items based on search and filters
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Search filter
      const matchesSearch = item.item_name.toLowerCase().includes(searchQuery.toLowerCase());
      // Movement filter
      const matchesMovement = movementFilter === 'All' || item.movement_type.toUpperCase() === movementFilter.toUpperCase();
      // Location filter
      const matchesLocation = locationFilter === 'All' || item.location_name === locationFilter;
      return matchesSearch && matchesMovement && matchesLocation;
    });
  }, [items, searchQuery, movementFilter, locationFilter]);

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
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Recent Activity</Text>
          <TouchableOpacity
            onPress={() => setShowFilters(!showFilters)}
            style={[
              styles.filterToggleButton,
              (searchQuery || movementFilter !== 'All' || locationFilter !== 'All') && styles.filterToggleButtonActive
            ]}
          >
            <Text style={styles.filterToggleIcon}>{showFilters ? '✕' : '⚙'}</Text>
            {(searchQuery || movementFilter !== 'All' || locationFilter !== 'All') && (
              <View style={styles.filterActiveBadge} />
            )}
          </TouchableOpacity>
        </View>

        {/* Collapsible Search and Filters */}
        {showFilters && (
          <>
            {/* Search Input */}
            <TextInput
              style={styles.searchInput}
              placeholder="Search items..."
              placeholderTextColor="#a0a0c0"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />

            {/* Filter Chips */}
            <View style={styles.filterRow}>
              <TouchableOpacity
                style={styles.filterChip}
                onPress={() => setShowMovementPicker(true)}
              >
                <Text style={styles.filterChipText}>
                  {movementFilter === 'All' ? 'All Movements' : movementFilter}
                </Text>
                <Text style={styles.filterChevron}>▼</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.filterChip}
                onPress={() => setShowLocationPicker(true)}
              >
                <Text style={styles.filterChipText}>
                  {locationFilter === 'All' ? 'All Locations' : locationFilter}
                </Text>
                <Text style={styles.filterChevron}>▼</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <ThemedText>No activity matches your filters.</ThemedText>
            </View>
          }
        />
      )}

      {/* Movement Filter Modal */}
      <Modal
        visible={showMovementPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMovementPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Filter by Movement</Text>
            <ScrollView>
              {['All', 'Inbound', 'Outbound', 'Adjustment'].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.modalOption,
                    movementFilter === type && styles.modalOptionActive
                  ]}
                  onPress={() => {
                    setMovementFilter(type);
                    setShowMovementPicker(false);
                  }}
                >
                  <Text style={[
                    styles.modalOptionText,
                    movementFilter === type && styles.modalOptionTextActive
                  ]}>
                    {type}
                  </Text>
                  {movementFilter === type && <Text style={styles.checkMark}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Location Filter Modal */}
      <Modal
        visible={showLocationPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLocationPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Filter by Location</Text>
            <ScrollView>
              <TouchableOpacity
                style={[
                  styles.modalOption,
                  locationFilter === 'All' && styles.modalOptionActive
                ]}
                onPress={() => {
                  setLocationFilter('All');
                  setShowLocationPicker(false);
                }}
              >
                <Text style={[
                  styles.modalOptionText,
                  locationFilter === 'All' && styles.modalOptionTextActive
                ]}>
                  All Locations
                </Text>
                {locationFilter === 'All' && <Text style={styles.checkMark}>✓</Text>}
              </TouchableOpacity>

              {userLocations.map((loc) => (
                <TouchableOpacity
                  key={loc.location_id}
                  style={[
                    styles.modalOption,
                    locationFilter === loc.name && styles.modalOptionActive
                  ]}
                  onPress={() => {
                    setLocationFilter(loc.name);
                    setShowLocationPicker(false);
                  }}
                >
                  <Text style={[
                    styles.modalOptionText,
                    locationFilter === loc.name && styles.modalOptionTextActive
                  ]}>
                    {loc.name}
                  </Text>
                  {locationFilter === loc.name && <Text style={styles.checkMark}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  filterToggleButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    position: 'relative',
  },
  filterToggleButtonActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.3)',
  },
  filterToggleIcon: {
    fontSize: 18,
    color: '#fff',
  },
  filterActiveBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  searchInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#fff',
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  filterChipText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '500',
  },
  filterChevron: {
    fontSize: 10,
    color: '#fff',
    marginLeft: 4,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 20,
    width: '80%',
    maxHeight: '60%',
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  modalOptionActive: {
    backgroundColor: '#2C2C3E',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#888',
  },
  modalOptionTextActive: {
    color: '#4f46e5',
    fontWeight: '600',
  },
  checkMark: {
    fontSize: 18,
    color: '#4f46e5',
    fontWeight: 'bold',
  },
});
