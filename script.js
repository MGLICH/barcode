(() => {
  if (!isSecureContext) {
    return (location.protocol = "https:");
  }

  if (
    (!"MediaStreamTrackProcessor" in window) ||
    (!"MediaStreamTrackGenerator" in window)
  ) {
    return alert("This demo is not supported on your browser.");
  }

  const video = document.querySelector("video");
  const button = document.querySelector("button");
  const select = document.querySelector("select");
  const canvas = new OffscreenCanvas(1, 1);
  const ctx = canvas.getContext("2d");  

  let currentStream;
  let currentProcessedStream;

  const barcodeDetector = new BarcodeDetector({
    formats: ["qr_code"]
  });

  const highlightBarcode = async (bitmap, timestamp, detectedBarcodes) => {
    const floor = Math.floor;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    detectedBarcodes.map(detectedBarcode => {
      const { x, y, width, height } = detectedBarcode.boundingBox;
      ctx.strokeRect(floor(x), floor(y), floor(width), floor(height));
      const text = detectedBarcode.rawValue;
      const dimensions = ctx.measureText(text);
      ctx.fillText(
        text,
        floor(x + width / 2 - dimensions.width / 2),
        floor(y) + height + 20
      );
    });
    const newBitmap = await createImageBitmap(canvas);
    return new VideoFrame(newBitmap, { timestamp });
  };

  button.addEventListener("click", async () => {
    if (
      typeof currentStream !== "undefined" ||
      typeof currentProcessedStream !== "undefined"
    ) {
      stopMediaTracks(currentProcessedStream);
      stopMediaTracks(currentStream);      
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoConstraints = {};
      if (select.value === "") {
        videoConstraints.facingMode = "environment";
      } else {
        videoConstraints.deviceId = { exact: select.value };
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false
      });
      currentStream = stream;
      const videoTrack = stream.getVideoTracks()[0];
      video.addEventListener("loadedmetadata", () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.strokeStyle = "red";
        ctx.fillStyle = "red";
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
          videoFrame.close();
          const newFrame = await highlightBarcode(
            bitmap,
            timestamp,
            detectedBarcodes
          );
          controller.enqueue(newFrame);
        },

        flush(controller) {
          controller.terminate();
        }
      });

      const trackProcessor = new MediaStreamTrackProcessor(videoTrack);
      const trackGenerator = new MediaStreamTrackGenerator("video");

      trackProcessor.readable
        .pipeThrough(transformer)
        .pipeTo(trackGenerator.writable);

      trackGenerator.readableControl.pipeTo(trackProcessor.writableControl);

      const processedStream = new MediaStream();
      processedStream.addTrack(trackGenerator);
      currentProcessedStream = processedStream;
      video.srcObject = processedStream;
    } catch (err) {
      console.error(err.name, err.message);
    }
  });

  const stopMediaTracks = stream => {
    stream.getTracks().forEach(track => {
      track.stop();
    });
  };

  const listDevices = mediaDevices => {
    mediaDevices.forEach((mediaDevice, i) => {
      if (mediaDevice.kind === "videoinput") {
        const option = document.createElement("option");
        option.selected = i === 0 ? true : false;
        option.value = mediaDevice.deviceId;
        option.textContent = mediaDevice.label || `Camera ${i}`;
        select.append(option);
      }
    });
  };

  select.addEventListener("change", () => {
    button.click();
  });

  navigator.mediaDevices.enumerateDevices().then(listDevices);
})();
