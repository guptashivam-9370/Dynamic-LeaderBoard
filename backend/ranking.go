package main

import (
	"log"
	"sync"
)


const (

	MinRating = 100

	MaxRating = 5000


	RatingBucketSize = MaxRating + 1
)

type RankingEngine struct {


	ratingCount [RatingBucketSize]int



	mu sync.RWMutex


	totalUsers int
}

var rankingEngine *RankingEngine

func InitRankingEngine() error {
	rankingEngine = &RankingEngine{}



	counts, err := GetRatingCounts()
	if err != nil {
		return err
	}


	totalUsers := 0
	for rating, count := range counts {
		if rating >= MinRating && rating <= MaxRating {
			rankingEngine.ratingCount[rating] = count
			totalUsers += count
		}
	}
	rankingEngine.totalUsers = totalUsers

	log.Printf("✓ Ranking engine initialized with %d users across %d unique ratings",
		totalUsers, len(counts))

	return nil
}

func (re *RankingEngine) GetRank(rating int) int {
	re.mu.RLock()
	defer re.mu.RUnlock()


	rank := 1
	for r := rating + 1; r <= MaxRating; r++ {
		rank += re.ratingCount[r]
	}
	return rank
}

func (re *RankingEngine) GetRankBatch(ratings []int) []int {
	re.mu.RLock()
	defer re.mu.RUnlock()



	cumulativeAbove := make([]int, RatingBucketSize)


	sum := 0
	for r := MaxRating; r >= MinRating; r-- {
		cumulativeAbove[r] = sum
		sum += re.ratingCount[r]
	}


	ranks := make([]int, len(ratings))
	for i, rating := range ratings {
		if rating >= MinRating && rating <= MaxRating {
			ranks[i] = 1 + cumulativeAbove[rating]
		} else {
		
			ranks[i] = -1
		}
	}

	return ranks
}

func (re *RankingEngine) UpdateRating(oldRating, newRating int) {

	if oldRating == newRating {
		return
	}

	re.mu.Lock()
	defer re.mu.Unlock()


	if oldRating >= MinRating && oldRating <= MaxRating {
		if re.ratingCount[oldRating] > 0 {
			re.ratingCount[oldRating]--
		}
	}


	if newRating >= MinRating && newRating <= MaxRating {
		re.ratingCount[newRating]++
	}
}

func (re *RankingEngine) BatchUpdateRatings(updates []RatingUpdate) {
	re.mu.Lock()
	defer re.mu.Unlock()

	for _, update := range updates {
	
		if update.OldRating == update.NewRating {
			continue
		}

	
		if update.OldRating >= MinRating && update.OldRating <= MaxRating {
			if re.ratingCount[update.OldRating] > 0 {
				re.ratingCount[update.OldRating]--
			}
		}

	
		if update.NewRating >= MinRating && update.NewRating <= MaxRating {
			re.ratingCount[update.NewRating]++
		}
	}
}

func (re *RankingEngine) GetStats() (totalUsers int, uniqueRatings int, minRatingWithUsers int, maxRatingWithUsers int) {
	re.mu.RLock()
	defer re.mu.RUnlock()

	minRatingWithUsers = -1
	maxRatingWithUsers = -1

	for r := MinRating; r <= MaxRating; r++ {
		if re.ratingCount[r] > 0 {
			totalUsers += re.ratingCount[r]
			uniqueRatings++
			if minRatingWithUsers == -1 {
				minRatingWithUsers = r
			}
			maxRatingWithUsers = r
		}
	}

	return
}

func GetRankingEngine() *RankingEngine {
	return rankingEngine
}
