import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { VideoHolderComponent } from "./Components/video-holder/video-holder.component";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, VideoHolderComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'TrackingPOC';
}
