var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    // =========================
    // HOME
    // =========================
    if (url.pathname === "/" && request.method === "GET") {
      return json({
        status: "ONLINE",
        agent: "UNKNOWN FILES",
        endpoints: [
          "POST /api/create-story",
          "POST /api/create-assets"
        ]
      }, corsHeaders);
    }

    // =========================
    // CREATE STORY
    // =========================
    if (
      url.pathname === "/api/create-story" &&
      request.method === "POST"
    ) {
      try {
        const body = await request.json();

        const topic =
          body.topic ||
          "A mysterious event that nobody can explain";

        const prompt = `
You are the writer for a viral YouTube Shorts channel called UNKNOWN FILES.

Create a realistic mystery / psychological horror story.

Topic:
${topic}

Requirements:
- English
- 45-60 seconds
- Around 120-150 words
- Extremely strong first sentence
- Realistic and cinematic
- Psychological horror
- Hook
- Setup
- Escalation
- Twist
- Open ending
- No emojis
- No title
- No explanations
- Return ONLY the story
`;

        const result = await env.AI.run(
          "@cf/qwen/qwen3-30b-a3b-fp8",
          {
            messages: [
              {
                role: "user",
                content: prompt
              }
            ],
            max_tokens: 500
          }
        );

        const story =
          result?.response ||
          result?.content ||
          result?.result?.response ||
          result?.result?.choices?.[0]?.message?.content ||
          "";

        if (!story) {
          throw new Error("Story generation returned empty content");
        }

        return json({
          success: true,
          topic,
          story
        }, corsHeaders);

      } catch (error) {
        return json({
          success: false,
          error: error instanceof Error
            ? error.message
            : String(error)
        }, corsHeaders, 500);
      }
    }

    // =========================
    // CREATE VOICE + 4 IMAGES
    // =========================
    if (
      url.pathname === "/api/create-assets" &&
      request.method === "POST"
    ) {
      try {
        const body = await request.json();

        const story = body.story;

        if (!story) {
          return json({
            success: false,
            error: "Missing story"
          }, corsHeaders, 400);
        }

        // -------------------------
        // 1. CREATE VOICE
        // -------------------------
        const tts = await env.AI.run(
          "xai/grok-tts",
          {
            text: story,
            language: "en",
            voice_id: "leo",
            output_format: {
              codec: "mp3",
              sample_rate: 44100,
              bit_rate: 192000
            }
          }
        );

        const audio =
          tts?.audio ||
          tts?.result?.audio ||
          null;

        if (!audio) {
          throw new Error("TTS returned no audio");
        }

        // -------------------------
        // 2. CREATE 4 SCENE PROMPTS
        // -------------------------
        const scenePrompt = `
Analyze this horror story and create exactly 4 cinematic image prompts.

Story:
${story}

Rules:
- One prompt per scene
- Realistic cinematic photography
- Psychological horror
- Dark mysterious atmosphere
- Same characters and environment across scenes
- Vertical 9:16 composition
- No text
- No subtitles
- No logos

Return ONLY valid JSON:
{
  "scenes": [
    "scene 1 prompt",
    "scene 2 prompt",
    "scene 3 prompt",
    "scene 4 prompt"
  ]
}
`;

        const sceneResult = await env.AI.run(
          "@cf/qwen/qwen3-30b-a3b-fp8",
          {
            messages: [
              {
                role: "user",
                content: scenePrompt
              }
            ],
            max_tokens: 700
          }
        );

        let sceneText =
          sceneResult?.response ||
          sceneResult?.content ||
          sceneResult?.result?.response ||
          sceneResult?.result?.choices?.[0]?.message?.content ||
          "";

        // Remove markdown JSON fences if model adds them
        sceneText = sceneText
          .replace(/```json/gi, "")
          .replace(/```/g, "")
          .trim();

        let scenes;

        try {
          scenes = JSON.parse(sceneText);
        } catch {
          throw new Error(
            "Could not parse scene prompts: " + sceneText
          );
        }

        if (
          !scenes.scenes ||
          !Array.isArray(scenes.scenes) ||
          scenes.scenes.length !== 4
        ) {
          throw new Error("AI did not return exactly 4 scenes");
        }

        // -------------------------
        // 3. GENERATE 4 IMAGES
        // -------------------------
        const images = [];

        for (let i = 0; i < 4; i++) {
          const imageResult = await env.AI.run(
            "alibaba/qwen-image-3.0-pro",
            {
              prompt: scenes.scenes[i],
              size: "1024x1536",
              n: 1,
              watermark: false
            }
          );

          const image =
            imageResult?.images?.[0] ||
            imageResult?.result?.images?.[0] ||
            null;

          if (!image) {
            throw new Error(
              `Image generation failed for scene ${i + 1}`
            );
          }

          images.push({
            scene: i + 1,
            prompt: scenes.scenes[i],
            image
          });
        }

        // -------------------------
        // FINAL RESPONSE
        // -------------------------
        return json({
          success: true,
          project: "UNKNOWN FILES",
          duration: "45-60 seconds",

          story,

          audio: {
            model: "xai/grok-tts",
            voice: "leo",
            url: audio
          },

          images,

          next_step:
            "Assets generated successfully. Video assembly can now combine the audio and 4 scenes."
        }, corsHeaders);

      } catch (error) {
        return json({
          success: false,
          error: error instanceof Error
            ? error.message
            : String(error)
        }, corsHeaders, 500);
      }
    }

    // =========================
    // NOT FOUND
    // =========================
    return json({
      success: false,
      error: "Not found",
      path: url.pathname
    }, corsHeaders, 404);
  }
};


// =========================
// JSON HELPER
// =========================

function json(data, corsHeaders, status = 200) {
  return new Response(
    JSON.stringify(data, null, 2),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    }
  );
}


export {
  worker_default as default
};