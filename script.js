const barcodeDetector = new BarcodeDetector();

const highlightBarcode = (frame, barcode) => {
  return frame;
};

const button = document.querySelector("button");
button.addEventListener("click", async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  const videoTrack = stream.getVideoTracks()[0];  
  const transformer = new TransformStream({
    async transform(videoFrame, controller) {      
      const barcode = barcodeDetector.detect();
      const newFrame = highlightBarcode(await videoFrame.createImageBitmap(), barcode);
      videoFrame.close();
      controller.enqueue(newFrame);
    }
  });
  const trackProcessor = new MediaStreamTrackProcessor(videoTrack);
  const trackGenerator = new MediaStreamTrackGenerator('video');
  // After this, trackGenerator can be assigned to any sink such as a
  // peer connection, or media element.
  trackProcessor.readable
    .pipeThrough(transformer)
    .pipeTo(trackGenerator.writable);

  // Forward Web-exposed signals to the original videoTrack.
  trackGenerator.readableControl.pipeTo(trackProcessor.writableControl);
});
