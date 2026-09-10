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

        const story = extractAIText(result);

        if (!story) {
          throw new Error(
            "Story generation returned empty content"
          );
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
    // CREATE ASSETS
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

        // =====================================
        // 1. CREATE 4 SCENE PROMPTS FIRST
        // =====================================

        const scenePrompt = `
You are a cinematic storyboard director.

Read the horror story below.

Create EXACTLY 4 visual scene prompts.

STORY:
${story}

Each scene must describe what should appear on screen.

Requirements:
- Exactly 4 scenes
- English
- Realistic cinematic photography
- Psychological horror
- Dark mysterious atmosphere
- Same main character throughout
- Same visual identity and environment
- Strong visual continuity
- Vertical 9:16
- No text
- No subtitles
- No logos
- No explanations

VERY IMPORTANT:

Return ONLY this JSON object.
Do not write anything before or after it.

{
  "scenes": [
    "A detailed cinematic prompt for scene 1",
    "A detailed cinematic prompt for scene 2",
    "A detailed cinematic prompt for scene 3",
    "A detailed cinematic prompt for scene 4"
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
            max_tokens: 1000,
            temperature: 0.2
          }
        );

        const rawSceneText = extractAIText(sceneResult);

        if (!rawSceneText) {
          throw new Error(
            "Scene generation returned empty content."
          );
        }

        // =====================================
        // 2. EXTRACT JSON SAFELY
        // =====================================

        const scenes = parseSceneJSON(rawSceneText);

        if (
          !scenes ||
          !Array.isArray(scenes.scenes) ||
          scenes.scenes.length !== 4
        ) {
          throw new Error(
            "AI did not return exactly 4 valid scenes."
          );
        }

        // =====================================
        // 3. CREATE TTS
        // =====================================

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
          throw new Error(
            "TTS returned no audio."
          );
        }

        // =====================================
        // 4. GENERATE 4 IMAGES
        // =====================================

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
              `Image generation failed for scene ${i + 1}.`
            );
          }

          images.push({
            scene: i + 1,
            prompt: scenes.scenes[i],
            image
          });
        }

        // =====================================
        // 5. SUCCESS
        // =====================================

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

          scenes: scenes.scenes,

          images,

          next_step:
            "Story, voice and four cinematic scenes are ready for MP4 assembly."
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


// ========================================
// EXTRACT AI TEXT
// ========================================

function extractAIText(result) {

  if (!result) {
    return "";
  }

  if (typeof result === "string") {
    return result.trim();
  }

  if (typeof result.response === "string") {
    return result.response.trim();
  }

  if (typeof result.content === "string") {
    return result.content.trim();
  }

  if (
    result.result &&
    typeof result.result.response === "string"
  ) {
    return result.result.response.trim();
  }

  if (
    result.result &&
    typeof result.result.content === "string"
  ) {
    return result.result.content.trim();
  }

  if (
    result.result &&
    result.result.choices &&
    result.result.choices[0] &&
    result.result.choices[0].message
  ) {
    const message =
      result.result.choices[0].message;

    if (typeof message.content === "string") {
      return message.content.trim();
    }

    if (typeof message.reasoning_content === "string") {
      return message.reasoning_content.trim();
    }
  }

  if (
    result.choices &&
    result.choices[0] &&
    result.choices[0].message
  ) {
    const message =
      result.choices[0].message;

    if (typeof message.content === "string") {
      return message.content.trim();
    }
  }

  return "";
}


// ========================================
// SAFE SCENE JSON PARSER
// ========================================

function parseSceneJSON(text) {

  let cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  // ----------------------------------------
  // Try direct JSON
  // ----------------------------------------

  try {
    const direct = JSON.parse(cleaned);

    if (
      direct &&
      Array.isArray(direct.scenes)
    ) {
      return direct;
    }
  } catch (e) {
    // Continue
  }

  // ----------------------------------------
  // Extract first { ... } JSON object
  // ----------------------------------------

  const firstBrace =
    cleaned.indexOf("{");

  const lastBrace =
    cleaned.lastIndexOf("}");

  if (
    firstBrace !== -1 &&
    lastBrace !== -1 &&
    lastBrace > firstBrace
  ) {

    const possibleJSON =
      cleaned.substring(
        firstBrace,
        lastBrace + 1
      );

    try {

      const parsed =
        JSON.parse(possibleJSON);

      if (
        parsed &&
        Array.isArray(parsed.scenes)
      ) {
        return parsed;
      }

    } catch (e) {
      // Continue
    }
  }

  // ----------------------------------------
  // Try extracting JSON array
  // ----------------------------------------

  const firstBracket =
    cleaned.indexOf("[");

  const lastBracket =
    cleaned.lastIndexOf("]");

  if (
    firstBracket !== -1 &&
    lastBracket !== -1 &&
    lastBracket > firstBracket
  ) {

    const possibleArray =
      cleaned.substring(
        firstBracket,
        lastBracket + 1
      );

    try {

      const array =
        JSON.parse(possibleArray);

      if (
        Array.isArray(array) &&
        array.length === 4
      ) {

        return {
          scenes: array
        };
      }

    } catch (e) {
      // Continue
    }
  }

  // ----------------------------------------
  // Last-resort line extraction
  // ----------------------------------------

  const lines =
    cleaned
      .split("\n")
      .map(x => x.trim())
      .filter(x => x.length > 20);

  if (lines.length >= 4) {

    return {
      scenes: lines
        .slice(0, 4)
        .map(x =>
          x
            .replace(/^[-*0-9.)]+\s*/, "")
            .replace(/^["']|["']$/g, "")
        )
    };
  }

  throw new Error(
    "Could not parse scene prompts. AI returned: " +
    cleaned.substring(0, 1000)
  );
}


// ========================================
// JSON RESPONSE HELPER
// ========================================

function json(data, corsHeaders, status = 200) {

  return new Response(
    JSON.stringify(
      data,
      null,
      2
    ),
    {
      status,

      headers: {
        ...corsHeaders,
        "Content-Type":
          "application/json"
      }
    }
  );
}


export {
  worker_default as default
};