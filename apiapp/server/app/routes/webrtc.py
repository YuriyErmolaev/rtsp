import asyncio
import logging
from fastapi import APIRouter, Request
from aiortc import RTCPeerConnection, RTCSessionDescription
from aiortc.contrib.media import MediaPlayer
from pydantic import BaseModel
from typing import Optional, List

logging.basicConfig(level=logging.INFO)

router = APIRouter()

# Store peer connections and media players
pcs = set()
players = {}

# Store Offer/Answer for signaling
signaling_storage: dict = {
    "offer": None,
    "answer": None,
    "stream_path": None
}

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


# ========== TURN Configuration Endpoints ==========

@router.get("/ice-config")
async def get_ice_config():
    """Get TURN credentials for WebRTC"""
    return {"iceServers": turn_credentials["servers"]}


@router.put("/turn-config")
async def update_turn_config(credentials: TurnCredentials):
    """Update TURN credentials (admin only)"""
    global turn_credentials
    turn_credentials["servers"] = [server.model_dump() for server in credentials.servers]
    return {"status": "ok", "servers": turn_credentials["servers"]}


@router.get("/turn-config")
async def get_turn_config():
    """Get current TURN configuration"""
    return turn_credentials


# ========== WebRTC Publisher Endpoint ==========

@router.post("/offer")
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
            if pc in players:
                del players[pc]

    # Get RTSP path
    if not path or path == "camera":
        # Default RTSP camera
        rtsp_url = "rtsp://Vu5RqXpP:5K5mjQfVt4HUDsrK@192.168.0.138:554/live/ch0"
    else:
        rtsp_url = path

    try:
        # Create media player from RTSP stream or test source
        player = MediaPlayer(rtsp_url)

        # Store player to prevent garbage collection
        players[pc] = player

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
        if pc in players:
            del players[pc]
        raise


# ========== WebRTC Subscriber Endpoint ==========

@router.post("/subscriber/offer")
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


# ========== Signaling Storage Endpoints ==========

@router.post("/signaling/offer")
async def save_offer(request: Request):
    """Save offer from Subscriber"""
    global signaling_storage
    params = await request.json()
    signaling_storage["offer"] = {
        "type": params.get("type"),
        "sdp": params.get("sdp")
    }
    signaling_storage["stream_path"] = params.get("stream_path")
    return {"status": "ok", "message": "Offer saved"}


@router.get("/signaling/offer")
async def get_offer():
    """Get saved offer for Publisher"""
    if signaling_storage["offer"] is None:
        return {"status": "empty", "offer": None, "stream_path": None}
    return {
        "status": "ok",
        "offer": signaling_storage["offer"],
        "stream_path": signaling_storage["stream_path"]
    }


@router.post("/signaling/answer")
async def save_answer(request: Request):
    """Save answer from Publisher"""
    global signaling_storage
    params = await request.json()
    signaling_storage["answer"] = {
        "type": params.get("type"),
        "sdp": params.get("sdp")
    }
    return {"status": "ok", "message": "Answer saved"}


@router.get("/signaling/answer")
async def get_answer():
    """Get saved answer for Subscriber"""
    if signaling_storage["answer"] is None:
        return {"status": "empty", "answer": None}
    return {"status": "ok", "answer": signaling_storage["answer"]}


@router.delete("/signaling")
async def clear_signaling():
    """Clear all signaling data"""
    global signaling_storage
    signaling_storage = {
        "offer": None,
        "answer": None,
        "stream_path": None
    }
    return {"status": "ok", "message": "Signaling data cleared"}


@router.get("/webrtc/health")
async def webrtc_health():
    return {"status": "ok", "active_connections": len(pcs)}


# Cleanup on shutdown
async def cleanup_webrtc():
    """Close all peer connections on shutdown"""
    coros = [pc.close() for pc in pcs]
    await asyncio.gather(*coros)
    pcs.clear()
