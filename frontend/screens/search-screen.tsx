/**
 * SearchScreen
 * 
 * Allows users to search for players by username with LeetCode-style pagination.
 * 
 * KEY PRINCIPLES:
 * - Search is performed via GET /search?username=query&page=X&limit=Y
 * - Ranks come DIRECTLY from the backend - NEVER computed locally
 * - Results are displayed EXACTLY as received - NEVER sorted locally
 * - API calls are debounced by 300ms to prevent excessive requests
 * - Page controls at the bottom (Prev | 1 2 3 4 5 | Next)
 * 
 * PAGINATION LOGIC:
 * - Pagination RESETS when search query changes
 * - Page changes REPLACE results (not append)
 * - hasMore flag indicates if more results are available
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { searchUsers, User, DEFAULT_PAGE_SIZE } from '@/api/api';
import { UserRow } from '@/components/user-row';

const DEBOUNCE_DELAY_MS = 300;

const VISIBLE_PAGES = 5;

export function SearchScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  

  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [isChangingPage, setIsChangingPage] = useState(false);
  

  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  

  const isMountedRef = useRef(true);
  

  const isFetchingRef = useRef(false);
  

  const currentQueryRef = useRef('');
  

  const flatListRef = useRef<FlatList>(null);

  const performSearch = useCallback(async (
    searchQuery: string, 
    pageNum: number = 1, 
    isNewSearch: boolean = true
  ) => {

    if (!searchQuery.trim()) {
      setUsers([]);
      setHasSearched(false);
      setError(null);
      setPage(1);
      setHasMore(true);
      setTotalPages(1);
      currentQueryRef.current = '';
      return;
    }
    

    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    

    if (isNewSearch) {
      setIsSearching(true);
    } else {
      setIsChangingPage(true);
    }
    setError(null);
    
    try {
    
    
      const { users: results, hasMore: moreAvailable } = await searchUsers(
        searchQuery, 
        pageNum, 
        DEFAULT_PAGE_SIZE
      );
      
      if (isMountedRef.current) {
    
        if (searchQuery === currentQueryRef.current || isNewSearch) {
        
          setUsers(results);
          currentQueryRef.current = searchQuery;
          setHasMore(moreAvailable);
          setPage(pageNum);
          setHasSearched(true);
          
        
          if (!moreAvailable && results.length > 0) {
            setTotalPages(pageNum);
          } else if (moreAvailable) {
            setTotalPages(prev => Math.max(prev, pageNum + 1));
          }
          
        
          if (!isNewSearch && flatListRef.current) {
            flatListRef.current.scrollToOffset({ offset: 0, animated: true });
          }
        }
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Search failed');
        if (isNewSearch) {
          setUsers([]);
        }
        setHasSearched(true);
      }
    } finally {
      if (isMountedRef.current) {
        setIsSearching(false);
        setIsChangingPage(false);
      }
      isFetchingRef.current = false;
    }
  }, []);
  
  /**
   * Handle text input changes with debouncing
   * 
   * Debouncing prevents excessive API calls while the user is typing.
   * We wait 300ms after the last keystroke before making the API call.
   * Query change RESETS pagination to page 1.
   */
  const handleQueryChange = useCallback((text: string) => {
    setQuery(text);
    

    setPage(1);
    setHasMore(true);
    setTotalPages(1);
    

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    

    debounceTimeoutRef.current = setTimeout(() => {
      performSearch(text, 1, true);
    }, DEBOUNCE_DELAY_MS);
  }, [performSearch]);
  
  /**
   * Navigate to a specific page
   */
  const goToPage = useCallback((pageNum: number) => {
    if (pageNum < 1 || isFetchingRef.current || !query.trim()) return;
    performSearch(query, pageNum, false);
  }, [query, performSearch]);
  
  /**
   * Navigate to previous page
   */
  const goToPreviousPage = useCallback(() => {
    if (page > 1 && !isFetchingRef.current) {
      performSearch(query, page - 1, false);
    }
  }, [page, query, performSearch]);
  
  /**
   * Navigate to next page
   */
  const goToNextPage = useCallback(() => {
    if (hasMore && !isFetchingRef.current) {
      performSearch(query, page + 1, false);
    }
  }, [page, hasMore, query, performSearch]);
  
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
   * Cleanup on unmount
   */
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
    
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);
  
  /**
   * Render a single user row
   */
  const renderItem = useCallback(({ item }: { item: User }) => (
    <UserRow
      rank={item.rank}
      username={item.username}
      rating={item.rating}
      isHighlighted={true}
    />
  ), []);
  
  /**
   * Key extractor for FlatList
   */
  const keyExtractor = useCallback((item: User, index: number) => `${item.username}-${index}`, []);
  
  /**
   * Render pagination controls (LeetCode style)
   */
  const renderPaginationControls = () => {
    const visiblePages = getVisiblePageNumbers();
    const isLoading = isSearching || isChangingPage;
    
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
   * Render empty state based on context
   */
  const renderEmpty = () => {

    if (isSearching) return null;
    

    if (!hasSearched) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>👆</Text>
          <Text style={[styles.emptyText, { color: colors.icon }]}>
            Start typing to search
          </Text>
        </View>
      );
    }
    

    if (error) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>⚠️</Text>
          <Text style={[styles.emptyText, { color: colors.text }]}>{error}</Text>
        </View>
      );
    }
    

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyEmoji}>🔍</Text>
        <Text style={[styles.emptyText, { color: colors.icon }]}>
          No players found for "{query}"
        </Text>
        <Text style={[styles.emptyHint, { color: colors.icon }]}>
          Try a different username
        </Text>
      </View>
    );
  };
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search Header - Outside FlatList to prevent re-render issues */}
      <View style={styles.headerContainer}>
        {/* Title */}
        <Text style={[styles.title, { color: colors.text }]}>🔍 Search Players</Text>
        <Text style={[styles.subtitle, { color: colors.icon }]}>
          Find any player by username
        </Text>
        
        {/* Search Input */}
        <View
          style={[
            styles.searchInputContainer,
            {
              backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5',
              borderColor: isDark ? '#444' : '#ddd',
            },
          ]}
        >
          <Text style={styles.searchIcon}>🔎</Text>
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Enter username..."
            placeholderTextColor={colors.icon}
            value={query}
            onChangeText={handleQueryChange}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {isSearching && (
            <ActivityIndicator size="small" color={colors.tint} style={styles.searchSpinner} />
          )}
        </View>
        
        {/* Search hint or results count */}
        {!hasSearched && !query && (
          <Text style={[styles.hint, { color: colors.icon }]}>
            Results will appear as you type
          </Text>
        )}
        {hasSearched && !isSearching && (
          <Text style={[styles.resultsCount, { color: colors.icon }]}>
            {users.length} {users.length === 1 ? 'player' : 'players'} found
            {users.length > 0 ? ` • Page ${page}` : ''}
          </Text>
        )}
      </View>

      {/* Results List */}
      <FlatList
        ref={flatListRef}
        data={users}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListEmptyComponent={renderEmpty}
    
        removeClippedSubviews={true}
        maxToRenderPerBatch={15}
        windowSize={10}
        initialNumToRender={10}
        contentContainerStyle={users.length === 0 ? styles.emptyList : undefined}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />
      
      {/* Pagination Controls */}
      {users.length > 0 && hasSearched && renderPaginationControls()}
      
      {/* Loading overlay for page transitions */}
      {isChangingPage && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    padding: 20,
    paddingTop: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 50,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
  searchSpinner: {
    marginLeft: 8,
  },
  hint: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
  resultsCount: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  emptyHint: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  emptyList: {
    flexGrow: 1,
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
});
