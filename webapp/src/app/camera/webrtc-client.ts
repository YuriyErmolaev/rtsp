import { environment } from '../../environments/environment';

export class WebRTCClient {
  private peerConnection: RTCPeerConnection | null = null;
  private rtspUrl: string;

  constructor(rtspUrl: string) {
    this.rtspUrl = rtspUrl;
  }

  async connect(): Promise<MediaStream> {
    // Create peer connection
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    });

    // Create offer
    const offer = await this.peerConnection.createOffer({
      offerToReceiveVideo: true,
      offerToReceiveAudio: false
    });

    await this.peerConnection.setLocalDescription(offer);

    // Send offer to bridge server
    const response = await fetch(
      `${environment.BRIDGE_URL}/webrtc/offer?path=${encodeURIComponent(this.rtspUrl)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sdp: offer.sdp,
          type: offer.type
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get answer: ${response.statusText}`);
    }

    const answer = await response.json();

    // Set remote description
    await this.peerConnection.setRemoteDescription({
      type: 'answer',
      sdp: answer.sdp
    });

    // Wait for remote stream
    return new Promise<MediaStream>((resolve, reject) => {
      const stream = new MediaStream();

      this.peerConnection!.ontrack = (event) => {
        console.log('Received track:', event.track.kind);
        stream.addTrack(event.track);
        resolve(stream);
      };

      this.peerConnection!.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', this.peerConnection!.iceConnectionState);
        if (this.peerConnection!.iceConnectionState === 'failed') {
          reject(new Error('ICE connection failed'));
        }
      };

      this.peerConnection!.onconnectionstatechange = () => {
        console.log('Connection state:', this.peerConnection!.connectionState);
      };

      // Timeout after 10 seconds
      setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);
    });
  }

  disconnect(): void {
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
  }
}
