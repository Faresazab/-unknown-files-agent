import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { writeFile, readFile } from "node:fs/promises";

const PORT = 8080;

function runFFmpeg(args) {
  return new Promise((resolve, reject) => {
    const process = spawn("ffmpeg", args);

    let stderr = "";

    process.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    process.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `FFmpeg failed: ${stderr.slice(-3000)}`
          )
        );
      }
    });
  });
}

async function saveInput(input, path) {

  if (!input) {
    throw new Error(`Missing input for ${path}`);
  }

  // Base64/data URL
  if (input.startsWith("data:")) {

    const comma = input.indexOf(",");

    if (comma === -1) {
      throw new Error("Invalid data URL");
    }

    const base64 = input.slice(comma + 1);

    await writeFile(
      path,
      Buffer.from(base64, "base64")
    );

    return;
  }

  // Normal URL
  const response = await fetch(input);

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

async function createVideo(body) {

  const images = body.images || [];
  const audio = body.audio;

  if (images.length !== 4) {
    throw new Error("Exactly 4 images are required.");
  }

  if (!audio) {
    throw new Error("Audio is required.");
  }

  // ==========================================
  // SAVE AUDIO
  // ==========================================

  await saveInput(
    audio,
    "/tmp/audio.mp3"
  );

  // ==========================================
  // SAVE 4 IMAGES
  // ==========================================

  for (let i = 0; i < 4; i++) {

    await saveInput(
      images[i],
      `/tmp/image${i + 1}.jpg`
    );

  }

  // ==========================================
  // CREATE 48 SECOND SHORT
  // ==========================================

  await runFFmpeg([

    "-loop", "1",
    "-i", "/tmp/image1.jpg",

    "-loop", "1",
    "-i", "/tmp/image2.jpg",

    "-loop", "1",
    "-i", "/tmp/image3.jpg",

    "-loop", "1",
    "-i", "/tmp/image4.jpg",

    "-i", "/tmp/audio.mp3",

    "-filter_complex",

    `
    [0:v]
    scale=1080:1920:force_original_aspect_ratio=increase,
    crop=1080:1920,
    setsar=1,
    zoompan=z='min(zoom+0.0008,1.08)':d=360:s=1080x1920:fps=30
    [v0];

    [1:v]
    scale=1080:1920:force_original_aspect_ratio=increase,
    crop=1080:1920,
    setsar=1,
    zoompan=z='min(zoom+0.0008,1.08)':d=360:s=1080x1920:fps=30
    [v1];

    [2:v]
    scale=1080:1920:force_original_aspect_ratio=increase,
    crop=1080:1920,
    setsar=1,
    zoompan=z='min(zoom+0.0008,1.08)':d=360:s=1080x1920:fps=30
    [v2];

    [3:v]
    scale=1080:1920:force_original_aspect_ratio=increase,
    crop=1080:1920,
    setsar=1,
    zoompan=z='min(zoom+0.0008,1.08)':d=360:s=1080x1920:fps=30
    [v3];

    [v0][v1][v2][v3]
    concat=n=4:v=1:a=0
    [v]
    `,

    "-map", "[v]",
    "-map", "4:a",

    "-shortest",

    "-r", "30",

    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "23",

    "-pix_fmt", "yuv420p",

    "-c:a", "aac",
    "-b:a", "192k",

    "-movflags", "+faststart",

    "-y",
    "/tmp/UNKNOWN_FILES.mp4"

  ]);

  return await readFile(
    "/tmp/UNKNOWN_FILES.mp4"
  );
}


// ==========================================
// HTTP SERVER
// ==========================================

const server = createServer(
  async (req, res) => {

    if (
      req.method === "GET" &&
      req.url === "/health"
    ) {

      res.writeHead(200, {
        "Content-Type":
          "application/json"
      });

      res.end(
        JSON.stringify({
          success: true,
          service:
            "UNKNOWN FILES VIDEO ENGINE"
        })
      );

      return;
    }

    if (
      req.method !== "POST" ||
      req.url !== "/render"
    ) {

      res.writeHead(404);
      res.end("Not found");

      return;
    }

    let body = "";

    req.on("data", chunk => {
      body += chunk;
    });

    req.on("end", async () => {

      try {

        const data =
          JSON.parse(body);

        const video =
          await createVideo(data);

        res.writeHead(200, {
          "Content-Type":
            "video/mp4",

          "Content-Length":
            video.length
        });

        res.end(video);

      } catch (error) {

        console.error(error);

        res.writeHead(500, {
          "Content-Type":
            "application/json"
        });

        res.end(
          JSON.stringify({
            success: false,
            error: error.message
          })
        );

      }

    });

  }
);

server.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `UNKNOWN FILES VIDEO ENGINE running on ${PORT}`
    );
  }
);