# WebRTC Bridge Service

RTSP to WebRTC bridge service that converts RTSP camera streams to WebRTC for browser playback.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables in `../../infra/secrets/`:
   - `.env.turn` - TURN server credentials
   - `.env.rtsp` - Camera credentials

3. Run in development mode:
```bash
npm run dev
```

4. Build and run in production:
```bash
npm run build
npm start
```

## API Endpoints

### GET /health
Health check endpoint.

**Response:** `200 OK`

### POST /webrtc/offer?path=<RTSP_URL>
Accepts WebRTC offer and returns answer with RTSP stream.

**Query Parameters:**
- `path` - RTSP URL (e.g., `rtsp://192.168.0.138:554`)

**Request Body:**
```json
{
  "sdp": "...",
  "type": "offer"
}
```

**Response:**
```json
{
  "sdp": "...",
  "type": "answer",
  "sessionId": "..."
}
```

## Docker

Build and run with Docker:
```bash
docker build -t webrtc-bridge .
docker run -p 8085:8085 --env-file ../../infra/secrets/.env.turn --env-file ../../infra/secrets/.env.rtsp webrtc-bridge
```

## Requirements

- Node.js 20+
- FFmpeg (for RTSP stream processing)
