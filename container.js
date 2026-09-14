// ==================================================
// UNKNOWN FILES - VIDEO CONTAINER
// ==================================================

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";

import {
  writeFile,
  readFile,
  unlink,
  stat
} from "node:fs/promises";


// ==================================================
// CONFIG
// ==================================================

const PORT = 8080;

const VIDEO_WIDTH = 1080;

const VIDEO_HEIGHT = 1920;

const FPS = 30;

const SCENE_COUNT = 4;


// ==================================================
// MAIN SERVER
// ==================================================

const server =
  createServer(
    async (req, res) => {

      try {

        // ==================================================
        // HEALTH CHECK
        // ==================================================

        if (
          req.method === "GET" &&
          req.url === "/"
        ) {

          return sendJSON(
            res,
            {
              status: "ONLINE",
              service: "UNKNOWN FILES VIDEO CONTAINER",
              port: PORT,
              engine: "FFmpeg"
            }
          );

        }


        // ==================================================
        // RENDER
        // ==================================================

        if (
          req.method === "POST" &&
          req.url === "/render"
        ) {

          console.log(
            "========================================"
          );

          console.log(
            "🎬 UNKNOWN FILES /render REQUEST"
          );

          console.log(
            "========================================"
          );


          const body =
            await readJSON(req);


          const video =
            await createVideo(body);


          console.log(
            "📤 Sending final MP4 to Worker..."
          );


          res.statusCode = 200;

          res.setHeader(
            "Content-Type",
            "video/mp4"
          );

          res.setHeader(
            "Content-Length",
            video.length
          );

          res.setHeader(
            "Cache-Control",
            "no-store"
          );


          res.end(video);


          console.log(
            "✅ MP4 sent successfully."
          );


          return;

        }


        // ==================================================
        // NOT FOUND
        // ==================================================

        res.statusCode = 404;

        sendJSON(
          res,
          {
            success: false,
            error: "Not found"
          }
        );

      } catch (error) {

        console.error(
          "========================================"
        );

        console.error(
          "❌ CONTAINER ERROR"
        );

        console.error(
          error
        );

        console.error(
          "========================================"
        );


        if (!res.headersSent) {

          res.statusCode = 500;

          sendJSON(
            res,
            {
              success: false,
              error:
                getErrorMessage(error)
            }
          );

        } else {

          res.end();

        }

      }

    }
  );


// ==================================================
// START SERVER
// ==================================================

