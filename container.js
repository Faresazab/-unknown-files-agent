import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { writeFile, readFile } from "node:fs/promises";

const PORT = 8080;


// ==================================================
// FFMPEG
// ==================================================

function runFFmpeg(args) {

  return new Promise((resolve, reject) => {

    const process = spawn(
      "ffmpeg",
      args
    );

    let stderr = "";

    process.stderr.on(
      "data",
      (data) => {
        stderr += data.toString();
      }
    );

    process.on(
      "close",
      (code) => {

        if (code === 0) {

          resolve();

        } else {

          reject(
            new Error(
              `FFmpeg failed:\n${stderr.slice(-5000)}`
            )
          );

        }

      }
    );

  });

}


// ==================================================
// SAVE INPUT
// ==================================================

async function saveInput(
  input,
  path
) {

  if (!input) {

    throw new Error(
      `Missing input for ${path}`
    );

  }


  // Base64 / Data URL

  if (
    input.startsWith("data:")
  ) {

    const comma =
      input.indexOf(",");


    if (comma === -1) {

      throw new Error(
        "Invalid data URL"
      );

    }


    const base64 =
      input.slice(
        comma + 1
      );


    await writeFile(
      path,
      Buffer.from(
        base64,
        "base64"
      )
    );


    return;

  }


  // Normal URL

  const response =
    await fetch(input);


  if (!response.ok) {

    throw new Error(
      `Could not download input: ${response.status}`
    );

  }


  await writeFile(
    path,
    Buffer.from(
      await response.arrayBuffer()
    )
  );

}


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
  //
  // IMPORTANT:
  //
  // DO NOT USE:
  //
  // -loop 1
  //
  // on the image inputs.
  //
  // Each image must be a SINGLE input frame.
  //
  // zoompan creates 360 frames = 12 seconds.
  // ==================================================

  console.log(
    "🎥 Rendering 4 scenes..."
  );


  await runFFmpeg([

    // ----------------------------------------------
    // IMAGE 1
    // ----------------------------------------------

    "-i",
    "/tmp/image1.jpg",

    // ----------------------------------------------
    // IMAGE 2
    // ----------------------------------------------

    "-i",
    "/tmp/image2.jpg",

    // ----------------------------------------------
    // IMAGE 3
    // ----------------------------------------------

    "-i",
    "/tmp/image3.jpg",

    // ----------------------------------------------
    // IMAGE 4
    // ----------------------------------------------

    "-i",
    "/tmp/image4.jpg",

    // ----------------------------------------------
    // AUDIO
    // ----------------------------------------------

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
zoompan=
z='min(zoom+0.0008,1.08)':
x='iw/2-(iw/zoom/2)':
y='ih/2-(ih/zoom/2)':
d=360:
s=1080x1920:
fps=30
[v0];

[1:v]
scale=1080:1920:force_original_aspect_ratio=increase,
crop=1080:1920,
setsar=1,
zoompan=
z='min(zoom+0.0008,1.08)':
x='iw/2-(iw/zoom/2)':
y='ih/2-(ih/zoom/2)':
d=360:
s=1080x1920:
fps=30
[v1];

[2:v]
scale=1080:1920:force_original_aspect_ratio=increase,
crop=1080:1920,
setsar=1,
zoompan=
z='min(zoom+0.0008,1.08)':
x='iw/2-(iw/zoom/2)':
y='ih/2-(ih/zoom/2)':
d=360:
s=1080x1920:
fps=30
[v2];

[3:v]
scale=1080:1920:force_original_aspect_ratio=increase,
crop=1080:1920,
setsar=1,
zoompan=
z='min(zoom+0.0008,1.08)':
x='iw/2-(iw/zoom/2)':
y='ih/2-(ih/zoom/2)':
d=360:
s=1080x1920:
fps=30
[v3];

[v0][v1][v2][v3]
concat=n=4:v=1:a=0
[v]
`,

    // ==================================================
    // VIDEO
    // ==================================================

    "-map",
    "[v]",

    // ==================================================
    // AUDIO
    // ==================================================

    "-map",
    "4:a",

    // ==================================================
    // STOP WHEN AUDIO ENDS
    // ==================================================

    "-shortest",

    // ==================================================
    // VIDEO SETTINGS
    // ==================================================

    "-r",
    "30",

    "-c:v",
    "libx264",

    "-preset",
    "veryfast",

    "-crf",
    "23",

    "-pix_fmt",
    "yuv420p",

    // ==================================================
    // AUDIO SETTINGS
    // ==================================================

    "-c:a",
    "aac",

    "-b:a",
    "192k",

    // ==================================================
    // STREAMING
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
    "✅ MP4 created successfully"
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


// ==================================================
// HTTP SERVER
// ==================================================

const server =
  createServer(
    async (
      req,
      res
    ) => {


      // ==================================================
      // HEALTH
      // ==================================================

      if (
        req.method === "GET" &&
        req.url === "/health"
      ) {

        res.writeHead(
          200,
          {
            "Content-Type":
              "application/json"
          }
        );


        res.end(
          JSON.stringify({
            success: true,
            service:
              "UNKNOWN FILES VIDEO ENGINE"
          })
        );


        return;

      }


      // ==================================================
      // RENDER
      // ==================================================

      if (
        req.method !== "POST" ||
        req.url !== "/render"
      ) {

        res.writeHead(
          404
        );

        res.end(
          "Not found"
        );

        return;

      }


      let body = "";


      req.on(
        "data",
        chunk => {
          body +=
            chunk.toString();
        }
      );


      req.on(
        "end",
        async () => {

          try {

            const data =
              JSON.parse(body);


            console.log(
              "📦 Render request received"
            );


            const video =
              await createVideo(
                data
              );


            res.writeHead(
              200,
              {
                "Content-Type":
                  "video/mp4",

                "Content-Length":
                  video.length
              }
            );


            res.end(
              video
            );


          } catch (error) {

            console.error(
              "❌ VIDEO ERROR:",
              error
            );


            res.writeHead(
              500,
              {
                "Content-Type":
                  "application/json"
              }
            );


            res.end(
              JSON.stringify({
                success: false,
                error:
                  error.message
              })
            );

          }

        }
      );

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
      `UNKNOWN FILES VIDEO ENGINE running on ${PORT}`
    );

  }
);