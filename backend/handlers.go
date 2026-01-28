package main

import (
	"log"
	"math/rand"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)










const (
	DefaultPageSize = 50
	MaxPageSize     = 100
)















func HandleLeaderboard(c *gin.Context) {
	
	page := parseIntParam(c.Query("page"), 1)
	limit := parseIntParam(c.Query("limit"), DefaultPageSize)
	
	
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = DefaultPageSize
	}
	if limit > MaxPageSize {
		limit = MaxPageSize
	}
	
	
	offset := (page - 1) * limit

	
	
	users, err := GetTopUsers(limit+1, offset) 
	if err != nil {
		log.Printf("Error fetching leaderboard: %v", err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Success: false,
			Error:   "Failed to fetch leaderboard",
		})
		return
	}

	
	hasMore := len(users) > limit
	if hasMore {
		users = users[:limit] 
	}

	
	if len(users) == 0 {
		c.JSON(http.StatusOK, LeaderboardResponse{
			Success: true,
			Data:    []UserWithRank{},
			Count:   0,
			Page:    page,
			Limit:   limit,
			HasMore: false,
		})
		return
	}

	
	
	ratings := make([]int, len(users))
	for i, u := range users {
		ratings[i] = u.Rating
	}

	
	re := GetRankingEngine()
	ranks := re.GetRankBatch(ratings)

	
	result := make([]UserWithRank, len(users))
	for i, u := range users {
		result[i] = UserWithRank{
			Rank:     ranks[i],
			Username: u.Username,
			Rating:   u.Rating,
		}
	}

	c.JSON(http.StatusOK, LeaderboardResponse{
		Success: true,
		Data:    result,
		Count:   len(result),
		Page:    page,
		Limit:   limit,
		HasMore: hasMore,
	})
}
















func HandleSearch(c *gin.Context) {
	
	username := strings.TrimSpace(c.Query("username"))
	if username == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Success: false,
			Error:   "Username query parameter is required",
		})
		return
	}

	
	page := parseIntParam(c.Query("page"), 1)
	limit := parseIntParam(c.Query("limit"), DefaultPageSize)
	
	
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = DefaultPageSize
	}
	if limit > MaxPageSize {
		limit = MaxPageSize
	}
	
	
	offset := (page - 1) * limit

	
	
	users, err := SearchUsersByUsername(username, limit+1, offset) 
	if err != nil {
		log.Printf("Error searching users: %v", err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Success: false,
			Error:   "Failed to search users",
		})
		return
	}

	
	hasMore := len(users) > limit
	if hasMore {
		users = users[:limit] 
	}

	
	if len(users) == 0 {
		c.JSON(http.StatusOK, SearchResponse{
			Success: true,
			Data:    []UserWithRank{},
			Count:   0,
			Page:    page,
			Limit:   limit,
			HasMore: false,
		})
		return
	}

	
	ratings := make([]int, len(users))
	for i, u := range users {
		ratings[i] = u.Rating
	}

	
	re := GetRankingEngine()
	ranks := re.GetRankBatch(ratings)

	
	result := make([]UserWithRank, len(users))
	for i, u := range users {
		result[i] = UserWithRank{
			Rank:     ranks[i],
			Username: u.Username,
			Rating:   u.Rating,
		}
	}

	c.JSON(http.StatusOK, SearchResponse{
		Success: true,
		Data:    result,
		Count:   len(result),
		Page:    page,
		Limit:   limit,
		HasMore: hasMore,
	})
}


func parseIntParam(value string, defaultValue int) int {
	if value == "" {
		return defaultValue
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return defaultValue
	}
	return parsed
}


type SimulateUserRequest struct {
	Username  string `json:"username"`
	NewRating int    `json:"new_rating"`
}














func HandleSimulate(c *gin.Context) {
	
	var req SimulateUserRequest
	if err := c.ShouldBindJSON(&req); err == nil && req.Username != "" {
		
		handleSpecificUserSimulation(c, req)
		return
	}
	
	
	handleBulkSimulation(c)
}


func handleSpecificUserSimulation(c *gin.Context, req SimulateUserRequest) {
	
	if req.NewRating < MinRating || req.NewRating > MaxRating {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Success: false,
			Error:   "Rating must be between 100 and 5000",
		})
		return
	}
	
	
	user, err := GetUserByUsername(req.Username)
	if err != nil {
		log.Printf("Error finding user %s: %v", req.Username, err)
		c.JSON(http.StatusNotFound, ErrorResponse{
			Success: false,
			Error:   "User not found",
		})
		return
	}
	
	
	oldRating := user.Rating
	
	
	err = UpdateUserRating(user.ID, req.NewRating)
	if err != nil {
		log.Printf("Error updating user %s rating: %v", req.Username, err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Success: false,
			Error:   "Failed to update rating",
		})
		return
	}
	
	
	re := GetRankingEngine()
	re.UpdateRating(oldRating, req.NewRating)
	
	log.Printf("✓ Updated %s rating: %d -> %d", req.Username, oldRating, req.NewRating)
	
	c.JSON(http.StatusOK, SimulateResponse{
		Success: true,
		Message: "Rating updated successfully",
		Updated: 1,
	})
}


func handleBulkSimulation(c *gin.Context) {
	const usersToUpdate = 50

	
	users, err := GetRandomUsers(usersToUpdate)
	if err != nil {
		log.Printf("Error getting random users for simulation: %v", err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Success: false,
			Error:   "Failed to start simulation",
		})
		return
	}

	if len(users) == 0 {
		c.JSON(http.StatusOK, SimulateResponse{
			Success: true,
			Message: "No users available to simulate",
			Updated: 0,
		})
		return
	}

	
	updates := make([]RatingUpdate, len(users))
	for i, u := range users {
		newRating := generateNewRating(u.Rating)
		updates[i] = RatingUpdate{
			UserID:    u.ID,
			OldRating: u.Rating,
			NewRating: newRating,
		}
	}

	
	go processRatingUpdates(updates)

	c.JSON(http.StatusOK, SimulateResponse{
		Success: true,
		Message: "Rating simulation started asynchronously",
		Updated: len(updates),
	})
}



func processRatingUpdates(updates []RatingUpdate) {
	
	
	re := GetRankingEngine()
	re.BatchUpdateRatings(updates)

	
	
	successCount := 0
	for _, update := range updates {
		err := UpdateUserRating(update.UserID, update.NewRating)
		if err != nil {
			log.Printf("Failed to update user %d rating: %v", update.UserID, err)
			
			
			
			re.UpdateRating(update.NewRating, update.OldRating) 
		} else {
			successCount++
		}
	}

	log.Printf("✓ Simulation complete: %d/%d ratings updated successfully",
		successCount, len(updates))
}




func generateNewRating(currentRating int) int {
	
	delta := rand.Intn(1001) - 500

	newRating := currentRating + delta

	
	if newRating < MinRating {
		newRating = MinRating
	}
	if newRating > MaxRating {
		newRating = MaxRating
	}

	return newRating
}






func HandleHealth(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status": "healthy",
		"service": "leaderboard-api",
	})
}


func HandleStats(c *gin.Context) {
	re := GetRankingEngine()
	totalUsers, uniqueRatings, minRating, maxRating := re.GetStats()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"stats": gin.H{
			"total_users":    totalUsers,
			"unique_ratings": uniqueRatings,
			"min_rating":     minRating,
			"max_rating":     maxRating,
			"rating_range":   "100-5000",
		},
	})
}
