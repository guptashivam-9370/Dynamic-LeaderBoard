/**
 * API Client for Leaderboard Backend
 * 
 * This module handles all HTTP communication with the backend.
 * The frontend NEVER computes ranks - all rank data comes from the backend.
 * The frontend NEVER sorts data - we display exactly what the backend returns.
 * 
 * PAGINATION:
 * - All list endpoints support page & limit query params
 * - Frontend passes pagination params, backend handles the rest
 * - Frontend NEVER computes pagination offsets or ranks
 */

// Base URL for the backend API
// Change this when deploying to production
const API_BASE_URL = 'http://localhost:8080';

// Default pagination settings
export const DEFAULT_PAGE_SIZE = 100;

/**
 * User type representing a user in the leaderboard
 * Rank is ALWAYS provided by the backend, never computed locally
 */
export interface User {
  rank: number;
  username: string;
  rating: number;
}

/**
 * Pagination parameters for API requests
 */
export interface PaginationParams {
  page: number;
  limit: number;
}

/**
 * Response type for paginated endpoints
 * Backend returns: { success: boolean, data: User[], count: number, page: number, limit: number, hasMore: boolean }
 */
export interface PaginatedResponse {
  success: boolean;
  data: User[];
  count: number;
  page?: number;
  limit?: number;
  hasMore?: boolean;
}

/**
 * Generic API error type
 */
export interface ApiError {
  error: string;
}

/**
 * Fetches users from the leaderboard with pagination support
 * 
 * The backend returns users sorted by rating DESC with their computed ranks.
 * We display this data exactly as received - no client-side sorting or ranking.
 * 
 * @param page - Page number (1-indexed)
 * @param limit - Number of users per page
 * @returns Promise with users array and hasMore flag
 */
export async function fetchLeaderboard(
  page: number = 1,
  limit: number = DEFAULT_PAGE_SIZE
): Promise<{ users: User[]; hasMore: boolean }> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/leaderboard?page=${page}&limit=${limit}`
    );
    
    if (!response.ok) {
      const errorData: ApiError = await response.json();
      throw new Error(errorData.error || 'Failed to fetch leaderboard');
    }
    
    const data: PaginatedResponse = await response.json();
    
    // Return exactly what the backend provides - no modifications
    // hasMore is determined by whether we received a full page of results
    const users = data.data || [];
    const hasMore = data.hasMore ?? users.length === limit;
    
    return { users, hasMore };
  } catch (error) {
    // Re-throw network errors with a user-friendly message
    if (error instanceof TypeError) {
      throw new Error('Network error: Unable to connect to server');
    }
    throw error;
  }
}

/**
 * Searches for users by username with pagination support (case-insensitive)
 * 
 * The backend performs the search and computes ranks for matching users.
 * We display results exactly as received from the backend.
 * 
 * @param username - The username query string to search for
 * @param page - Page number (1-indexed)
 * @param limit - Number of users per page
 * @returns Promise with users array and hasMore flag
 */
export async function searchUsers(
  username: string,
  page: number = 1,
  limit: number = DEFAULT_PAGE_SIZE
): Promise<{ users: User[]; hasMore: boolean }> {
  // Don't make API call for empty or whitespace-only queries
  if (!username.trim()) {
    return { users: [], hasMore: false };
  }
  
  try {
    const encodedUsername = encodeURIComponent(username.trim());
    const response = await fetch(
      `${API_BASE_URL}/search?username=${encodedUsername}&page=${page}&limit=${limit}`
    );
    
    if (!response.ok) {
      const errorData: ApiError = await response.json();
      throw new Error(errorData.error || 'Failed to search users');
    }
    
    const data: PaginatedResponse = await response.json();
    
    // Return exactly what the backend provides - no modifications
    const users = data.data || [];
    const hasMore = data.hasMore ?? users.length === limit;
    
    return { users, hasMore };
  } catch (error) {
    // Re-throw network errors with a user-friendly message
    if (error instanceof TypeError) {
      throw new Error('Network error: Unable to connect to server');
    }
    throw error;
  }
}

/**
 * Triggers the simulate endpoint to randomly update user ratings
 * 
 * This is typically called for testing/demo purposes.
 * The frontend does NOT call this automatically.
 * 
 * @returns Promise<{ message: string, updated: number }> - Simulation result
 */
export async function triggerSimulation(): Promise<{ message: string; updated: number }> {
  try {
    const response = await fetch(`${API_BASE_URL}/simulate`, {
      method: 'POST',
    });
    
    if (!response.ok) {
      const errorData: ApiError = await response.json();
      throw new Error(errorData.error || 'Failed to trigger simulation');
    }
    
    return await response.json();
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Network error: Unable to connect to server');
    }
    throw error;
  }
}

/**
 * Simulate request body type
 */
export interface SimulateUserRequest {
  username: string;
  new_rating: number;
}

/**
 * Simulate a specific user's rating update
 * 
 * This calls POST /simulate with a specific username and new rating.
 * The backend updates the user's rating and recalculates ranks.
 * Frontend does NOT compute ranks - we re-fetch data after this call.
 * 
 * @param username - The username to update
 * @param newRating - The new rating value (100-5000)
 * @returns Promise with success message
 */
export async function simulateUserRating(
  username: string,
  newRating: number
): Promise<{ success: boolean; message: string }> {
  // Validate inputs
  if (!username.trim()) {
    throw new Error('Username is required');
  }
  if (newRating < 100 || newRating > 5000) {
    throw new Error('Rating must be between 100 and 5000');
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/simulate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: username.trim(),
        new_rating: newRating,
      }),
    });
    
    if (!response.ok) {
      const errorData: ApiError = await response.json();
      throw new Error(errorData.error || 'Failed to simulate rating update');
    }
    
    const data = await response.json();
    return {
      success: true,
      message: data.message || 'Rating updated successfully',
    };
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Network error: Unable to connect to server');
    }
    throw error;
  }
}
