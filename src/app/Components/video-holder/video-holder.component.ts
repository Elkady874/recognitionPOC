import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ObjectRecognitionService } from '../../Services/object-recognition.service';
import * as tus from 'tus-js-client';
 import * as tf from '@tensorflow/tfjs';
import * as cocossd from '@tensorflow-models/coco-ssd';

interface TrackedPlayer {
  id: number;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  trajectory: Array<{x: number, y: number, timestamp: number}>;
  confidence: number;
}
@Component({
  selector: 'app-video-holder',
  standalone: true,
  imports: [],
  templateUrl: './video-holder.component.html',
  styleUrl: './video-holder.component.css'
})
export class VideoHolderComponent implements OnInit {
 
  
  @ViewChild('videoElement', { static: true }) 
  videoElement!: ElementRef<HTMLVideoElement>;

  @ViewChild('canvasElement', { static: true }) 
  canvasElement!: ElementRef<HTMLCanvasElement>;

  trackedPlayers: TrackedPlayer[] = [];
  selectedPlayerId: number | null = null;  // Store selected player ID
  selectedPlayers: { id: number, bbox: any }[] = [];

   private detectionModel: any;

  private frameCount = 0;
  private maxTrackingDistance = 50; // pixels
  private maxFramesWithoutDetection = 10;

  isModelReady = false;
 
  isModelLoaded = false;
   targetPlayerId: number | null = null;
  playerPoses: Map<number, any> = new Map();
 
  async ngAfterViewInit()  {
     const canvas = this.canvasElement.nativeElement;
    canvas.addEventListener('click', (event) => this.onCanvasClick(event));
  
   }


   private onCanvasClick(event: MouseEvent) {
    const canvas = this.canvasElement.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
  
    for (const player of this.trackedPlayers) {
      const { x, y, width, height } = player.bbox;
      
      if (clickX >= x && clickX <= x + width && clickY >= y && clickY <= y + height) {
        this.selectedPlayerId = player.id;  // Store selected player ID
        console.log(`Selected Player ID: ${this.selectedPlayerId}`);
        
        return;
      } 
    }
  
    // If no player was clicked, deselect
    this.selectedPlayerId = null;
  }



  // private onCanvasClick(event: MouseEvent) {
  //     const canvas = this.canvasElement.nativeElement;
  //   const rect = canvas.getBoundingClientRect();
  //   const clickX = event.clientX - rect.left;
  //   const clickY = event.clientY - rect.top;
  
  //   for (const player of this.trackedPlayers) {
  //     const { x, y, width, height } = player.bbox;
  
  //     if (clickX >= x && clickX <= x + width && clickY >= y && clickY <= y + height) {
  //       // If two players are already selected, reset the selection
  //       if (this.selectedPlayers.length === 2) {
  //         this.selectedPlayers = [];
  //       }
  
  //       this.selectedPlayers.push({ id: player.id, bbox: player.bbox });
  //       console.log(`Selected Player ID: ${player.id}`);
  
  //       return;
  //     }
  //   }
  // }




   private calculateDistance(bbox1: number[], bbox2: number[]): number {
    const [x1, y1, w1, h1] = bbox1;
    const [x2, y2, w2, h2] = bbox2;
    
    const centerX1 = x1 + w1 / 2;
    const centerY1 = y1 + h1 / 2;
    const centerX2 = x2 + w2 / 2;
    const centerY2 = y2 + h2 / 2;

    return Math.sqrt(
      Math.pow(centerX1 - centerX2, 2) + 
      Math.pow(centerY1 - centerY2, 2)
    );
  }





  async stopDetection() {
     await this.videoElement.nativeElement.pause(); 
    this.isModelLoaded = false;
  }
  async detectAndTrack() {
  this.isModelLoaded =true;
    this.setupVideoProcessing()
    this.videoElement.nativeElement.play();
  
  }



  constructor() {}
   async ngOnInit() {
    try {
await     this.initializeTFBackend();
this.detectionModel = await cocossd.load({
         base: 'mobilenet_v2'
       // base: 'resnet50' as any
        
      });

      this.isModelReady = true;
    } catch (error) {
      console.error('Initialization error:', error);
      alert('Failed to initialize TensorFlow.js. Please check console for details.');
    }
  }

 

  setupVideoProcessing() {
    const video = this.videoElement.nativeElement;
    const canvas = this.canvasElement.nativeElement;
    const ctx = canvas.getContext('2d');
   // const worker = new Worker(new URL('./player-tracking.worker', import.meta.url));

     canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    video.addEventListener('play', async () => {
      const processFrame = async () => {
        if (video.paused || video.ended) return;

        // Draw current frame
        ctx!.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx!.getImageData(0, 0, canvas.width, canvas.height);
      var det=  await this.detectionModel.detect(imageData);
        const playerDetections = await det.filter(
             (det:any) => det.class === 'person' && det.score > 0.6
              //(det:any) =>  det.score > 0.1
            );
         this.frameCount++;
        await  this.updatePlayerTracking(playerDetections, ctx!);

        await requestAnimationFrame(processFrame);
      };

    await  processFrame();
    });
 
  }
    clearBoundingBox(ctx: CanvasRenderingContext2D, bbox: any) {
    ctx.clearRect(bbox.x - 2, bbox.y - 2, bbox.width + 4, bbox.height + 4);
  }
  private async updatePlayerTracking(detections: any[], ctx: CanvasRenderingContext2D) {
  
     detections.forEach(async detection => {

      const [x, y, width, height] = detection.bbox;
      const centerX = x + width / 2;
      const centerY = y + height / 2;

      // Try to find an existing player near this detection
      let matchedPlayer = this.findMatchingPlayer(centerX, centerY);

      if (matchedPlayer) {
        // Update existing player
        matchedPlayer.bbox = { x, y, width, height };
        matchedPlayer.confidence = detection.score;
        matchedPlayer.trajectory.push({
          x: centerX,
          y: centerY,
          timestamp: Date.now()
        });
      } else {
        // Add new player
        const newPlayer: TrackedPlayer = {
          id: this.trackedPlayers.length + 1,
          bbox: { x, y, width, height },
          trajectory: [{
            x: centerX,
            y: centerY,
            timestamp: Date.now()
          }],
          confidence: detection.score
        };
        
           this.trackedPlayers.push(newPlayer);

       }

      // Visualize player detection
   await   this.drawPlayerDetection(ctx, detection);
    });

    // Remove players not seen recently (optional)
  await  this.cleanupOldPlayers();
  }