server.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      "========================================"
    );

    console.log(
      `🚀 UNKNOWN FILES CONTAINER ONLINE`
    );

    console.log(
      `🚀 PORT: ${PORT}`
    );

    console.log(
      "========================================"
    );

  }
);


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
    images.length !== SCENE_COUNT
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
  // CLEAN OLD FILES
  // ==================================================

  await cleanOldFiles();


  // ==================================================
  // SAVE AUDIO
  // ==================================================

  await saveInput(
    audio,
    "/tmp/audio.mp3"
  );


  console.log(
    "✅ Audio saved: /tmp/audio.mp3"
  );


  // ==================================================
  // CHECK AUDIO
  // ==================================================

  const audioSize =
    await getFileSize(
      "/tmp/audio.mp3"
    );


  console.log(
    `🎙️ Audio size: ${audioSize} bytes`
  );


  if (
    audioSize === 0
  ) {

    throw new Error(
      "Audio file is empty."
    );

  }


  // ==================================================
  // GET AUDIO DURATION
  // ==================================================

  const audioDuration =
    await getMediaDuration(
      "/tmp/audio.mp3"
    );


  console.log(
    `⏱️ Audio duration: ${audioDuration.toFixed(2)} seconds`
  );


  if (
    !Number.isFinite(audioDuration) ||
    audioDuration <= 0
  ) {

    throw new Error(
      "Could not determine audio duration."
    );

  }


  // ==================================================
  // CALCULATE SCENE DURATION
  // ==================================================

  const sceneDuration =
    audioDuration / SCENE_COUNT;


  console.log(
    `🎬 Each scene duration: ${sceneDuration.toFixed(2)} seconds`
  );


  // ==================================================
  // SAVE 4 IMAGES
  // ==================================================

  console.log(
    "========================================"
  );

  console.log(
    "🖼️ SAVING 4 IMAGES"
  );

  console.log(
    "========================================"
  );


  for (
    let i = 0;
    i < SCENE_COUNT;
    i++
  ) {

    const imagePath =
      `/tmp/image${i + 1}.jpg`;


    await saveInput(
      images[i],
      imagePath
    );


    const imageSize =
      await getFileSize(
        imagePath
      );


    const imageHash =
      await getFileHash(
        imagePath
      );


    console.log(
      `🖼️ IMAGE ${i + 1}`
    );

    console.log(
      `   SIZE: ${imageSize} bytes`
    );

    console.log(
      `   HASH: ${imageHash}`
    );


    if (
      imageSize === 0
    ) {

      throw new Error(
        `Image ${i + 1} is empty.`
      );

    }

  }


  // ==================================================
  // COMPARE IMAGE HASHES
  // ==================================================

  const imageHashes = [];


  for (
    let i = 1;
    i <= SCENE_COUNT;
    i++
  ) {

    imageHashes.push(
      await getFileHash(
        `/tmp/image${i}.jpg`
      )
    );

  }


  const uniqueHashes =
    new Set(imageHashes);


  console.log(
    "========================================"
  );

  console.log(
    `🖼️ UNIQUE IMAGE HASHES: ${uniqueHashes.size}/4`
  );

  console.log(
    "========================================"
  );


  // ==================================================
  // IMPORTANT DIAGNOSTIC
  // ==================================================

  if (
    uniqueHashes.size === 1
  ) {

    throw new Error(
      "ALL 4 GENERATED IMAGES ARE IDENTICAL. The problem is before FFmpeg: FLUX returned the same image for all scenes."
    );

  }


  if (
    uniqueHashes.size < 4
  ) {

    console.log(
      "⚠️ WARNING: Some scenes contain identical images."
    );

  } else {

    console.log(
      "✅ All 4 images are different."
    );

  }


  // ==================================================
  // CREATE 4 SEPARATE SCENE VIDEOS
  // ==================================================

  console.log(
    "========================================"
  );

  console.log(
    "🎥 CREATING 4 INDEPENDENT SCENE VIDEOS"
  );

  console.log(
    "========================================"
  );


  for (
    let i = 1;
    i <= SCENE_COUNT;
    i++
  ) {

    const input =
      `/tmp/image${i}.jpg`;


    const output =
      `/tmp/scene${i}.mp4`;


    console.log(
      `🎬 Rendering SCENE ${i}...`
    );


    await renderScene(
      input,
      output,
      sceneDuration
    );


    const sceneSize =
      await getFileSize(
        output
      );


    console.log(
      `✅ SCENE ${i} MP4 created`
    );

    console.log(
      `   SIZE: ${sceneSize} bytes`
    );


    if (
      sceneSize === 0
    ) {

      throw new Error(
        `Scene ${i} MP4 is empty.`
      );

    }

  }


  // ==================================================
  // CREATE CONCAT FILE
  // ==================================================

  console.log(
    "🔗 Creating concat list..."
  );


  const concatList = [

    "file '/tmp/scene1.mp4'",

    "file '/tmp/scene2.mp4'",

    "file '/tmp/scene3.mp4'",

    "file '/tmp/scene4.mp4'"

  ].join("\n");


  await writeFile(
    "/tmp/concat.txt",
    concatList,
    "utf8"
  );


  console.log(
    "✅ Concat list created."
  );


  // ==================================================
  // CONCAT SCENES
  // ==================================================

  console.log(
    "========================================"
  );

  console.log(
    "🔗 JOINING SCENE 1 + 2 + 3 + 4"
  );

  console.log(
    "========================================"
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

    "-movflags",
    "+faststart",

    "/tmp/video-no-audio.mp4"

  ]);


  const joinedVideoSize =
    await getFileSize(
      "/tmp/video-no-audio.mp4"
    );


  console.log(
    `✅ Four scenes joined: ${joinedVideoSize} bytes`
  );


  // ==================================================
  // ADD AUDIO
  // ==================================================

  console.log(
    "========================================"
  );

  console.log(
    "🎙️ ADDING AUDIO"
  );

  console.log(
    "========================================"
  );


  await runFFmpeg([

    "-y",

    // VIDEO
    "-i",
    "/tmp/video-no-audio.mp4",

    // AUDIO
    "-i",
    "/tmp/audio.mp3",

    // VIDEO MAP
    "-map",
    "0:v:0",

    // AUDIO MAP
    "-map",
    "1:a:0",

    // COPY VIDEO
    "-c:v",
    "copy",

    // AUDIO
    "-c:a",
    "aac",

    "-b:a",
    "192k",

    // END WITH AUDIO
    "-shortest",

    // FAST START
    "-movflags",
    "+faststart",

    // OUTPUT
    "/tmp/UNKNOWN_FILES.mp4"

  ]);


  // ==================================================
  // FINAL VIDEO
  // ==================================================

  const finalSize =
    await getFileSize(
      "/tmp/UNKNOWN_FILES.mp4"
    );


  console.log(
    "========================================"
  );

  console.log(
    "🎥 FINAL VIDEO"
  );

  console.log(
    `📦 SIZE: ${finalSize} bytes`
  );

  console.log(
    "========================================"
  );


  if (
    finalSize === 0
  ) {

    throw new Error(
      "Final UNKNOWN_FILES.mp4 is empty."
    );

  }


  const video =
    await readFile(
      "/tmp/UNKNOWN_FILES.mp4"
    );


  console.log(
    "✅ FINAL MP4 READY"
  );


  return video;

}


