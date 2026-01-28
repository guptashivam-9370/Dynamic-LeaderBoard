const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080';

export const DEFAULT_PAGE_SIZE = 100;

export interface User {
  rank: number;
  username: string;
  rating: number;
}
export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse {
  success: boolean;
  data: User[];
  count: number;
  page?: number;
  limit?: number;
  hasMore?: boolean;
}

export interface ApiError {
  error: string;
}

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
    
    
    
    const users = data.data || [];
    const hasMore = data.hasMore ?? users.length === limit;
    
    return { users, hasMore };
  } catch (error) {
    
    if (error instanceof TypeError) {
      throw new Error('Network error: Unable to connect to server');
    }
    throw error;
  }
}

export async function searchUsers(
  username: string,
  page: number = 1,
  limit: number = DEFAULT_PAGE_SIZE
): Promise<{ users: User[]; hasMore: boolean }> {
  
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
    
    
    const users = data.data || [];
    const hasMore = data.hasMore ?? users.length === limit;
    
    return { users, hasMore };
  } catch (error) {
    
    if (error instanceof TypeError) {
      throw new Error('Network error: Unable to connect to server');
    }
    throw error;
  }
}
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


export async function simulateUserRating(
  username: string,
  newRating: number
): Promise<{ success: boolean; message: string }> {
  
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
