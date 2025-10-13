import express, { Request, Response } from 'express';
import { RTSPPublisher } from './rtsp_publisher';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
const turnPath = path.join(__dirname, '../../../infra/secrets/.env.turn');
const rtspPath = path.join(__dirname, '../../../infra/secrets/.env.rtsp');
console.log('Loading TURN config from:', turnPath);
console.log('Loading RTSP config from:', rtspPath);
dotenv.config({ path: turnPath });
dotenv.config({ path: rtspPath });

const app = express();
app.use(express.json());

// Enable CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

const iceServers: any[] = [];
if (process.env.TURN_URLS) {
  const urls = process.env.TURN_URLS.split(',').map(url => url.trim());
  iceServers.push({
    urls: urls,
    username: process.env.TURN_USER,
    credential: process.env.TURN_PASS
  });
}

// Store active publishers
const publishers = new Map<string, RTSPPublisher>();

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// WebRTC offer endpoint
app.post('/webrtc/offer', async (req: Request, res: Response) => {
  try {
    const { sdp, type } = req.body;
    const rtspPath = req.query.path as string;

    if (!rtspPath) {
      return res.status(400).json({ error: 'Missing RTSP path parameter' });
    }

    if (!sdp || type !== 'offer') {
      return res.status(400).json({ error: 'Invalid offer' });
    }

    // Build RTSP URL with credentials
    let rtspUrl = rtspPath;
    if (process.env.CAMERA_USER && process.env.CAMERA_PASS) {
      const url = new URL(rtspPath);
      url.username = process.env.CAMERA_USER;
      url.password = process.env.CAMERA_PASS;
      rtspUrl = url.toString();
    }

    console.log(`Creating publisher for: ${rtspPath}`);

    const publisher = new RTSPPublisher(rtspUrl, iceServers);
    const pc = publisher.getPeerConnection();

    // Set remote description (client's offer)
    await pc.setRemoteDescription({ type: 'offer', sdp });

    // Create answer
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    // Store publisher
    const sessionId = Date.now().toString();
    publishers.set(sessionId, publisher);

    // Handle ICE candidates
    pc.onicecandidate = (event: any) => {
      if (event.candidate) {
        console.log('New ICE candidate:', event.candidate);
      }
    };

    // Cleanup on connection close
    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      if (pc.connectionState === 'closed' || pc.connectionState === 'failed') {
        publisher.close();
        publishers.delete(sessionId);
      }
    };

    res.json({
      sdp: answer.sdp,
      type: answer.type,
      sessionId
    });

  } catch (error) {
    console.error('Error handling offer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 8085;
app.listen(PORT, () => {
  console.log(`WebRTC bridge server running on port ${PORT}`);
  console.log(`TURN servers configured: ${iceServers.length > 0 ? 'Yes' : 'No'}`);
});
