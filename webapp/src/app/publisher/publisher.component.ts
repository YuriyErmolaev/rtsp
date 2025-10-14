import { Component, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-publisher',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './publisher.component.html',
  styleUrls: ['./publisher.component.css']
})
export class PublisherComponent {
  streamPath: string = 'camera';
  offer: string = '';
  answer: string = '';
  error: string | null = null;

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

      const response = await fetch(`${environment.WEBRTC_API_URL}/api/v1/webrtc/publisher/offer?path=${this.streamPath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(offerData)
      });

      const answerData = await response.json();

      if (answerData && answerData.type === 'answer' && answerData.sdp) {
        this.answer = JSON.stringify(answerData, null, 2);
        console.log('Answer received');
      } else {
        this.error = 'Invalid answer from server';
      }
    } catch (err: any) {
      this.error = `Failed to post offer: ${err.message}`;
      console.error('Post offer error:', err);
    }
  }

}