// ==================================================
// RENDER ONE SCENE
// ==================================================

async function renderScene(
  input,
  output,
  duration
) {

  // ==================================================
  // SAFETY
  // ==================================================

  if (
    !Number.isFinite(duration) ||
    duration <= 0
  ) {

    throw new Error(
      "Invalid scene duration."
    );

  }


  // ==================================================
  // FFmpeg
  // ==================================================

  await runFFmpeg([

    "-y",

    // ==================================================
    // LOOP IMAGE
    // ==================================================

    "-loop",
    "1",

    "-framerate",
    String(FPS),

    "-i",
    input,


    // ==================================================
    // EXACT SCENE DURATION
    // ==================================================

    "-t",
    duration.toFixed(3),


    // ==================================================
    // VERTICAL FORMAT
    // ==================================================

    "-vf",

    [
      `scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:force_original_aspect_ratio=increase`,
      `crop=${VIDEO_WIDTH}:${VIDEO_HEIGHT}`,
      "setsar=1",
      "format=yuv420p"
    ].join(","),


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
    String(FPS),

    "-pix_fmt",
    "yuv420p",


    // ==================================================
    // NO AUDIO
    // ==================================================

    "-an",


    // ==================================================
    // OUTPUT
    // ==================================================

    output

  ]);

}


// ==================================================
// SAVE INPUT
// ==================================================

async function saveInput(
  input,
  filePath
) {

  if (!input) {

    throw new Error(
      `Empty input for ${filePath}`
    );

  }


  // ==================================================
  // BUFFER
  // ==================================================

  if (
    Buffer.isBuffer(input)
  ) {

    await writeFile(
      filePath,
      input
    );

    return;

  }


  // ==================================================
  // STRING
  // ==================================================

  if (
    typeof input !== "string"
  ) {

    throw new Error(
      `Invalid input type for ${filePath}`
    );

  }


  let base64 =
    input;


  // ==================================================
  // DATA URL
  // ==================================================

  if (
    input.startsWith("data:")
  ) {

    const comma =
      input.indexOf(",");


    if (
      comma === -1
    ) {

      throw new Error(
        `Invalid data URL for ${filePath}`
      );

    }


    const metadata =
      input.substring(
        0,
        comma
      );


    const data =
      input.substring(
        comma + 1
      );


    if (
      !metadata.toLowerCase().includes(
        "base64"
      )
    ) {

      throw new Error(
        `Input is not base64 for ${filePath}`
      );

    }


    base64 =
      data;

  }


  // ==================================================
  // REMOVE WHITESPACE
  // ==================================================

  base64 =
    base64.replace(
      /\s/g,
      ""
    );


  // ==================================================
  // BASE64 → BUFFER
  // ==================================================

  let buffer;


  try {

    buffer =
      Buffer.from(
        base64,
        "base64"
      );

  } catch (error) {

    throw new Error(
      `Could not decode ${filePath}: ${getErrorMessage(error)}`
    );

  }


  if (
    !buffer ||
    buffer.length === 0
  ) {

    throw new Error(
      `Decoded input is empty for ${filePath}`
    );

  }


  await writeFile(
    filePath,
    buffer
  );

}


// ==================================================
// GET FILE SIZE
// ==================================================

async function getFileSize(
  filePath
) {

  try {

    const info =
      await stat(
        filePath
      );


    return info.size;

  } catch (error) {

    return 0;

  }

}


// ==================================================
// FILE HASH
// ==================================================

async function getFileHash(
  filePath
) {

  const data =
    await readFile(
      filePath
    );


  return createHash(
    "sha256"
  )
    .update(data)
    .digest("hex")
    .substring(0, 16);

}


// ==================================================
// MEDIA DURATION
// ==================================================

