import { Injectable } from '@angular/core';
import * as posedetection from '@tensorflow-models/pose-detection';
import * as tf from '@tensorflow/tfjs';

@Injectable({
  providedIn: 'root'
})
export class ObjectRecognitionService {

  constructor() { }
  private detector: posedetection.PoseDetector | null = null;

  async loadModel() {
    await tf.ready();
    await tf.setBackend('webgpu');
    this.detector = await posedetection.createDetector(
      posedetection.SupportedModels.MoveNet,
      {
        modelType: posedetection.movenet.modelType.MULTIPOSE_LIGHTNING,
      }
    );
  }


  async detectPose(video: HTMLVideoElement) {
    if (this.detector) {
      const poses = await this.detector.estimatePoses(video);
      return poses;
    }
    return [];
  }
  async stop(){
    await this.detector?.dispose();
  }
}
