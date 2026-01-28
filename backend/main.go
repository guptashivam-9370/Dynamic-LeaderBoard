package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
)
func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	log.Println("Starting Leaderboard Service...")




	if err := InitDB(); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer CloseDB()






	seedCount := 10000
	if envSeed := os.Getenv("SEED_COUNT"); envSeed != "" {
	
		log.Printf("Seed count override not implemented, using default: %d", seedCount)
	}

	if err := SeedUsersWithTransaction(seedCount); err != nil {
		log.Printf("Warning: Seeding failed: %v", err)
	
	}






	if err := InitRankingEngine(); err != nil {
		log.Fatalf("Failed to initialize ranking engine: %v", err)
	}





	router := setupRouter()


	server := &http.Server{
		Addr:         getServerAddr(),
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}





	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)


	go func() {
		log.Printf("🚀 Server starting on %s", server.Addr)
		log.Println("Available endpoints:")
		log.Println("  GET  /health           - Health check")
		log.Println("  GET  /stats            - Ranking engine stats")
		log.Println("  GET  /leaderboard      - Top 100 users")
		log.Println("  GET  /search?username= - Search users")
		log.Println("  POST /simulate         - Simulate rating updates")

		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()


	<-quit
	log.Println("Shutting down server...")


	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited gracefully")
}

func setupRouter() *gin.Engine {

	if os.Getenv("GIN_MODE") == "" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()


	router.Use(gin.Recovery())
	router.Use(gin.Logger())  


	router.Use(corsMiddleware())






	router.GET("/health", HandleHealth)


	router.GET("/stats", HandleStats)


	router.GET("/leaderboard", HandleLeaderboard)
	router.GET("/search", HandleSearch)


	router.POST("/simulate", HandleSimulate)

	return router
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

func getServerAddr() string {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	return ":" + port
}