async function getMediaDuration(
  filePath
) {

  const result =
    await runCommand(

      "ffprobe",

      [

        "-v",
        "error",

        "-show_entries",
        "format=duration",

        "-of",
        "default=noprint_wrappers=1:nokey=1",

        filePath

      ]

    );


  const duration =
    Number(
      String(result.stdout).trim()
    );


  if (
    !Number.isFinite(duration)
  ) {

    throw new Error(
      "FFprobe returned an invalid media duration."
    );

  }


  return duration;

}


// ==================================================
// RUN FFMPEG
// ==================================================

function runFFmpeg(
  args
) {

  return runCommand(
    "ffmpeg",
    args
  );

}


// ==================================================
// RUN COMMAND
// ==================================================

function runCommand(
  command,
  args
) {

  return new Promise(
    (resolve, reject) => {

      console.log(
        `▶️ ${command} ${args.join(" ")}`
      );


      const child =
        spawn(
          command,
          args,
          {
            stdio: [
              "ignore",
              "pipe",
              "pipe"
            ]
          }
        );


      let stdout =
        "";

      let stderr =
        "";


      // ==================================================
      // STDOUT
      // ==================================================

      child.stdout.on(
        "data",
        data => {

          const text =
            data.toString();


          stdout +=
            text;

        }
      );


      // ==================================================
      // STDERR
      // ==================================================

      child.stderr.on(
        "data",
        data => {

          const text =
            data.toString();


          stderr +=
            text;


          // FFmpeg writes normal progress
          // information to stderr.
          // Only print the latest useful part.

          if (
            command === "ffmpeg"
          ) {

            process.stdout.write(
              text
            );

          }

        }
      );


      // ==================================================
      // ERROR
      // ==================================================

      child.on(
        "error",
        error => {

          reject(
            new Error(
              `${command} could not start: ${getErrorMessage(error)}`
            )
          );

        }
      );


      // ==================================================
      // CLOSE
      // ==================================================

      child.on(
        "close",
        code => {

          if (
            code === 0
          ) {

            resolve({

              code,

              stdout,

              stderr

            });

            return;

          }


          const lastError =
            stderr.length > 5000

              ? stderr.substring(
                  stderr.length - 5000
                )

              : stderr;


          reject(

            new Error(

              `${command} failed with exit code ${code}.\n\n${lastError}`

            )

          );

        }
      );

    }
  );

}


// ==================================================
// CLEAN OLD FILES
// ==================================================

async function cleanOldFiles() {

  const files = [

    "/tmp/audio.mp3",

    "/tmp/image1.jpg",

    "/tmp/image2.jpg",

    "/tmp/image3.jpg",

    "/tmp/image4.jpg",

    "/tmp/scene1.mp4",

    "/tmp/scene2.mp4",

    "/tmp/scene3.mp4",

    "/tmp/scene4.mp4",

    "/tmp/concat.txt",

    "/tmp/video-no-audio.mp4",

    "/tmp/UNKNOWN_FILES.mp4"

  ];


  for (
    const file of files
  ) {

    try {

      await unlink(
        file
      );

    } catch (error) {

      // File may not exist.
      // Ignore.

    }

  }


  console.log(
    "🧹 Old temporary files cleaned."
  );

}


// ==================================================
// READ JSON REQUEST
// ==================================================

function readJSON(
  req
) {

  return new Promise(
    (resolve, reject) => {

      let data =
        "";


      req.on(
        "data",
        chunk => {

          data +=
            chunk.toString();

        }
      );


      req.on(
        "end",
        () => {

          try {

            const parsed =
              JSON.parse(
                data
              );


            resolve(
              parsed
            );

          } catch (error) {

            reject(

              new Error(
                `Invalid JSON request: ${getErrorMessage(error)}`
              )

            );

          }

        }
      );


      req.on(
        "error",
        error => {

          reject(
            error
          );

        }
      );

    }
  );

}


// ==================================================
// SEND JSON
// ==================================================

function sendJSON(
  res,
  data,
  statusCode = 200
) {

  const output =
    JSON.stringify(
      data,
      null,
      2
    );


  res.statusCode =
    statusCode;


  res.setHeader(
    "Content-Type",
    "application/json"
  );


  res.setHeader(
    "Content-Length",
    Buffer.byteLength(
      output
    )
  );


  res.end(
    output
  );

}


// ==================================================
// ERROR MESSAGE
// ==================================================

function getErrorMessage(
  error
) {

  if (
    error instanceof Error
  ) {

    return error.message;

  }


  if (
    typeof error === "string"
  ) {

    return error;

  }


  try {

    return JSON.stringify(
      error
    );

  } catch (e) {

    return String(
      error
    );

  }

}