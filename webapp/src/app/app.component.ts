import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CameraComponent } from './camera/camera.component';
import { PublisherComponent } from './publisher/publisher.component';
import { SubscriberComponent } from './subscriber/subscriber.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, CameraComponent, PublisherComponent, SubscriberComponent],
  template: `
    <div class="app-container">
      <nav class="tabs">
        <button (click)="activeTab = 'camera'" [class.active]="activeTab === 'camera'">Camera</button>
        <button (click)="activeTab = 'publisher'" [class.active]="activeTab === 'publisher'">Publisher</button>
        <button (click)="activeTab = 'subscriber'" [class.active]="activeTab === 'subscriber'">Subscriber</button>
      </nav>

      <div class="tab-content">
        <app-camera *ngIf="activeTab === 'camera'"></app-camera>
        <app-publisher *ngIf="activeTab === 'publisher'"></app-publisher>
        <app-subscriber *ngIf="activeTab === 'subscriber'"></app-subscriber>
      </div>
    </div>
  `,
  styles: [`
    .app-container {
      min-height: 100vh;
    }

    .tabs {
      display: flex;
      background: #f5f5f5;
      border-bottom: 2px solid #ddd;
      padding: 0;
      margin: 0;
    }

    .tabs button {
      padding: 15px 30px;
      background: none;
      border: none;
      cursor: pointer;
      font-size: 16px;
      font-weight: 500;
      color: #666;
      transition: all 0.3s;
    }

    .tabs button:hover {
      background: #e0e0e0;
    }

    .tabs button.active {
      background: white;
      color: #007bff;
      border-bottom: 3px solid #007bff;
    }

    .tab-content {
      padding: 20px;
    }
  `]
})
export class AppComponent {
  activeTab: 'camera' | 'publisher' | 'subscriber' = 'camera';
}
