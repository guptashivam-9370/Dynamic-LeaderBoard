# Leaderboard Backend

## Deployment on Railway

### Environment Variables Required

Set these in Railway's environment variables section:

```
DATABASE_URL=postgresql://postgres:rmXqBvaqjfWBRqiOsmDIXOdpTYYSEHbE@postgres.railway.internal:5432/railway
PORT=8080  # Railway sets this automatically
GIN_MODE=release
SEED_COUNT=10000  # Optional: number of users to seed
```

### Deploy Steps

1. Connect your GitHub repo to Railway
2. Set the root directory to `backend`
3. Add the DATABASE_URL environment variable
4. Railway will auto-detect Go and build the project

### Local Development

```bash
# With individual env vars
DB_HOST=localhost DB_PORT=5432 DB_USER=postgres DB_PASSWORD=postgres DB_NAME=leaderboard go run .

# Or with DATABASE_URL
DATABASE_URL="postgresql://postgres:password@localhost:5432/leaderboard?sslmode=disable" go run .
```

### API Endpoints

- `GET /health` - Health check
- `GET /stats` - Ranking engine statistics
- `GET /leaderboard?page=1&limit=100` - Paginated leaderboard
- `GET /search?username=query&page=1&limit=100` - Search users
- `POST /simulate` - Update user rating (body: `{"username": "...", "new_rating": 1500}`)
