const barcodeDetector = new BarcodeDetector();

const button = document.querySelector('button');
button.addEventListener('click', () => {
  const stream = await getUserMedia({video:true});
  const videoTrack = stream.getVideoTracks()[0];
  const trackProcessor = new TrackProcessor(videoTrack);
  const trackGenerator = new TrackGenerator();
  const transformer = new TransformStream({
     async transform(videoFrame, controller) {
        const barcodePosition = detectBarcode(videoFrame);
        let newFrame = blurBackground(videoFrame.data, facePosition);
        videoFrame.close();
        controller.enqueue(newFrame);
    }
  });

  // After this, trackGenerator can be assigned to any sink such as a
  // peer connection, or media element.
  trackProcessor.readable
      .pipeThrough(transformer)
      .pipeTo(trackGenerator.writable);

  // Forward Web-exposed signals to the original videoTrack.
  trackGenerator.readableControl.pipeTo(trackProcessor.writableControl);