  private findMatchingPlayer(x: number, y: number, maxDistance = 10): TrackedPlayer | undefined {
    return this.trackedPlayers.find(player => {
      const lastPos = player.trajectory[player.trajectory.length - 1];
      const distance = Math.sqrt(
        Math.pow(x - lastPos.x, 2) + Math.pow(y - lastPos.y, 2)
      );
      return distance < maxDistance;
    });
  }

  private drawPlayerDetection(ctx: CanvasRenderingContext2D, detection: any) {
    //ctx.clearRect(0, 0, this.canvasElement.nativeElement.width, this.canvasElement.nativeElement.height)
    const [x, y, width, height] = detection.bbox;
    const playerId = this.trackedPlayers.find(p => 
      p.bbox.x === x && p.bbox.y === y
    )?.id;
    const isSelected = playerId == this.selectedPlayerId;
    // Draw bounding box
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.lineWidth = 2;
    ctx.strokeStyle = isSelected ? 'yellow' : 'red';  // Highlight selected player
    ctx.stroke();
   
    // Draw player ID and confidence
    ctx.font = '12px Arial';
    ctx.fillStyle = isSelected ? 'yellow' : 'red';
    ctx.fillText(
      `Player ${playerId || 'N/A'} (${(detection.score * 100).toFixed(1)}%)`, 
      x, 
      y - 5
    );
  }


//   private async drawPlayerDetection(ctx: CanvasRenderingContext2D, detection: any) {
//     const [x, y, width, height] = detection.bbox;
  
//     ctx.beginPath();
//     ctx.rect(x, y, width, height);
//     ctx.lineWidth = 2;
//     ctx.strokeStyle = 'red';
//     ctx.stroke();
  
//     ctx.font = '12px Arial';
//     ctx.fillStyle = 'red';
//  //  this.clearBoundingBox(ctx, detection.bbox);
//  //  ctx.clearRect(0, 0, this.canvasElement.nativeElement.width, this.canvasElement.nativeElement.height)
//     const player = this.trackedPlayers.find(p => p.bbox.x === x && p.bbox.y === y);
//     ctx.fillText(`Player ${player?.id || 'N/A'}`, x, y - 5);
  
//     // 🚀 Draw line if two players are selected
//     if (this.selectedPlayers.length === 2 &&(this.selectedPlayers[0].id==player?.id||this.selectedPlayers[1].id==player?.id)) {
//       this.drawConnectingLine(ctx, this.selectedPlayers[0].bbox, this.selectedPlayers[1].bbox);
//     }
//   }

  private drawConnectingLine(ctx: CanvasRenderingContext2D, bbox1: any, bbox2: any) {
    var x1 =( bbox1.x + bbox1.width )/ 2;
    var y1 =( bbox1.y + bbox1.height )/ 2;
    var x2 =( bbox2.x + bbox2.width) / 2;
    var y2 =( bbox2.y + bbox2.height) / 2;
  
    // Calculate the distance between players
    var distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    // Adjust line thickness based on distance
    var lineWidth = Math.max(2, Math.min(10, distance / 50));
  
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = distance > 150 ? 'green' : 'yellow'; // Color changes with distance
    ctx.stroke();
  
    // Display the distance
    ctx.font = '14px Arial';
    ctx.fillStyle = 'blue';
    ctx.fillText(`${Math.round(distance)} px`, (x1 + x2) / 2, (y1 + y2) / 2 - 10);
  }

  private cleanupOldPlayers(maxAge = 500) {
    const currentTime = Date.now();
    this.trackedPlayers = this.trackedPlayers.filter(player => {
      const lastPos = player.trajectory[player.trajectory.length - 1];
      return currentTime - lastPos.timestamp < maxAge;
    });
  }

  private async initializeTFBackend() {
    // Comprehensive backend initialization with detailed logging
    const availableBackends = [
     // 'webgpu',   // Newest, most performant for supported browsers
      'webgl',    // Widely supported GPU acceleration
      'cpu'       // Fallback backend
    ];

    for (const backend of availableBackends) {
      try {
         
        // Dynamically import backend if not already loaded
        if (backend === 'webgpu') {
          await import('@tensorflow/tfjs-backend-webgpu');
        } else if (backend === 'webgl') {
          await import('@tensorflow/tfjs-backend-webgl');
        }

        // Set and verify backend
        await tf.setBackend(backend);
        await tf.ready();

        console.log(`Successfully initialized TensorFlow.js backend: ${backend}`);
        return;
      } catch (error) {
        console.warn(`Failed to initialize ${backend} backend:`, error);
        continue;
      }
    }

    throw new Error('Could not initialize any TensorFlow.js backend');
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
