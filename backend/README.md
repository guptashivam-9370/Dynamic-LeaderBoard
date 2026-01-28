# Leaderboard System Backend

A production-quality Golang backend for a high-performance leaderboard system, designed to handle 10,000+ users and scale to millions.

## 🏗️ Architecture Overview

### The Problem with Traditional Ranking

Traditional leaderboard systems compute ranks by sorting all users by their rating. This approach has **O(n log n)** complexity and doesn't scale well with:
- Frequent rating updates
- Millions of users
- High read throughput requirements

### Our Solution: Fixed-Size Rating Bucket Strategy

Since ratings are **bounded** (100-5000), we exploit this constraint for O(1) ranking:

```
┌─────────────────────────────────────────────────────────────────┐
│                     Rating Bucket Array                          │
├─────────────────────────────────────────────────────────────────┤
│ ratingCount[5001]int                                            │
│                                                                 │
│ Index:  [0] [1] ... [100] [101] ... [2500] ... [4999] [5000]   │
│ Value:   0   0  ...   5     3   ...   150  ...    8      2     │
│                                                                 │
│ Meaning: 5 users have rating 100, 3 have 101, etc.             │
└─────────────────────────────────────────────────────────────────┘
```

### Rank Calculation Formula

```
rank = 1 + sum(ratingCount[r] for all r > user.rating)
```

**Example:**
- User with rating 5000: `rank = 1 + 0 = 1` (no one is better)
- User with rating 4999: `rank = 1 + 2 = 3` (2 users have 5000)

### Key Benefits

| Operation | Traditional | Our Approach |
|-----------|-------------|--------------|
| Rank Calculation | O(n log n) | O(4900) ≈ O(1) |
| Rating Update | O(n log n) | O(1) |
| Same Rating = Same Rank | Complex | Automatic |
| Memory | O(n) | O(4901) = constant |

## 📁 Project Structure

```
backend/
├── main.go         # Application entry, server setup
├── db.go           # Database connection and queries
├── models.go       # Data structures and types
├── ranking.go      # In-memory ranking engine
├── handlers.go     # HTTP request handlers
├── seed.go         # Database seeding utilities
├── init.sql        # Database schema
├── Dockerfile      # Multi-stage Docker build
├── docker-compose.yml
└── README.md
```

## 🚀 Quick Start

### Option 1: Docker Compose (Recommended)

```bash
# Start PostgreSQL and Backend
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop services
docker-compose down
```

### Option 2: Local Development

```bash
# Start PostgreSQL (if not using Docker)
# Ensure the database and table exist

# Set environment variables
export DB_HOST=localhost
export DB_PORT=5432
export DB_USER=postgres
export DB_PASSWORD=postgres
export DB_NAME=leaderboard

# Run the application
go run .
```

## 📡 API Endpoints

### GET /leaderboard

Returns the top 100 users with their ranks.

**Response:**
```json
{
  "success": true,
  "data": [
    {"rank": 1, "username": "pro_champion", "rating": 4987},
    {"rank": 2, "username": "elite_player", "rating": 4952},
    {"rank": 2, "username": "master_gamer", "rating": 4952}
  ],
  "count": 100
}
```

Note: Users with the same rating have the same rank (tie-aware).

### GET /search?username=xyz

Case-insensitive search for users by username.

**Parameters:**
- `username` (required): Search term for partial matching

**Response:**
```json
{
  "success": true,
  "data": [
    {"rank": 156, "username": "xyz_player", "rating": 3200},
    {"rank": 2341, "username": "xyzmaster", "rating": 1850}
  ],
  "count": 2
}
```

### POST /simulate

Randomly updates ratings of ~50 users. Runs asynchronously.

**Response:**
```json
{
  "success": true,
  "message": "Rating simulation started asynchronously",
  "updated": 50
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "service": "leaderboard-api"
}
```

### GET /stats

Returns statistics about the ranking engine.

**Response:**
```json
{
  "success": true,
  "stats": {
    "total_users": 10000,
    "unique_ratings": 4532,
    "min_rating": 100,
    "max_rating": 5000,
    "rating_range": "100-5000"
  }
}
```

## 🔧 Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `DB_HOST` | localhost | PostgreSQL host |
| `DB_PORT` | 5432 | PostgreSQL port |
| `DB_USER` | postgres | Database user |
| `DB_PASSWORD` | postgres | Database password |
| `DB_NAME` | leaderboard | Database name |
| `DB_SSLMODE` | disable | SSL mode |
| `PORT` | 8080 | HTTP server port |
| `GIN_MODE` | release | Gin framework mode |
| `SEED_COUNT` | 10000 | Users to seed on startup |

## 🧪 Testing the API

```bash
# Get leaderboard
curl http://localhost:8080/leaderboard

# Search for users
curl "http://localhost:8080/search?username=player"

# Trigger rating simulation
curl -X POST http://localhost:8080/simulate

# Check health
curl http://localhost:8080/health

# View stats
curl http://localhost:8080/stats
```

## 🔒 Thread Safety

The ranking engine uses `sync.RWMutex` for thread-safe access:

```go
// Multiple readers can access simultaneously
re.mu.RLock()
rank := calculateRank(rating)
re.mu.RUnlock()

// Writers get exclusive access
re.mu.Lock()
ratingCount[oldRating]--
ratingCount[newRating]++
re.mu.Unlock()
```

This design maximizes throughput for read-heavy workloads:
- ✅ Multiple concurrent rank calculations
- ✅ Rating updates don't block each other
- ✅ Updates are atomic and consistent

## 📈 Scaling Considerations

### Current Scale (10,000+ users)
- Single instance handles easily
- In-memory bucket array uses ~40KB
- Database queries are indexed

### Future Scale (Millions of users)
- **Horizontal Scaling:** Run multiple API instances behind a load balancer
- **Bucket Synchronization:** Use Redis pub/sub to sync bucket updates across instances
- **Database Sharding:** Partition users by ID range if needed
- **Caching:** Add Redis caching for top N leaderboard queries

## 🏛️ Database Schema

```sql
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    rating INT NOT NULL CHECK (rating BETWEEN 100 AND 5000)
);

-- Indexes for performance
CREATE INDEX idx_users_rating ON users(rating DESC);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_username_lower ON users(LOWER(username));
```

## 📝 License

MIT License
