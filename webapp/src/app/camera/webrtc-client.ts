import { environment } from '../../environments/environment';

export class WebRTCClient {
  private peerConnection: RTCPeerConnection | null = null;
  private rtspUrl: string;

  constructor(rtspUrl: string) {
    this.rtspUrl = rtspUrl;
  }

  async connect(): Promise<MediaStream> {
    // Get ICE configuration from API App (with TURN servers)
    const iceConfigResponse = await fetch(`${environment.WEBRTC_API_URL}/api/v1/webrtc/ice-config`);
    const { iceServers } = await iceConfigResponse.json();
    
    console.log('Using ICE servers:', iceServers);

    this.peerConnection = new RTCPeerConnection({ iceServers });

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

      this.peerConnection!.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('ICE candidate:', event.candidate.candidate);
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
        console.log('ICE gathering state:', this.peerConnection!.iceGatheringState);
        if (this.peerConnection!.iceGatheringState === 'complete') {
          clearTimeout(timeout);
          resolve();
        }
      };
    });

    console.log('Sending offer to bridge with ICE candidates');

    // Send offer to API App (JSON format like in examples)
    const response = await fetch(
      `${environment.WEBRTC_API_URL}/api/v1/webrtc/publisher/offer?path=camera`,
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
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const answer = await response.json();
    console.log('Got answer from API App');

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
