import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { writeFile, readFile, unlink } from "node:fs/promises";

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
            `FFmpeg failed with code ${code}: ${stderr.slice(-3000)}`
          )
        );
      }
    });
  });
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

  // Download audio
  const audioResponse = await fetch(audio);

  if (!audioResponse.ok) {
    throw new Error("Could not download audio.");
  }

  await writeFile(
    "/tmp/audio.mp3",
    Buffer.from(await audioResponse.arrayBuffer())
  );

  // Download 4 images
  for (let i = 0; i < 4; i++) {
    const imageResponse = await fetch(images[i]);

    if (!imageResponse.ok) {
      throw new Error(`Could not download image ${i + 1}.`);
    }

    await writeFile(
      `/tmp/image${i + 1}.jpg`,
      Buffer.from(await imageResponse.arrayBuffer())
    );
  }

  /*
    4 images.
    Each image stays for 12 seconds.
    Total = 48 seconds.

    Video:
    1080x1920
    H.264
    AAC
    30 FPS
  */

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
    [0:v]scale=1080:1920:force_original_aspect_ratio=increase,
    crop=1080:1920,
    setsar=1,
    zoompan=z='min(zoom+0.0008,1.08)':d=360:s=1080x1920:fps=30[v0];

    [1:v]scale=1080:1920:force_original_aspect_ratio=increase,
    crop=1080:1920,
    setsar=1,
    zoompan=z='min(zoom+0.0008,1.08)':d=360:s=1080x1920:fps=30[v1];

    [2:v]scale=1080:1920:force_original_aspect_ratio=increase,
    crop=1080:1920,
    setsar=1,
    zoompan=z='min(zoom+0.0008,1.08)':d=360:s=1080x1920:fps=30[v2];

    [3:v]scale=1080:1920:force_original_aspect_ratio=increase,
    crop=1080:1920,
    setsar=1,
    zoompan=z='min(zoom+0.0008,1.08)':d=360:s=1080x1920:fps=30[v3];

    [v0][v1][v2][v3]concat=n=4:v=1:a=0[v]
    `,

    "-map", "[v]",
    "-map", "4:a",

    "-t", "48",

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

  const video = await readFile(
    "/tmp/UNKNOWN_FILES.mp4"
  );

  return video;
}

const server = createServer(async (req, res) => {
  try {

    if (
      req.method === "GET" &&
      req.url === "/health"
    ) {

      res.writeHead(200, {
        "Content-Type": "application/json"
      });

      res.end(
        JSON.stringify({
          status: "ONLINE",
          service: "UNKNOWN FILES VIDEO ENGINE"
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
          "Content-Type": "video/mp4",
          "Content-Length": video.length
        });

        res.end(video);

      } catch (error) {

        console.error(error);

        res.writeHead(500, {
          "Content-Type": "application/json"
        });

        res.end(
          JSON.stringify({
            success: false,
            error: error.message
          })
        );

      }

    });

  } catch (error) {

    res.writeHead(500);

    res.end(error.message);

  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(
    `UNKNOWN FILES video engine running on port ${PORT}`
  );
});