import { Component, ElementRef, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WebRTCClient } from './webrtc-client';

@Component({
  selector: 'app-camera',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './camera.component.html',
  styleUrls: ['./camera.component.css']
})
export class CameraComponent implements OnDestroy {
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;

  rtspUrl = 'rtsp://192.168.0.138:554/live/ch0';
  client: WebRTCClient | null = null;
  isConnecting = false;
  isConnected = false;
  error: string | null = null;

  async connect(): Promise<void> {
    this.isConnecting = true;
    this.error = null;

    try {
      this.client = new WebRTCClient(this.rtspUrl);
      const stream = await this.client.connect();

      this.videoElement.nativeElement.srcObject = stream;
      this.isConnected = true;
      console.log('Connected to camera');
    } catch (err: any) {
      this.error = err.message || 'Failed to connect';
      console.error('Connection error:', err);
    } finally {
      this.isConnecting = false;
    }
  }

  disconnect(): void {
    if (this.client) {
      this.client.disconnect();
      this.client = null;
    }

    if (this.videoElement) {
      this.videoElement.nativeElement.srcObject = null;
    }

    this.isConnected = false;
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
