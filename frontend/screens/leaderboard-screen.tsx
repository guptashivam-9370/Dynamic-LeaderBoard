/**
 * LeaderboardScreen
 * 
 * Displays the leaderboard with LeetCode-style page-based pagination.
 * 
 * KEY PRINCIPLES:
 * - Data is fetched from GET /leaderboard?page=X&limit=Y
 * - Ranks come DIRECTLY from the backend - NEVER computed locally
 * - Data is displayed EXACTLY as received - NEVER sorted locally
 * - Page controls at the bottom (Prev | 1 2 3 4 5 | Next)
 * - Clicking a page number REPLACES current data with that page
 * - Auto-polling every 8 seconds refreshes current page data
 * 
 * PAGINATION LOGIC:
 * - Page state tracks current page number
 * - hasMore flag indicates if more data is available
 * - Page changes REPLACE data (not append)
 * - Pull-to-refresh reloads current page
 * - Batch size is 100 users per page
 * 
 * SIMULATE MODAL:
 * - Opens via "Simulate" button in header
 * - Allows updating a specific user's rating
 * - Does NOT compute ranks locally - re-fetches from backend
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { fetchLeaderboard, simulateUserRating, User, DEFAULT_PAGE_SIZE } from '@/api/api';
import { UserRow } from '@/components/user-row';
const POLLING_INTERVAL_MS = 8000;
const MIN_RATING = 100;
const MAX_RATING = 5000;
const VISIBLE_PAGES = 5;

export function LeaderboardScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [simulateUsername, setSimulateUsername] = useState('');
  const [simulateRating, setSimulateRating] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);
  
  const isMountedRef = useRef(true);
  const isFetchingRef = useRef(false);
  
  const flatListRef = useRef<FlatList>(null);
  
  /**
   * Fetch leaderboard data from the backend
   * 
   * @param pageNum - Page number to fetch
   * @param silent - Whether to show loading indicator
   */
  const loadLeaderboard = useCallback(async (pageNum: number = 1, silent: boolean = false) => {
    if (isFetchingRef.current && !silent) return;
    isFetchingRef.current = true;
    
    if (!silent) {
      setIsLoading(true);
    }
    
    try {


      const { users: newUsers, hasMore: moreAvailable } = await fetchLeaderboard(pageNum, DEFAULT_PAGE_SIZE);
      
      if (isMountedRef.current) {

        setUsers(newUsers);
        setPage(pageNum);
        setHasMore(moreAvailable);
        

        if (!moreAvailable && newUsers.length > 0) {
          setTotalPages(pageNum);
        } else if (moreAvailable) {
          setTotalPages(prev => Math.max(prev, pageNum + 1));
        }
        
        setError(null);
        setLastUpdated(new Date());
        

        if (!silent && flatListRef.current) {
          flatListRef.current.scrollToOffset({ offset: 0, animated: true });
        }
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
      isFetchingRef.current = false;
    }
  }, []);
  
  /**
   * Handle pull-to-refresh action
   * Refreshes current page data
   */
  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadLeaderboard(page, false);
  }, [loadLeaderboard, page]);
  
  /**
   * Navigate to a specific page
   */
  const goToPage = useCallback((pageNum: number) => {
    if (pageNum < 1 || isFetchingRef.current) return;
    loadLeaderboard(pageNum, false);
  }, [loadLeaderboard]);
  
  /**
   * Navigate to previous page
   */
  const goToPreviousPage = useCallback(() => {
    if (page > 1 && !isFetchingRef.current) {
      loadLeaderboard(page - 1, false);
    }
  }, [page, loadLeaderboard]);
  
  /**
   * Navigate to next page
   */
  const goToNextPage = useCallback(() => {
    if (hasMore && !isFetchingRef.current) {
      loadLeaderboard(page + 1, false);
    }
  }, [page, hasMore, loadLeaderboard]);
  
  /**
   * Initial data load and polling setup
   */
  useEffect(() => {
    isMountedRef.current = true;
    
    loadLeaderboard(1, false);
    
    return () => {
      isMountedRef.current = false;
    };
  }, [loadLeaderboard]);
  
  useEffect(() => {
    const pollInterval = setInterval(() => {
      if (!isFetchingRef.current) {
        loadLeaderboard(page, true);
      }
    }, POLLING_INTERVAL_MS);
    
    return () => clearInterval(pollInterval);
  }, [page, loadLeaderboard]);
  
  /**
   * Calculate visible page numbers for pagination controls
   */
  const getVisiblePageNumbers = useCallback((): number[] => {
    const pages: number[] = [];
    
    let startPage = Math.max(1, page - Math.floor(VISIBLE_PAGES / 2));
    let endPage = startPage + VISIBLE_PAGES - 1;
    
    if (endPage > totalPages) {
      endPage = totalPages;
      startPage = Math.max(1, endPage - VISIBLE_PAGES + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    if (pages.length === 0) {
      pages.push(page);
    }
    
    return pages;
  }, [page, totalPages]);
  
  /**
   * Render a single user row
   */
  const renderItem = useCallback(({ item }: { item: User }) => (
    <UserRow
      rank={item.rank}
      username={item.username}
      rating={item.rating}
    />
  ), []);
  
  /**
   * Key extractor for FlatList
   * Using username + rank to handle potential duplicates during refresh
   */
  const keyExtractor = useCallback((item: User, index: number) => `${item.username}-${index}`, []);
  
  /**
   * Render the header showing last update time
   */
  const renderHeader = () => (
    <View style={[styles.header, { backgroundColor: colors.background }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.text }]}>🏆 Leaderboard</Text>
        <TouchableOpacity
          style={[styles.simulateButton, { backgroundColor: colors.tint }]}
          onPress={() => setIsModalVisible(true)}
        >
          <Text style={styles.simulateButtonText}>Simulate</Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.subtitle, { color: colors.icon }]}>
        {users.length} Players • Page {page}
      </Text>
      {lastUpdated && (
        <Text style={[styles.updateTime, { color: colors.icon }]}>
          Updated: {lastUpdated.toLocaleTimeString()}
        </Text>
      )}
    </View>
  );
  
  /**
   * Handle simulate submission
   * Updates a specific user's rating and refreshes the leaderboard
   */
  const handleSimulate = async () => {
    const username = simulateUsername.trim();
    const rating = parseInt(simulateRating, 10);
    
    if (!username) {
      Alert.alert('Error', 'Please enter a username');
      return;
    }
    
    if (isNaN(rating) || rating < MIN_RATING || rating > MAX_RATING) {
      Alert.alert('Error', `Rating must be between ${MIN_RATING} and ${MAX_RATING}`);
      return;
    }
    
    setIsSimulating(true);
    
    try {
      await simulateUserRating(username, rating);
      

      setIsModalVisible(false);
      setSimulateUsername('');
      setSimulateRating('');
      

      loadLeaderboard(1, false);
      
      Alert.alert('Success', `Updated ${username}'s rating to ${rating}`);
    } catch (err) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Failed to update rating'
      );
    } finally {
      setIsSimulating(false);
    }
  };
  
  /**
   * Close modal and reset form state
   */
  const closeModal = () => {
    setIsModalVisible(false);
    setSimulateUsername('');
    setSimulateRating('');
  };
  
  /**
   * Render pagination controls (LeetCode style)
   */
  const renderPaginationControls = () => {
    const visiblePages = getVisiblePageNumbers();
    
    return (
      <View style={[styles.paginationContainer, { backgroundColor: colors.background }]}>
        {/* Previous Button */}
        <TouchableOpacity
          style={[
            styles.paginationButton,
            { backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0' },
            page === 1 && styles.paginationButtonDisabled,
          ]}
          onPress={goToPreviousPage}
          disabled={page === 1 || isLoading}
        >
          <Text style={[
            styles.paginationButtonText,
            { color: page === 1 ? colors.icon : colors.text },
          ]}>
            ← Prev
          </Text>
        </TouchableOpacity>
        
        {/* Page Numbers */}
        <View style={styles.pageNumbersContainer}>
          {visiblePages[0] > 1 && (
            <>
              <TouchableOpacity
                style={[styles.pageNumber, { backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0' }]}
                onPress={() => goToPage(1)}
                disabled={isLoading}
              >
                <Text style={[styles.pageNumberText, { color: colors.text }]}>1</Text>
              </TouchableOpacity>
              {visiblePages[0] > 2 && (
                <Text style={[styles.ellipsis, { color: colors.icon }]}>...</Text>
              )}
            </>
          )}
          
          {visiblePages.map((pageNum) => (
            <TouchableOpacity
              key={pageNum}
              style={[
                styles.pageNumber,
                { backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0' },
                pageNum === page && { backgroundColor: colors.tint },
              ]}
              onPress={() => goToPage(pageNum)}
              disabled={isLoading || pageNum === page}
            >
              <Text style={[
                styles.pageNumberText,
                { color: pageNum === page ? '#fff' : colors.text },
              ]}>
                {pageNum}
              </Text>
            </TouchableOpacity>
          ))}
          
          {hasMore && (
            <Text style={[styles.ellipsis, { color: colors.icon }]}>...</Text>
          )}
        </View>
        
        {/* Next Button */}
        <TouchableOpacity
          style={[
            styles.paginationButton,
            { backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0' },
            !hasMore && styles.paginationButtonDisabled,
          ]}
          onPress={goToNextPage}
          disabled={!hasMore || isLoading}
        >
          <Text style={[
            styles.paginationButtonText,
            { color: !hasMore ? colors.icon : colors.text },
          ]}>
            Next →
          </Text>
        </TouchableOpacity>
      </View>
    );
  };
  
  /**
   * Render empty state when no users are found
   */
  const renderEmpty = () => {
    if (isLoading) return null;
    
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyText, { color: colors.icon }]}>
          No users found
        </Text>
      </View>
    );
  };
  
  if (isLoading && users.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
          <Text style={[styles.loadingText, { color: colors.icon }]}>
            Loading leaderboard...
          </Text>
        </View>
      </SafeAreaView>
    );
  }
  
  if (error && users.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
          <Text
            style={[styles.retryText, { color: colors.tint }]}
            onPress={() => loadLeaderboard(1, false)}
          >
            Tap to retry
          </Text>
        </View>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        ref={flatListRef}
        data={users}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.tint}
            colors={[colors.tint]}
          />
        }

        removeClippedSubviews={true}
        maxToRenderPerBatch={20}
        windowSize={10}
        initialNumToRender={15}

        contentContainerStyle={users.length === 0 ? styles.emptyList : undefined}
        showsVerticalScrollIndicator={false}
      />
      
      {/* Pagination Controls */}
      {users.length > 0 && renderPaginationControls()}
      
      {/* Loading overlay for page transitions */}
      {isLoading && users.length > 0 && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      )}
      
      {/* Simulate Modal */}
      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: isDark ? '#1c1c1e' : '#fff' }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Simulate Rating Update
            </Text>
            
            <Text style={[styles.inputLabel, { color: colors.icon }]}>Username</Text>
            <TextInput
              style={[
                styles.modalInput,
                {
                  backgroundColor: isDark ? '#2c2c2e' : '#f5f5f5',
                  color: colors.text,
                  borderColor: isDark ? '#3c3c3e' : '#e0e0e0',
                },
              ]}
              placeholder="Enter username"
              placeholderTextColor={colors.icon}
              value={simulateUsername}
              onChangeText={setSimulateUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
            
            <Text style={[styles.inputLabel, { color: colors.icon }]}>
              New Rating ({MIN_RATING} - {MAX_RATING})
            </Text>
            <TextInput
              style={[
                styles.modalInput,
                {
                  backgroundColor: isDark ? '#2c2c2e' : '#f5f5f5',
                  color: colors.text,
                  borderColor: isDark ? '#3c3c3e' : '#e0e0e0',
                },
              ]}
              placeholder={`Enter rating (${MIN_RATING}-${MAX_RATING})`}
              placeholderTextColor={colors.icon}
              value={simulateRating}
              onChangeText={setSimulateRating}
              keyboardType="number-pad"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={closeModal}
                disabled={isSimulating}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.submitButton,
                  { backgroundColor: colors.tint },
                  isSimulating && styles.disabledButton,
                ]}
                onPress={handleSimulate}
                disabled={isSimulating}
              >
                {isSimulating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 10,
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  simulateButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  simulateButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  updateTime: {
    fontSize: 12,
    marginTop: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 12,
  },
  retryText: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
  },
  emptyList: {
    flexGrow: 1,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
    gap: 8,
  },
  paginationButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  paginationButtonDisabled: {
    opacity: 0.5,
  },
  paginationButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  pageNumbersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pageNumber: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageNumberText: {
    fontSize: 14,
    fontWeight: '600',
  },
  ellipsis: {
    fontSize: 14,
    marginHorizontal: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#e0e0e0',
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: '600',
    fontSize: 16,
  },
  submitButton: {
    minHeight: 48,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  disabledButton: {
    opacity: 0.7,
  },
});
