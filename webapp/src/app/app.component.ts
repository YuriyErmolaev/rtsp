import { Component } from '@angular/core';
import { CameraComponent } from './camera/camera.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CameraComponent],
  template: '<app-camera></app-camera>',
  styles: []
})
export class AppComponent {
}
