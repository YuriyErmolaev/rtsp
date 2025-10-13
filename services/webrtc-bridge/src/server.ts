import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fetch from 'node-fetch';

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

const MEDIAMTX_URL = process.env.MEDIAMTX_URL || 'http://localhost:8889';

console.log('MEDIAMTX_URL:', MEDIAMTX_URL);

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', mediamtx: MEDIAMTX_URL });
});

// WebRTC offer endpoint - proxy to MediaMTX
app.post('/webrtc/offer', async (req: Request, res: Response) => {
  try {
    const { sdp, type } = req.body;
    const streamPath = req.query.path || 'camera';

    console.log('Received offer for stream:', streamPath);

    if (!sdp || type !== 'offer') {
      return res.status(400).json({ error: 'Invalid offer' });
    }

    // Forward offer to MediaMTX WHEP endpoint
    const mediamtxUrl = `${MEDIAMTX_URL}/${streamPath}/whep`;
    console.log('Forwarding to MediaMTX:', mediamtxUrl);

    const response = await fetch(mediamtxUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sdp'
      },
      body: sdp
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('MediaMTX error:', response.status, errorText);
      return res.status(response.status).json({
        error: 'MediaMTX request failed',
        details: errorText
      });
    }

    const answerSdp = await response.text();
    console.log('Got answer from MediaMTX');

    // Return answer in JSON format (like original bridge)
    res.json({
      sdp: answerSdp,
      type: 'answer'
    });

  } catch (error) {
    console.error('Error handling offer:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

const PORT = process.env.PORT || 8085;
app.listen(PORT, () => {
  console.log(`WebRTC bridge server running on port ${PORT}`);
  console.log(`Endpoint: http://localhost:${PORT}/webrtc/offer`);
  console.log(`Proxying to MediaMTX: ${MEDIAMTX_URL}`);
});
