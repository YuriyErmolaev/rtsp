import { environment } from '../../environments/environment';

export class WebRTCClient {
  private peerConnection: RTCPeerConnection | null = null;
  private streamPath: string;

  constructor(streamPath: string) {
    this.streamPath = streamPath;
  }

  async connect(): Promise<MediaStream> {
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
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

    // Send WHEP request to MediaMTX
    const response = await fetch(
      `${environment.MEDIAMTX_URL}/${this.streamPath}/whep`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/sdp'
        },
        body: this.peerConnection.localDescription!.sdp
      }
    );

    if (!response.ok) {
      throw new Error(`WHEP request failed: ${response.statusText}`);
    }

    const answerSdp = await response.text();
    await this.peerConnection.setRemoteDescription(
      new RTCSessionDescription({
        type: 'answer',
        sdp: answerSdp
      })
    );

    // Wait for connection and track
    return new Promise<MediaStream>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);

      this.peerConnection!.ontrack = (event) => {
        console.log('Received track:', event.track.kind);
        if (event.streams && event.streams[0]) {
          clearTimeout(timeout);
          resolve(event.streams[0]);
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
  }

  disconnect(): void {
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
  }
}
