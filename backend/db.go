package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"time"

	_ "github.com/lib/pq"
)


var db *sql.DB

func InitDB() error {
	var connStr string
	

	if databaseURL := os.Getenv("DATABASE_URL"); databaseURL != "" {
		connStr = databaseURL
		log.Println("Using DATABASE_URL for connection")
	} else {
	
		host := getEnv("DB_HOST", "localhost")
		port := getEnv("DB_PORT", "5432")
		user := getEnv("DB_USER", "postgres")
		password := getEnv("DB_PASSWORD", "postgres")
		dbname := getEnv("DB_NAME", "leaderboard")
		sslmode := getEnv("DB_SSLMODE", "disable")

		connStr = fmt.Sprintf(
			"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
			host, port, user, password, dbname, sslmode,
		)
		log.Println("Using individual DB env vars for connection")
	}

	var err error
	db, err = sql.Open("postgres", connStr)
	if err != nil {
		return fmt.Errorf("failed to open database connection: %w", err)
	}





	db.SetMaxOpenConns(50)
	db.SetMaxIdleConns(25)
	db.SetConnMaxLifetime(5 * time.Minute)


	if err = db.Ping(); err != nil {
		return fmt.Errorf("failed to ping database: %w", err)
	}

	log.Println("✓ Database connection established successfully")
	

	if err = ensureSchema(); err != nil {
		return fmt.Errorf("failed to ensure schema: %w", err)
	}
	
	return nil
}

func ensureSchema() error {
	schema := `
		-- Create the users table if it doesn't exist
		CREATE TABLE IF NOT EXISTS users (
			id BIGSERIAL PRIMARY KEY,
			username TEXT UNIQUE NOT NULL,
			rating INT NOT NULL CHECK (rating BETWEEN 100 AND 5000)
		);

		-- Create index on rating for fast ORDER BY queries
		CREATE INDEX IF NOT EXISTS idx_users_rating ON users(rating DESC);

		-- Create index on username for fast search queries
		CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

		-- Create index for case-insensitive search
		CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users(LOWER(username));
	`
	
	_, err := db.Exec(schema)
	if err != nil {
		return fmt.Errorf("failed to create schema: %w", err)
	}
	
	log.Println("✓ Database schema verified")
	return nil
}

func CloseDB() {
	if db != nil {
		db.Close()
		log.Println("✓ Database connection closed")
	}
}


func GetTopUsers(limit int, offset int) ([]User, error) {
	query := `
		SELECT id, username, rating 
		FROM users 
		ORDER BY rating DESC, username ASC 
		LIMIT $1 OFFSET $2
	`



	rows, err := db.Query(query, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to query top users: %w", err)
	}
	defer rows.Close()

	users := make([]User, 0, limit)
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Username, &u.Rating); err != nil {
			return nil, fmt.Errorf("failed to scan user row: %w", err)
		}
		users = append(users, u)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating user rows: %w", err)
	}

	return users, nil
}

func SearchUsersByUsername(searchTerm string, limit int, offset int) ([]User, error) {


	query := `
		SELECT id, username, rating 
		FROM users 
		WHERE username ILIKE $1 
		ORDER BY rating DESC, username ASC
		LIMIT $2 OFFSET $3
	`

	pattern := "%" + searchTerm + "%"
	rows, err := db.Query(query, pattern, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to search users: %w", err)
	}
	defer rows.Close()

	users := make([]User, 0)
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Username, &u.Rating); err != nil {
			return nil, fmt.Errorf("failed to scan user row: %w", err)
		}
		users = append(users, u)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating user rows: %w", err)
	}

	return users, nil
}

func GetRandomUsers(count int) ([]User, error) {
	query := `
		SELECT id, username, rating 
		FROM users 
		ORDER BY RANDOM() 
		LIMIT $1
	`

	rows, err := db.Query(query, count)
	if err != nil {
		return nil, fmt.Errorf("failed to get random users: %w", err)
	}
	defer rows.Close()

	users := make([]User, 0, count)
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Username, &u.Rating); err != nil {
			return nil, fmt.Errorf("failed to scan user row: %w", err)
		}
		users = append(users, u)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating user rows: %w", err)
	}

	return users, nil
}

func GetUserByUsername(username string) (*User, error) {
	query := `
		SELECT id, username, rating 
		FROM users 
		WHERE LOWER(username) = LOWER($1)
		LIMIT 1
	`

	var u User
	err := db.QueryRow(query, username).Scan(&u.ID, &u.Username, &u.Rating)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("user not found: %s", username)
		}
		return nil, fmt.Errorf("failed to get user by username: %w", err)
	}

	return &u, nil
}

func UpdateUserRating(userID int64, newRating int) error {
	query := `UPDATE users SET rating = $1 WHERE id = $2`
	_, err := db.Exec(query, newRating, userID)
	if err != nil {
		return fmt.Errorf("failed to update user rating: %w", err)
	}
	return nil
}

func GetRatingCounts() (map[int]int, error) {
	query := `
		SELECT rating, COUNT(*) as count 
		FROM users 
		GROUP BY rating
	`



	rows, err := db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to get rating counts: %w", err)
	}
	defer rows.Close()

	counts := make(map[int]int)
	for rows.Next() {
		var rating, count int
		if err := rows.Scan(&rating, &count); err != nil {
			return nil, fmt.Errorf("failed to scan rating count: %w", err)
		}
		counts[rating] = count
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating rating counts: %w", err)
	}

	return counts, nil
}

func GetTotalUserCount() (int, error) {
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count users: %w", err)
	}
	return count, nil
}


func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
