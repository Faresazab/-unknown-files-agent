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
// HTTP SERVER
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
              engine: "FFmpeg",
              port: PORT
            }
          );

        }


        // ==================================================
        // RENDER ENDPOINT
        // ==================================================

        if (
          req.method === "POST" &&
          req.url === "/render"
        ) {

          console.log(
            "========================================"
          );

          console.log(
            "🎬 UNKNOWN FILES /render"
          );

          console.log(
            "========================================"
          );


          const body =
            await readJSON(req);


          const video =
            await createVideo(body);


          console.log(
            "📤 Sending MP4 back to Worker..."
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
        // 404
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
          getErrorMessage(error)
        );

        console.error(
          "========================================"
        );


        if (
          !res.headersSent
        ) {

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
      "🚀 UNKNOWN FILES CONTAINER ONLINE"
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
    "🎬 Starting video render..."
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
  // AUDIO DURATION
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
  // SCENE DURATION
  // ==================================================

  const sceneDuration =
    audioDuration / SCENE_COUNT;


  console.log(
    `🎬 Each scene: ${sceneDuration.toFixed(2)} seconds`
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


    const size =
      await getFileSize(
        imagePath
      );


    const hash =
      await getFileHash(
        imagePath
      );


    console.log(
      `🖼️ IMAGE ${i + 1}`
    );

    console.log(
      `   SIZE: ${size} bytes`
    );

    console.log(
      `   HASH: ${hash}`
    );


    if (
      size === 0
    ) {

      throw new Error(
        `Image ${i + 1} is empty.`
      );

    }

  }


  // ==================================================
  // VERIFY UNIQUE IMAGES
  // ==================================================

  const hashes = [];


  for (
    let i = 1;
    i <= SCENE_COUNT;
    i++
  ) {

    hashes.push(
      await getFileHash(
        `/tmp/image${i}.jpg`
      )
    );

  }


  const uniqueHashes =
    new Set(hashes);


  console.log(
    "========================================"
  );

  console.log(
    `🖼️ UNIQUE IMAGE HASHES: ${uniqueHashes.size}/4`
  );

  console.log(
    "========================================"
  );


  if (
    uniqueHashes.size === 1
  ) {

    throw new Error(
      "ALL 4 IMAGES ARE IDENTICAL BEFORE FFMPEG."
    );

  }


  if (
    uniqueHashes.size < 4
  ) {

    console.log(
      "⚠️ Some images are identical."
    );

  } else {

    console.log(
      "✅ All 4 images are different."
    );

  }


  // ==================================================
  // FFMPEG DIRECT 4-SCENE RENDER
  // ==================================================

  console.log(
    "========================================"
  );

  console.log(
    "🎥 BUILDING 4 SCENES DIRECTLY"
  );

  console.log(
    "========================================"
  );


  // ==================================================
  // FILTER
  // ==================================================

  const filter = `

[0:v]
scale=1080:1920:force_original_aspect_ratio=increase,
crop=1080:1920,
setsar=1,
fps=30,
trim=duration=${sceneDuration},
setpts=PTS-STARTPTS
[v0];

[1:v]
scale=1080:1920:force_original_aspect_ratio=increase,
crop=1080:1920,
setsar=1,
fps=30,
trim=duration=${sceneDuration},
setpts=PTS-STARTPTS
[v1];

[2:v]
scale=1080:1920:force_original_aspect_ratio=increase,
crop=1080:1920,
setsar=1,
fps=30,
trim=duration=${sceneDuration},
setpts=PTS-STARTPTS
[v2];

[3:v]
scale=1080:1920:force_original_aspect_ratio=increase,
crop=1080:1920,
setsar=1,
fps=30,
trim=duration=${sceneDuration},
setpts=PTS-STARTPTS
[v3];

[v0][v1][v2][v3]
concat=n=4:v=1:a=0,
format=yuv420p
[v]
`;


  // ==================================================
  // RUN FFMPEG
  // ==================================================

  await runFFmpeg([

    "-y",


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
    filter,


    // ==================================================
    // MAP VIDEO
    // ==================================================

    "-map",
    "[v]",


    // ==================================================
    // MAP AUDIO
    // ==================================================

    "-map",
    "4:a:0",


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
    // STOP WITH AUDIO
    // ==================================================

    "-shortest",


    // ==================================================
    // FAST START
    // ==================================================

    "-movflags",
    "+faststart",


    // ==================================================
    // OUTPUT
    // ==================================================

    "/tmp/UNKNOWN_FILES.mp4"

  ]);


  // ==================================================
  // CHECK FINAL VIDEO
  // ==================================================

  const finalSize =
    await getFileSize(
      "/tmp/UNKNOWN_FILES.mp4"
    );


  console.log(
    "========================================"
  );

  console.log(
    `🎥 FINAL MP4 SIZE: ${finalSize} bytes`
  );

  console.log(
    "========================================"
  );


  if (
    finalSize === 0
  ) {

    throw new Error(
      "Final MP4 is empty."
    );

  }


  // ==================================================
  // READ VIDEO
  // ==================================================

  const video =
    await readFile(
      "/tmp/UNKNOWN_FILES.mp4"
    );


  console.log(
    "========================================"
  );

  console.log(
    "✅ FINAL 4-SCENE MP4 CREATED"
  );

  console.log(
    "========================================"
  );


  return video;

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
      !metadata
        .toLowerCase()
        .includes("base64")
    ) {

      throw new Error(
        `Input is not base64 for ${filePath}`
      );

    }


    base64 =
      data;

  }


  // ==================================================
  // CLEAN BASE64
  // ==================================================

  base64 =
    base64.replace(
      /\s/g,
      ""
    );


  // ==================================================
  // DECODE
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


  // ==================================================
  // WRITE
  // ==================================================

  await writeFile(
    filePath,
    buffer
  );

}


// ==================================================
// FILE SIZE
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
      String(
        result.stdout
      ).trim()
    );


  if (
    !Number.isFinite(duration)
  ) {

    throw new Error(
      "FFprobe returned invalid duration."
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
        `▶️ ${command}`
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

          stdout +=
            data.toString();

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
// CLEAN TEMP FILES
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

      // Ignore missing files.

    }

  }


  console.log(
    "🧹 Temporary files cleaned."
  );

}


// ==================================================
// READ JSON
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

            const body =
              JSON.parse(
                data
              );


            resolve(
              body
            );

          } catch (error) {

            reject(

              new Error(
                `Invalid JSON: ${getErrorMessage(error)}`
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