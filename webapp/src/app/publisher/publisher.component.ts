import { Component, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../environments/environment';

interface CameraPreset {
  name: string;
  path: string;
}

@Component({
  selector: 'app-publisher',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './publisher.component.html',
  styleUrls: ['./publisher.component.css']
})
export class PublisherComponent {
  availableCameras: CameraPreset[] = [
    {
      name: 'Camera 1 (Default)',
      path: 'rtsp://Vu5RqXpP:5K5mjQfVt4HUDsrK@192.168.0.138:554/live/ch0'
    },
    {
      name: 'Test Pattern',
      path: 'testsrc'
    }
  ];

  selectedPreset: string = '0';
  streamPath: string = 'rtsp://Vu5RqXpP:5K5mjQfVt4HUDsrK@192.168.0.138:554/live/ch0';
  offerEndpoint: string = '/webrtc/offer';
  offer: string = '';
  answer: string = '';
  error: string | null = null;

  onPresetChange() {
    const index = parseInt(this.selectedPreset);
    if (index >= 0 && index < this.availableCameras.length) {
      this.streamPath = this.availableCameras[index].path;
    }
  }

  async fetchOffer() {
    try {
      this.error = null;

      const response = await fetch(`${environment.apiUrl}/webrtc/signaling/offer`);
      const result = await response.json();

      if (result.status === 'empty' || !result.offer) {
        this.error = 'No offer available yet. Subscriber needs to create an offer first.';
        return;
      }

      this.offer = JSON.stringify(result.offer, null, 2);

      // Update stream path if provided
      if (result.stream_path) {
        this.streamPath = result.stream_path;
      }

      console.log('Offer fetched from server');
    } catch (err: any) {
      this.error = `Failed to fetch offer: ${err.message}`;
      console.error('Fetch offer error:', err);
    }
  }

  async postOffer() {
    try {
      this.error = null;
      this.answer = '';

      if (!this.offer.trim()) {
        this.error = 'Offer is empty';
        return;
      }

      const offerData = JSON.parse(this.offer);
      if (!offerData || offerData.type !== 'offer' || !offerData.sdp) {
        this.error = 'Invalid offer format';
        return;
      }

      const response = await fetch(`${environment.apiUrl}${this.offerEndpoint}?path=${this.streamPath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(offerData)
      });

      const answerData = await response.json();

      if (answerData && answerData.type === 'answer' && answerData.sdp) {
        this.answer = JSON.stringify(answerData, null, 2);

        // Automatically save answer to server
        await fetch(`${environment.apiUrl}/webrtc/signaling/answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(answerData)
        });

        console.log('Answer received and saved to server');
      } else {
        this.error = 'Invalid answer from server';
      }
    } catch (err: any) {
      this.error = `Failed to post offer: ${err.message}`;
      console.error('Post offer error:', err);
    }
  }

}
