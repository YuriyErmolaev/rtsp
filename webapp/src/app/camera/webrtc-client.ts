import { environment } from '../../environments/environment';

export class WebRTCClient {
  private peerConnection: RTCPeerConnection | null = null;
  private rtspUrl: string;

  constructor(rtspUrl: string) {
    this.rtspUrl = rtspUrl;
  }

  async connect(): Promise<MediaStream> {
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    });

    // Setup track handler BEFORE creating offer
    const streamPromise = new Promise<MediaStream>((resolve, reject) => {
      const stream = new MediaStream();
      let trackCount = 0;
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 15000);

      this.peerConnection!.ontrack = (event) => {
        console.log('Received track:', event.track.kind);
        stream.addTrack(event.track);
        trackCount++;
        // Resolve after receiving first track (video)
        if (trackCount === 1) {
          clearTimeout(timeout);
          resolve(stream);
        }
      };

      this.peerConnection!.onconnectionstatechange = () => {
        console.log('Connection state:', this.peerConnection!.connectionState);
        if (this.peerConnection!.connectionState === 'failed') {
          clearTimeout(timeout);
          reject(new Error('Connection failed'));
        }
      };
    });

    // Add transceivers for receiving video/audio
    this.peerConnection.addTransceiver('video', { direction: 'recvonly' });
    this.peerConnection.addTransceiver('audio', { direction: 'recvonly' });

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    // Wait for ICE gathering
    await new Promise<void>((resolve) => {
      if (this.peerConnection!.iceGatheringState === 'complete') {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        console.log('ICE gathering timeout, proceeding anyway');
        resolve();
      }, 3000);

      this.peerConnection!.onicegatheringstatechange = () => {
        if (this.peerConnection!.iceGatheringState === 'complete') {
          clearTimeout(timeout);
          resolve();
        }
      };
    });

    // Send offer to bridge (JSON format like in examples)
    const response = await fetch(
      `${environment.BRIDGE_URL}/webrtc/offer?path=camera`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sdp: this.peerConnection.localDescription!.sdp,
          type: this.peerConnection.localDescription!.type
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Bridge request failed: ${response.statusText}`);
    }

    const answer = await response.json();
    await this.peerConnection.setRemoteDescription(
      new RTCSessionDescription({
        type: 'answer',
        sdp: answer.sdp
      })
    );

    // Wait for track
    return streamPromise;
  }

  disconnect(): void {
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
  }
}
