package main


type User struct {
	ID       int64  `json:"id"`
	Username string `json:"username"`
	Rating   int    `json:"rating"`
}

type UserWithRank struct {
	Rank     int    `json:"rank"`
	Username string `json:"username"`
	Rating   int    `json:"rating"`
}

type LeaderboardResponse struct {
	Success bool           `json:"success"`
	Data    []UserWithRank `json:"data"`
	Count   int            `json:"count"`
	Page    int            `json:"page"`
	Limit   int            `json:"limit"`
	HasMore bool           `json:"hasMore"`
}

type SearchResponse struct {
	Success bool           `json:"success"`
	Data    []UserWithRank `json:"data"`
	Count   int            `json:"count"`
	Page    int            `json:"page"`
	Limit   int            `json:"limit"`
	HasMore bool           `json:"hasMore"`
}

type SimulateResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Updated int    `json:"updated"`
}

type ErrorResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error"`
}

type RatingUpdate struct {
	UserID    int64
	OldRating int
	NewRating int
}
