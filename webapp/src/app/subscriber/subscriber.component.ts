import { Component, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-subscriber',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './subscriber.component.html',
  styleUrls: ['./subscriber.component.css']
})
export class SubscriberComponent {
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;

  peerConnection: RTCPeerConnection | null = null;
  streamPath: string = 'camera';

  offer: string = '';
  answer: string = '';

  isConnected = false;
  error: string | null = null;

  async createOffer() {
    try {
      this.error = null;

      // Get TURN credentials from WebRTC API
      const iceConfigResponse = await fetch(`${environment.WEBRTC_API_URL}/api/v1/webrtc/ice-config`);
      const { iceServers } = await iceConfigResponse.json();

      this.peerConnection = new RTCPeerConnection({ iceServers });

      this.peerConnection.addTransceiver('video', { direction: 'recvonly' });
      this.peerConnection.addTransceiver('audio', { direction: 'recvonly' });
      this.peerConnection.createDataChannel('ping');

      this.peerConnection.ontrack = (event) => {
        console.log('Received track:', event.track.kind);
        const [stream] = event.streams;
        if (stream && this.videoElement) {
          this.videoElement.nativeElement.srcObject = stream;
        }
      };

      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      await this.waitForICE();

      this.offer = JSON.stringify({
        type: this.peerConnection.localDescription!.type,
        sdp: this.peerConnection.localDescription!.sdp
      }, null, 2);

      console.log('Offer created');
    } catch (err: any) {
      this.error = `Failed to create offer: ${err.message}`;
      console.error('Create offer error:', err);
    }
  }

  async setAnswer() {
    try {
      this.error = null;

      if (!this.peerConnection) {
        throw new Error('No peer connection');
      }

      const answerData = JSON.parse(this.answer);

      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription({
          type: 'answer',
          sdp: answerData.sdp
        })
      );

      this.isConnected = true;
      console.log('Answer set');
    } catch (err: any) {
      this.error = `Failed to set answer: ${err.message}`;
      console.error('Set answer error:', err);
    }
  }

  private async waitForICE() {
    return new Promise<void>((resolve) => {
      if (this.peerConnection!.iceGatheringState === 'complete') {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        resolve();
      }, 3000);

      this.peerConnection!.onicegatheringstatechange = () => {
        if (this.peerConnection!.iceGatheringState === 'complete') {
          clearTimeout(timeout);
          resolve();
        }
      };
    });
  }

  disconnect() {
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    if (this.videoElement) {
      this.videoElement.nativeElement.srcObject = null;
    }
    this.isConnected = false;
    this.offer = '';
    this.answer = '';
  }
}
