// ==================================================
// CREATE VIDEO
// ==================================================

async function createVideo(body) {

  const images =
    body.images || [];

  const audio =
    body.audio;


  // ==================================================
  // VALIDATION
  // ==================================================

  if (
    !Array.isArray(images) ||
    images.length !== 4
  ) {

    throw new Error(
      "Exactly 4 images are required."
    );

  }


  if (!audio) {

    throw new Error(
      "Audio is required."
    );

  }


  console.log(
    "========================================"
  );

  console.log(
    "🎬 UNKNOWN FILES VIDEO RENDER"
  );

  console.log(
    "========================================"
  );


  // ==================================================
  // SAVE AUDIO
  // ==================================================

  await saveInput(
    audio,
    "/tmp/audio.mp3"
  );


  console.log(
    "✅ Audio saved"
  );


  // ==================================================
  // SAVE 4 IMAGES
  // ==================================================

  for (
    let i = 0;
    i < 4;
    i++
  ) {

    await saveInput(
      images[i],
      `/tmp/image${i + 1}.jpg`
    );


    console.log(
      `✅ Image ${i + 1} saved`
    );

  }


  // ==================================================
  // CREATE EACH SCENE AS A SEPARATE MP4
  // ==================================================

  console.log(
    "🎥 Creating 4 independent scene videos..."
  );


  for (
    let i = 1;
    i <= 4;
    i++
  ) {

    const input =
      `/tmp/image${i}.jpg`;

    const output =
      `/tmp/scene${i}.mp4`;


    console.log(
      `🎬 Rendering SCENE ${i}...`
    );


    await runFFmpeg([

      "-y",

      // ==================================================
      // INPUT IMAGE
      // ==================================================

      "-loop",
      "1",

      "-framerate",
      "30",

      "-i",
      input,


      // ==================================================
      // EXACTLY 12 SECONDS
      // ==================================================

      "-frames:v",
      "360",


      // ==================================================
      // VERTICAL VIDEO
      // ==================================================

      "-vf",

      "scale=1080:1920:force_original_aspect_ratio=increase," +
      "crop=1080:1920," +
      "setsar=1," +
      "format=yuv420p",


      // ==================================================
      // VIDEO ENCODING
      // ==================================================

      "-c:v",
      "libx264",

      "-preset",
      "veryfast",

      "-crf",
      "23",

      "-pix_fmt",
      "yuv420p",

      "-r",
      "30",


      // ==================================================
      // NO AUDIO IN SCENE FILES
      // ==================================================

      "-an",


      // ==================================================
      // OUTPUT
      // ==================================================

      output

    ]);


    console.log(
      `✅ SCENE ${i} MP4 created`
    );

  }


  // ==================================================
  // CREATE CONCAT LIST
  // ==================================================

  console.log(
    "🔗 Creating scene concat list..."
  );


  const concatList = `

file '/tmp/scene1.mp4'

file '/tmp/scene2.mp4'

file '/tmp/scene3.mp4'

file '/tmp/scene4.mp4'

`.trim();


  await writeFile(
    "/tmp/concat.txt",
    concatList
  );


  console.log(
    "✅ Concat list created"
  );


  // ==================================================
  // CONCAT 4 VIDEO FILES
  // ==================================================

  console.log(
    "🎞️ Joining SCENE 1 + 2 + 3 + 4..."
  );


  await runFFmpeg([

    "-y",

    "-f",
    "concat",

    "-safe",
    "0",

    "-i",
    "/tmp/concat.txt",

    "-c",
    "copy",

    "/tmp/video-no-audio.mp4"

  ]);


  console.log(
    "✅ Four scenes joined successfully"
  );


  // ==================================================
  // ADD AUDIO
  // ==================================================

  console.log(
    "🎙️ Adding voice audio..."
  );


  await runFFmpeg([

    "-y",

    // ==================================================
    // VIDEO
    // ==================================================

    "-i",
    "/tmp/video-no-audio.mp4",


    // ==================================================
    // AUDIO
    // ==================================================

    "-i",
    "/tmp/audio.mp3",


    // ==================================================
    // MAP VIDEO
    // ==================================================

    "-map",
    "0:v:0",


    // ==================================================
    // MAP AUDIO
    // ==================================================

    "-map",
    "1:a:0",


    // ==================================================
    // COPY VIDEO
    // ==================================================

    "-c:v",
    "copy",


    // ==================================================
    // ENCODE AUDIO
    // ==================================================

    "-c:a",
    "aac",

    "-b:a",
    "192k",


    // ==================================================
    // STOP WHEN AUDIO ENDS
    // ==================================================

    "-shortest",


    // ==================================================
    // STREAMING / FAST START
    // ==================================================

    "-movflags",
    "+faststart",


    // ==================================================
    // FINAL MP4
    // ==================================================

    "/tmp/UNKNOWN_FILES.mp4"

  ]);


  console.log(
    "========================================"
  );

  console.log(
    "✅ FINAL UNKNOWN_FILES.mp4 CREATED"
  );

  console.log(
    "========================================"
  );


  // ==================================================
  // READ FINAL VIDEO
  // ==================================================

  const video =
    await readFile(
      "/tmp/UNKNOWN_FILES.mp4"
    );


  console.log(
    `🎬 FINAL MP4 SIZE: ${video.length} bytes`
  );


  if (
    !video ||
    video.length === 0
  ) {

    throw new Error(
      "Final MP4 is empty."
    );

  }


  return video;

}