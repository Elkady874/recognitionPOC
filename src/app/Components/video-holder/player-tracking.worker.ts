/// <reference lib="webworker" />

import * as tf from '@tensorflow/tfjs';
import * as cocossd from '@tensorflow-models/coco-ssd';

// Import only the backend you need
import '@tensorflow/tfjs-backend-webgl'; 
 var detectionModel:any
 initializeTFBackend();
addEventListener('message', async ({ data }) => {



  const { imageData } = data;

  await loadModel();

 

  const input = tf.tidy(() => {
    const imgTensor = tf.browser.fromPixels(imageData);  // [h, w, 3]
    return imgTensor.expandDims(0);                  // [1, h, w, 3]
  });
  
  // Then run inference outside tidy
  const detections = await detectionModel.detect(input);
  
  // Clean up manually
  input.dispose()

   
  // Run detection
  //const detections = await tf.tidy(() => detectionModel.detect(img));

 // const detections = await detectionModel.detect(img);
  
   postMessage(detections); 
  console.log("detec")
});
const loadModel = async () => {
  if (!detectionModel) {
    detectionModel = await cocossd.load({
      base: 'mobilenet_v2'
    });  }
}
// async function initializeTF() {
//   await tf.setBackend('webgl');
//   await tf.ready();
//   postMessage({ type: 'backendReady', message: 'TensorFlow.js is ready!' });
// }

  async function initializeTFBackend() {
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