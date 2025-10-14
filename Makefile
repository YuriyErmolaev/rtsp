.PHONY: help install start stop restart mediamtx bridge webapp turn clean logs

# Default target
help:
	@echo "RTSP to WebRTC Bridge - Available commands:"
	@echo ""
	@echo "  make install    - Install all dependencies"
	@echo "  make start      - Start all services (MediaMTX, Bridge, WebApp)"
	@echo "  make stop       - Stop all services"
	@echo "  make restart    - Restart all services"
	@echo ""
	@echo "  make mediamtx   - Start MediaMTX server"
	@echo "  make bridge     - Start WebRTC bridge"
	@echo "  make webapp     - Start Angular webapp"
	@echo "  make turn       - Start TURN server (requires sudo)"
	@echo ""
	@echo "  make logs       - Show all service logs"
	@echo "  make clean      - Clean node_modules and build artifacts"

# Install all dependencies
install:
	@echo "Installing dependencies..."
	cd services/webrtc-bridge && npm install
	cd webapp && npm install
	@echo "Done!"

# Start all services
start:
	@echo "Starting all services..."
	@make -j3 mediamtx bridge webapp
	@echo "All services started!"
	@echo ""
	@echo "WebApp:    http://localhost:4200"
	@echo "Bridge:    http://localhost:8085"
	@echo "MediaMTX:  http://localhost:8889"

# Stop all services
stop:
	@echo "Stopping all services..."
	-@pkill mediamtx 2>/dev/null || true
	-@pkill -f "ng serve" 2>/dev/null || true
	-@pkill -f "ts-node.*server.ts" 2>/dev/null || true
	-@lsof -ti:4200 2>/dev/null | xargs kill -9 2>/dev/null || true
	-@lsof -ti:8085 2>/dev/null | xargs kill -9 2>/dev/null || true
	-@lsof -ti:8889 2>/dev/null | xargs kill -9 2>/dev/null || true
	@echo "All services stopped!"

# Restart all services
restart: stop
	@sleep 2
	@make start

# Start MediaMTX
mediamtx:
	@echo "Starting MediaMTX..."
	cd infra && ./mediamtx

# Start WebRTC bridge
bridge:
	@echo "Starting WebRTC bridge..."
	cd services/webrtc-bridge && npm run dev

# Start Angular webapp
webapp:
	@echo "Starting Angular webapp..."
	cd webapp && npm start

# Start TURN server (requires sudo)
turn:
	@echo "Starting TURN server..."
	sudo /usr/bin/turnserver -c $(PWD)/infra/turnserver.conf

# Show logs (run all services in foreground)
logs:
	@echo "Starting all services with logs..."
	@echo "Press Ctrl+C to stop all"
	@make start

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	rm -rf services/webrtc-bridge/node_modules
	rm -rf services/webrtc-bridge/dist
	rm -rf webapp/node_modules
	rm -rf webapp/dist
	@echo "Clean complete!"
