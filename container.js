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
    "🎬 Starting UNKNOWN FILES video render..."
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
  // FFMPEG
  // ==================================================

  console.log(
    "🎥 Rendering 4 separate scenes..."
  );


  await runFFmpeg([

    // ==================================================
    // IMAGE 1
    // ==================================================

    "-loop",
    "1",

    "-framerate",
    "30",

    "-i",
    "/tmp/image1.jpg",


    // ==================================================
    // IMAGE 2
    // ==================================================

    "-loop",
    "1",

    "-framerate",
    "30",

    "-i",
    "/tmp/image2.jpg",


    // ==================================================
    // IMAGE 3
    // ==================================================

    "-loop",
    "1",

    "-framerate",
    "30",

    "-i",
    "/tmp/image3.jpg",


    // ==================================================
    // IMAGE 4
    // ==================================================

    "-loop",
    "1",

    "-framerate",
    "30",

    "-i",
    "/tmp/image4.jpg",


    // ==================================================
    // AUDIO
    // ==================================================

    "-i",
    "/tmp/audio.mp3",


    // ==================================================
    // FILTER
    // ==================================================

    "-filter_complex",

`
[0:v]
scale=1080:1920:force_original_aspect_ratio=increase,
crop=1080:1920,
setsar=1,
trim=duration=12,
setpts=PTS-STARTPTS,
zoompan=
z='min(zoom+0.0008,1.08)':
x='iw/2-(iw/zoom/2)':
y='ih/2-(ih/zoom/2)':
d=1:
s=1080x1920:
fps=30,
setsar=1
[v0];

[1:v]
scale=1080:1920:force_original_aspect_ratio=increase,
crop=1080:1920,
setsar=1,
trim=duration=12,
setpts=PTS-STARTPTS,
zoompan=
z='min(zoom+0.0008,1.08)':
x='iw/2-(iw/zoom/2)':
y='ih/2-(ih/zoom/2)':
d=1:
s=1080x1920:
fps=30,
setsar=1
[v1];

[2:v]
scale=1080:1920:force_original_aspect_ratio=increase,
crop=1080:1920,
setsar=1,
trim=duration=12,
setpts=PTS-STARTPTS,
zoompan=
z='min(zoom+0.0008,1.08)':
x='iw/2-(iw/zoom/2)':
y='ih/2-(ih/zoom/2)':
d=1:
s=1080x1920:
fps=30,
setsar=1
[v2];

[3:v]
scale=1080:1920:force_original_aspect_ratio=increase,
crop=1080:1920,
setsar=1,
trim=duration=12,
setpts=PTS-STARTPTS,
zoompan=
z='min(zoom+0.0008,1.08)':
x='iw/2-(iw/zoom/2)':
y='ih/2-(ih/zoom/2)':
d=1:
s=1080x1920:
fps=30,
setsar=1
[v3];

[v0][v1][v2][v3]
concat=n=4:v=1:a=0,
format=yuv420p
[v]
`,

    // ==================================================
    // VIDEO MAP
    // ==================================================

    "-map",
    "[v]",


    // ==================================================
    // AUDIO MAP
    // ==================================================

    "-map",
    "4:a:0",


    // ==================================================
    // AUDIO DURATION
    // ==================================================

    "-shortest",


    // ==================================================
    // VIDEO
    // ==================================================

    "-c:v",
    "libx264",

    "-preset",
    "veryfast",

    "-crf",
    "23",

    "-r",
    "30",

    "-pix_fmt",
    "yuv420p",


    // ==================================================
    // AUDIO
    // ==================================================

    "-c:a",
    "aac",

    "-b:a",
    "192k",


    // ==================================================
    // MOV
    // ==================================================

    "-movflags",
    "+faststart",


    // ==================================================
    // OUTPUT
    // ==================================================

    "-y",

    "/tmp/UNKNOWN_FILES.mp4"

  ]);


  console.log(
    "✅ 4-scene MP4 created successfully"
  );


  // ==================================================
  // READ VIDEO
  // ==================================================

  const video =
    await readFile(
      "/tmp/UNKNOWN_FILES.mp4"
    );


  console.log(
    `🎬 MP4 size: ${video.length} bytes`
  );


  return video;

}