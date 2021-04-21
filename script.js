const video = document.querySelector('video');
const button = document.querySelector("button");
const canvas = new OffscreenCanvas(300, 300);
const ctx = canvas.getContext('2d');

const barcodeDetector = new BarcodeDetector({
  // (Optional) A series of barcode formats to search for.
  // Not all formats may be supported on all platforms
  formats: ["qr_code"]
});

const highlightBarcode = async (bitmap, timestamp, detectedBarcodes) => {
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();  
  detectedBarcodes.map(detectedBarcode => {
    const {x, y, width, height} = detectedBarcode.boundingBox;
    ctx.rect(Math.floor(x), Math.floor(y), Math.floor(width), Math.floor(height);        
    
  })  
  
  const newFrame = new VideoFrame(await createImageBitmap(canvas), {timestamp}); 
  return newFrame;
};

button.addEventListener("click", async () => {
  try {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  const videoTrack = stream.getVideoTracks()[0];
  video.srcObject = stream;
  video.addEventListener('loadedmetadata', () => {  
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    video.play();
  });
  
  const transformer = new TransformStream({
    async transform(videoFrame, controller) {
      const bitmap = await createImageBitmap(videoFrame);
      const detectedBarcodes = await barcodeDetector.detect(bitmap);
      if (!detectedBarcodes.length) {
        bitmap.close();
        controller.enqueue(videoFrame);
        return;
      }
      const timestamp = videoFrame.timestamp;
      const newFrame = await highlightBarcode(bitmap, timestamp, detectedBarcodes);      
      videoFrame.close();
      controller.enqueue(newFrame);     
    }
  });
  
  const trackProcessor = new MediaStreamTrackProcessor(videoTrack);
  const trackGenerator = new MediaStreamTrackGenerator("video");
  // After this, trackGenerator can be assigned to any sink such as a
  // peer connection, or media element.
  trackProcessor.readable
    .pipeThrough(transformer)
    .pipeTo(trackGenerator.writable);

  // Forward Web-exposed signals to the original videoTrack.
  trackGenerator.readableControl.pipeTo(trackProcessor.writableControl);
  } catch (err) {
    console.error(err.name, err.message)
  }
});
