const video = document.querySelector('video');
const button = document.querySelector("button");

const barcodeDetector = new BarcodeDetector({
  // (Optional) A series of barcode formats to search for.
  // Not all formats may be supported on all platforms
  formats: ["qr_code"]
});

const highlightBarcode = (bitmap, timestamp, detectedBarcodes) => {     
  console.log(detectedBarcodes.map(detectedBarcode => {
    return detectedBarcode.rawValue  
  }).join(', ') )
  const newFrame = new VideoFrame(bitmap, { timestamp });
  bitmap.close();
  return newFrame;
};

button.addEventListener("click", async () => {
  try {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  const videoTrack = stream.getVideoTracks()[0];
  video.srcObject = stream;
  video.addEventListener('loadedmetadata', () => {
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
      const newFrame = highlightBarcode(bitmap, timestamp, detectedBarcodes);      
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
