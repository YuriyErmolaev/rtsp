import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../environments/environment';

interface IceServer {
  urls: string[];
  username?: string;
  credential?: string;
}

interface TurnServer {
  name: string;
  urls: string[];
  username: string;
  credential: string;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css'
})
export class AdminComponent {


  availableServers: TurnServer[] = [
    {
      name: 'TURN1 (coturn1)',
      urls: ['turn:localhost:3478?transport=udp', 'turn:localhost:3478?transport=tcp'],
      username: 'webrtc',
      credential: 'webrtc'
    },
    {
      name: 'TURN2 (coturn2)',
      urls: ['turn:localhost:3479?transport=udp', 'turn:localhost:3479?transport=tcp'],
      username: 'test',
      credential: 'test'
    }
  ];

  selectedPreset: string = '0';

  urls: string = 'turn:localhost:3478?transport=udp, turn:localhost:3478?transport=tcp';
  username: string = 'webrtc';
  credential: string = 'webrtc';

  status: string = '';
  error: string | null = null;

  onPresetChange() {
    console.log('onPresetChange called, selectedPreset:', this.selectedPreset);
    const index = parseInt(this.selectedPreset);
    console.log('Parsed index:', index);
    if (index >= 0 && index < this.availableServers.length) {
      const server = this.availableServers[index];
      console.log('Selected server:', server);
      this.urls = server.urls.join(', ');
      this.username = server.username;
      this.credential = server.credential;
      console.log('Updated urls:', this.urls);
      console.log('Updated username:', this.username);
      console.log('Updated credential:', this.credential);
    }
  }

  async saveConfig() {
    try {
      this.error = null;
      this.status = 'Saving...';

      if (!this.urls.trim()) {
        this.error = 'URLs cannot be empty';
        return;
      }

      const urlsArray = this.urls.split(',').map(s => s.trim()).filter(Boolean);
      const serverConfig = {
        urls: urlsArray,
        username: this.username || undefined,
        credential: this.credential || undefined
      };

      const response = await fetch(`${environment.apiUrl}/webrtc/turn-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          servers: [serverConfig]
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to save: ${response.statusText}`);
      }

      const result = await response.json();
      this.status = 'Configuration saved successfully!';
      console.log('Saved:', result);
    } catch (err: any) {
      this.error = `Failed to save: ${err.message}`;
      this.status = '';
      console.error('Save error:', err);
    }
  }

  async loadConfig() {
    try {
      this.error = null;
      this.status = 'Loading...';

      const response = await fetch(`${environment.apiUrl}/webrtc/turn-config`);

      if (!response.ok) {
        throw new Error(`Failed to load: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.servers && result.servers.length > 0) {
        const currentServer = result.servers[0];
        this.urls = currentServer.urls.join(', ');
        this.username = currentServer.username || '';
        this.credential = currentServer.credential || '';

        const foundIndex = this.availableServers.findIndex(s =>
          s.urls[0] === currentServer.urls[0]
        );
        if (foundIndex !== -1) {
          this.selectedPreset = foundIndex.toString();
        }
        this.status = 'Configuration loaded successfully!';
      }
    } catch (err: any) {
      this.error = `Failed to load: ${err.message}`;
      this.status = '';
      console.error('Load error:', err);
    }
  }
}
