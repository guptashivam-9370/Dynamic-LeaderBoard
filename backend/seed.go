package main

import (
	"fmt"
	"log"
	"math/rand"
)


func SeedUsers(count int) error {

	existingCount, err := GetTotalUserCount()
	if err != nil {
		return fmt.Errorf("failed to check existing users: %w", err)
	}

	if existingCount > 0 {
		log.Printf("Database already has %d users, skipping seed", existingCount)
		return nil
	}

	log.Printf("Seeding database with %d users...", count)


	stmt, err := db.Prepare(`
		INSERT INTO users (username, rating) 
		VALUES ($1, $2) 
		ON CONFLICT (username) DO NOTHING
	`)
	if err != nil {
		return fmt.Errorf("failed to prepare insert statement: %w", err)
	}
	defer stmt.Close()


	batchSize := 1000
	inserted := 0

	for i := 0; i < count; i++ {
		username := generateUsername(i)
		rating := generateRandomRating()

		_, err := stmt.Exec(username, rating)
		if err != nil {
			log.Printf("Warning: failed to insert user %s: %v", username, err)
			continue
		}
		inserted++

	
		if inserted%batchSize == 0 {
			log.Printf("  Inserted %d/%d users...", inserted, count)
		}
	}

	log.Printf("✓ Seeded %d users successfully", inserted)
	return nil
}

func SeedUsersWithTransaction(count int) error {

	existingCount, err := GetTotalUserCount()
	if err != nil {
		return fmt.Errorf("failed to check existing users: %w", err)
	}

	if existingCount > 0 {
		log.Printf("Database already has %d users, skipping seed", existingCount)
		return nil
	}

	log.Printf("Seeding database with %d users (batch mode)...", count)


	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()


	stmt, err := tx.Prepare(`
		INSERT INTO users (username, rating) 
		VALUES ($1, $2) 
		ON CONFLICT (username) DO NOTHING
	`)
	if err != nil {
		return fmt.Errorf("failed to prepare statement: %w", err)
	}
	defer stmt.Close()


	for i := 0; i < count; i++ {
		username := generateUsername(i)
		rating := generateRandomRating()

		_, err := stmt.Exec(username, rating)
		if err != nil {
			log.Printf("Warning: failed to insert user %s: %v", username, err)
		}

	
		if (i+1)%5000 == 0 {
			log.Printf("  Prepared %d/%d users...", i+1, count)
		}
	}


	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	log.Printf("✓ Seeded %d users successfully", count)
	return nil
}

func generateUsername(index int) string {
	prefixes := []string{
		"player", "gamer", "user", "pro", "elite",
		"ninja", "master", "hero", "legend", "star",
		"ace", "king", "wolf", "dragon", "phoenix",
		"shadow", "cyber", "tech", "nova", "alpha",
	}

	prefix := prefixes[index%len(prefixes)]
	suffix := index / len(prefixes)

	if suffix == 0 {
		return fmt.Sprintf("%s_%d", prefix, index)
	}
	return fmt.Sprintf("%s_%d_%d", prefix, index%1000, suffix)
}

func generateRandomRating() int {


	


	
	if rand.Float32() < 0.7 {
	
	
		sum := 0
		for i := 0; i < 6; i++ {
			sum += rand.Intn(MaxRating-MinRating+1) + MinRating
		}
		rating := sum / 6
		
	
		if rating < MinRating {
			rating = MinRating
		}
		if rating > MaxRating {
			rating = MaxRating
		}
		return rating
	}
	

	return rand.Intn(MaxRating-MinRating+1) + MinRating
}

func ClearAllUsers() error {
	result, err := db.Exec("DELETE FROM users")
	if err != nil {
		return fmt.Errorf("failed to clear users: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	log.Printf("✓ Cleared %d users from database", rowsAffected)
	return nil
}
