import asyncio
import logging
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from aiortc import RTCPeerConnection, RTCSessionDescription
from aiortc.contrib.media import MediaPlayer
from pydantic import BaseModel
from typing import Optional, List

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="WebRTC API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store peer connections
pcs = set()

# TURN configuration storage
turn_credentials: dict = {
    "servers": [
        {
            "urls": ["turn:localhost:3478?transport=udp", "turn:localhost:3478?transport=tcp"],
            "username": "webrtc",
            "credential": "webrtc"
        },
        {
            "urls": ["turn:localhost:3479?transport=udp", "turn:localhost:3479?transport=tcp"],
            "username": "test",
            "credential": "test"
        }
    ]
}


class OfferRequest(BaseModel):
    type: str
    sdp: str


class IceServer(BaseModel):
    urls: List[str]
    username: Optional[str] = None
    credential: Optional[str] = None


class TurnCredentials(BaseModel):
    servers: List[IceServer]


@app.on_event("shutdown")
async def on_shutdown():
    # Close all peer connections
    coros = [pc.close() for pc in pcs]
    await asyncio.gather(*coros)
    pcs.clear()


# ========== TURN Configuration Endpoints ==========

@app.get("/ice-config")
async def get_ice_config():
    """Get TURN credentials for WebRTC"""
    return {"iceServers": turn_credentials["servers"]}


@app.put("/turn-config")
async def update_turn_config(credentials: TurnCredentials):
    """Update TURN credentials (admin only)"""
    global turn_credentials
    turn_credentials["servers"] = [server.model_dump() for server in credentials.servers]
    return {"status": "ok", "servers": turn_credentials["servers"]}


@app.get("/turn-config")
async def get_turn_config():
    """Get current TURN configuration"""
    return turn_credentials


# ========== WebRTC Publisher Endpoint ==========

@app.post("/publisher/offer")
async def publisher_offer(request: Request, path: Optional[str] = None):
    """
    Publisher: Handle WebRTC offer from browser and return answer.
    Browser sends offer → Server returns answer.
    """
    params = await request.json()
    offer = RTCSessionDescription(sdp=params["sdp"], type=params["type"])

    pc = RTCPeerConnection()
    pcs.add(pc)

    @pc.on("connectionstatechange")
    async def on_connectionstatechange():
        logging.info(f"Publisher connection state: {pc.connectionState}")
        if pc.connectionState == "failed" or pc.connectionState == "closed":
            await pc.close()
            pcs.discard(pc)

    # Get RTSP path
    rtsp_url = path or "rtsp://192.168.0.138:554/live/ch0"

    try:
        # Create media player from RTSP stream
        player = MediaPlayer(rtsp_url)

        if player.audio:
            pc.addTrack(player.audio)

        if player.video:
            pc.addTrack(player.video)

        # Set remote description
        await pc.setRemoteDescription(offer)

        # Create answer
        answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)

        return {
            "type": pc.localDescription.type,
            "sdp": pc.localDescription.sdp
        }
    except Exception as e:
        logging.error(f"Publisher error: {e}")
        await pc.close()
        pcs.discard(pc)
        raise


# ========== WebRTC Subscriber Endpoint ==========

@app.post("/subscriber/offer")
async def subscriber_offer(request: Request):
    """
    Subscriber: Handle WebRTC offer from browser and return answer.
    Browser sends offer → Server returns answer.
    """
    params = await request.json()
    offer = RTCSessionDescription(sdp=params["sdp"], type=params["type"])

    pc = RTCPeerConnection()
    pcs.add(pc)

    @pc.on("connectionstatechange")
    async def on_connectionstatechange():
        logging.info(f"Subscriber connection state: {pc.connectionState}")
        if pc.connectionState == "failed" or pc.connectionState == "closed":
            await pc.close()
            pcs.discard(pc)

    try:
        # Set remote description
        await pc.setRemoteDescription(offer)

        # Create answer
        answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)

        return {
            "type": pc.localDescription.type,
            "sdp": pc.localDescription.sdp
        }
    except Exception as e:
        logging.error(f"Subscriber error: {e}")
        await pc.close()
        pcs.discard(pc)
        raise


@app.get("/health")
async def health():
    return {"status": "ok", "active_connections": len(pcs)}
