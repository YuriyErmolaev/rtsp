.PHONY: help install start stop apiapp-up apiapp-down webapp coturn-up coturn-down clean logs

# Default target
help:
	@echo "RTSP to WebRTC - Available commands:"
	@echo ""
	@echo "  make install      - Install webapp dependencies"
	@echo "  make start        - Start webapp + TURN servers + API App"
	@echo "  make stop         - Stop all services"
	@echo ""
	@echo "  make apiapp-up    - Start API App (Docker - WebRTC API on port 7100)"
	@echo "  make apiapp-down  - Stop API App (Docker)"
	@echo "  make webapp       - Start Angular webapp (port 4200)"
	@echo "  make coturn-up    - Start TURN servers (Docker - TURN1 & TURN2)"
	@echo "  make coturn-down  - Stop TURN servers (Docker)"
	@echo ""
	@echo "  make logs        - Show all service logs"
	@echo "  make clean       - Clean build artifacts"

# Install all dependencies
install:
	@echo "Installing webapp dependencies..."
	cd webapp && npm install
	@echo "Done!"

# Start all services (WebApp + TURN)
start: stop
	@echo "Starting webapp and TURN servers..."
	@make coturn-up
	@sleep 2
	@make webapp &
	@echo ""
	@echo "All services started!"
	@echo ""
	@echo "WebApp:      http://localhost:4200"
	@echo "TURN1:       turn:localhost:3478"
	@echo "TURN2:       turn:localhost:3479"
	@echo ""
	@echo "Note: API App should be running separately (make apiapp-up)"

# Stop all services
stop:
	@echo "Stopping webapp and TURN servers..."
	-@pkill -9 -f "ng serve" 2>/dev/null || true
	-@pkill -9 -f "npm start" 2>/dev/null || true
	@sleep 1
	-@lsof -ti:4200 2>/dev/null | xargs kill -9 2>/dev/null || true
	@make coturn-down 2>/dev/null || true
	@echo "Webapp and TURN stopped!"

# Start API App (Docker)
apiapp-up:
	@echo "Starting API App (Docker)..."
	docker compose --env-file .env.local.example -f docker-compose.local.yaml up -d
	@echo "API App: http://localhost:7100"

# Stop API App (Docker)
apiapp-down:
	@echo "Stopping API App (Docker)..."
	docker compose --env-file .env.local.example -f docker-compose.local.yaml down

# Start Angular webapp
webapp:
	@echo "Starting Angular webapp..."
	cd webapp && CI=true npm start

# Start TURN servers (Docker)
coturn-up:
	@echo "Starting TURN servers (Docker)..."
	docker compose -f docker-compose.yml up -d coturn1 coturn2
	@echo "TURN1: turn:localhost:3478 (user: webrtc, pass: webrtc)"
	@echo "TURN2: turn:localhost:3479 (user: test, pass: test)"

# Stop TURN servers (Docker)
coturn-down:
	@echo "Stopping TURN servers..."
	docker compose -f docker-compose.yml down

# Show logs (run all services in foreground)
logs:
	@echo "Starting all services with logs..."
	@echo "Press Ctrl+C to stop all"
	@make start

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	rm -rf webapp/node_modules
	rm -rf webapp/dist
	@echo "Clean complete!"
