package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

type Location struct {
	Lat float64 `json:"lat"`
	Lng float64 `json:"lng"`
}

var (
	clients   = make(map[string]*websocket.Conn) // userID -> websocket connection
	locations = make(map[string]Location)        // userID -> latest location
	mu        sync.Mutex
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

func handleWS(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("userID")
	if userID == "" {
		http.Error(w, "Missing userID", http.StatusBadRequest)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Upgrade error:", err)
		return
	}
	defer conn.Close()

	mu.Lock()
	clients[userID] = conn
	mu.Unlock()

	log.Println("User connected:", userID)

	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			log.Println("Disconnecting:", userID)
			break
		}

		var loc Location
		if err := json.Unmarshal(msg, &loc); err != nil {
			log.Println("Invalid JSON from", userID)
			continue
		}

		mu.Lock()
		locations[userID] = loc
		broadcastLocations()
		mu.Unlock()
	}

	mu.Lock()
	delete(clients, userID)
	delete(locations, userID)
	broadcastLocations()
	mu.Unlock()
}

func broadcastLocations() {
	data, _ := json.Marshal(locations)
	for uid, conn := range clients {
		err := conn.WriteMessage(websocket.TextMessage, data)
		if err != nil {
			log.Println("Write error to", uid, ":", err)
			conn.Close()
			delete(clients, uid)
		}
	}
}

func main() {
	http.HandleFunc("/ws", handleWS)

	// Serve static files from the correct path for Railway (project root)
	fs := http.FileServer(http.Dir("frontend/dist"))
	http.Handle("/", fs)

	fmt.Println("Server running on :8080")
	http.ListenAndServe(":8080", nil)
}
