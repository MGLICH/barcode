if (!isSecureContext) {
  location.protocol = "https:";
}

const video = document.querySelector("video");
const button = document.querySelector("button");
const select = document.querySelector("select");
const canvas = new OffscreenCanvas(1, 1);
const ctx = canvas.getContext("2d");

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
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    listDevices(devices);
    const videoConstraints = {};
    if (select.value === '') {
      videoConstraints.facingMode = 'environment';
    } else {
      videoConstraints.deviceId = { exact: select.value };
    }
    const stream = await navigator.mediaDevices.getUserMedia({      
      video: videoConstraints,
      audio: false,
    });
    const videoTrack = stream.getVideoTracks()[0];
    await videoTrack.applyConstraints({ facingMode: { exact: "environment" } });

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
    video.srcObject = processedStream;
  } catch (err) {
    console.error(err.name, err.message);
  }
});

const listDevices = mediaDevices => {
  select.innerHTML = "";
  select.append(document.createElement("option"));
  let count = 1;
  mediaDevices.forEach(mediaDevice => {
    if (mediaDevice.kind === "videoinput") {
      const option = document.createElement("option");
      if (count === 1) {
        option.selected = true;
      }
      option.value = mediaDevice.deviceId;      
      option.textContent = mediaDevice.label || `Camera ${count++}`;
      select.append(option);
    }
  });
};
