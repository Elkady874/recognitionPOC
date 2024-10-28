import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ObjectRecognitionService } from '../../Services/object-recognition.service';
import * as tus from 'tus-js-client';


@Component({
  selector: 'app-video-holder',
  standalone: true,
  imports: [],
  templateUrl: './video-holder.component.html',
  styleUrl: './video-holder.component.css'
})
export class VideoHolderComponent implements AfterViewInit {
  @ViewChild('videoElement', { static: false }) videoElement!: ElementRef;
  @ViewChild('canvasElement', { static: false }) canvasElement!: ElementRef;
  detector: any;
  // videoWidth = 560;
  // videoHeight = 315;
  isModelLoaded = false;
  safeURL: SafeResourceUrl
  targetPlayerId: number | null = null;
  playerPoses: Map<number, any> = new Map();
  constructor(private _sanitizer: DomSanitizer, private objectRecognitionService: ObjectRecognitionService) {

    this.safeURL = this._sanitizer.bypassSecurityTrustResourceUrl("https://www.youtube.com/embed/cuXw1YB-1hU?si=wkJ1EIvULnL5hvwi");
  }
  async ngAfterViewInit(): Promise<void> {
  
   }
  async stopDetection() {
    await this.objectRecognitionService.stop();
    await this.videoElement.nativeElement.pause(); 
    this.isModelLoaded = false;
  }
  async detectAndTrack() {
    await this.objectRecognitionService.loadModel();
    this.isModelLoaded = true;
    const video = this.videoElement.nativeElement;
    const canvas = this.canvasElement.nativeElement;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    this.videoElement.nativeElement.play();
  

    const detect = async () => {
      const poses = await this.objectRecognitionService.detectPose(video);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Iterate through detected poses
      poses.forEach((pose, index) => {
        // Assign an ID if the player is new
        if (!this.playerPoses.has(index)) {
          this.playerPoses.set(index, pose);
        }

        // Lock on specific player if not set
        if (this.targetPlayerId === null) {
          this.targetPlayerId = index;
        }
        let minx = pose.box?.xMin! * canvas.width;
        let miny = pose.box?.yMin! * canvas.height;

        ctx.strokeStyle = 'blue';
        ctx.lineWidth = 2;
        ctx.strokeRect(pose.box?.xMin! * canvas.width, pose.box?.yMin! * canvas.height, pose.box?.width! * canvas.width, pose.box?.height! * canvas.height);
        ctx.fill();

        // Track the locked player
        // if (index === this.targetPlayerId) {
        pose.keypoints.forEach((keypoint) => {
          if (keypoint.score! > 0.5) {
            ctx.strokeStyle = 'red';
            ctx.strokeRect(keypoint.x - 5, keypoint.y - 5, 10, 10);
            ctx.beginPath();
            ctx.arc(keypoint.x, keypoint.y, 5, 0, 2 * Math.PI);
            ctx.fillStyle = 'green';
            ctx.fill();
          }
        }

        );
        ctx.fillStyle = 'red';

        ctx.lineWidth = 55;
        ctx.fillText(`ID: ${pose.id}`, minx, miny - 10);
        // }
      });

      requestAnimationFrame(detect);
    };

    detect();
  }


  uploadFile(file: File) {
    const upload = new tus.Upload(file, {
      endpoint: 'https://localhost:7273/files/', // Replace with your TUS server endpoint
      metadata: {
        filename: file.name,
        filetype: file.type
      },
      chunkSize: 5242880, // Optional: 5MB chunks
      retryDelays: [0, 3000, 5000, 10000], // Retry delays in case of failed requests
      onError: (error) => {
        console.error('Failed because: ', error);
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2);
        console.log(`Progress: ${percentage}%`);
      },
      onSuccess: () => {
        console.log('Upload finished:', upload.url);
      }
    });
  
    // Start the upload
    upload.start();
  }
  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      this.uploadFile(file);
    }
  }

}
