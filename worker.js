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

    // ==========================================
    // HOME
    // ==========================================

    if (url.pathname === "/" && request.method === "GET") {

      return json({
        status: "ONLINE",
        agent: "UNKNOWN FILES",
        version: "3.0",
        endpoints: [
          "POST /api/create-story",
          "POST /api/create-assets",
          "POST /api/generate-short"
        ]
      }, corsHeaders);

    }


    // ==========================================
    // CREATE STORY
    // ==========================================

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

TOPIC:
${topic}

REQUIREMENTS:

- English
- 45-60 seconds
- 120-150 words
- Extremely strong first sentence
- Realistic
- Cinematic
- Psychological horror
- Hook
- Setup
- Escalation
- Twist
- Open ending
- No emojis
- No title
- No explanations
- No bullet points

IMPORTANT:

Return ONLY the story.
`;


        const result = await runWithRetry(
          env,
          "@cf/qwen/qwen3-30b-a3b-fp8",
          {
            messages: [
              {
                role: "user",
                content: prompt
              }
            ],
            max_tokens: 500,
            temperature: 0.7
          },
          3
        );


        const story = extractAIText(result);


        if (!story) {
          throw new Error(
            "Story generation returned empty content."
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

          error: getErrorMessage(error)

        }, corsHeaders, 500);

      }

    }


    // ==========================================
    // CREATE ASSETS
    // ==========================================

    if (
      (
        url.pathname === "/api/create-assets" ||
        url.pathname === "/api/generate-short"
      ) &&
      request.method === "POST"
    ) {

      try {

        const body = await request.json();

        let story = body.story;


        // ======================================
        // IF NO STORY → CREATE ONE
        // ======================================

        if (!story) {

          const topic =
            body.topic ||
            "A mysterious event that nobody can explain";


          const storyPrompt = `
You are the writer for a viral YouTube Shorts channel called UNKNOWN FILES.

Create a realistic mystery / psychological horror story.

TOPIC:
${topic}

Requirements:

- English
- 45-60 seconds
- 120-150 words
- Extremely strong first sentence
- Realistic
- Cinematic
- Psychological horror
- Hook
- Setup
- Escalation
- Twist
- Open ending
- No emojis
- No title
- No explanations

Return ONLY the story.
`;


          const storyResult = await runWithRetry(
            env,
            "@cf/qwen/qwen3-30b-a3b-fp8",
            {
              messages: [
                {
                  role: "user",
                  content: storyPrompt
                }
              ],
              max_tokens: 500,
              temperature: 0.7
            },
            3
          );


          story = extractAIText(storyResult);


          if (!story) {
            throw new Error(
              "Story generation returned empty content."
            );
          }

        }


        // ======================================
        // 1. CREATE SCENES
        // ======================================

        const scenePrompt = `
You are a professional cinematic storyboard director.

Read this horror story:

${story}

Create EXACTLY 4 visual scenes for a vertical YouTube Short.

CHARACTER CONSISTENCY:

Use the SAME main character in every scene.

Keep consistent:

- age
- gender
- hairstyle
- clothing
- face
- environment
- cinematic visual identity

Each scene must visually continue from the previous scene.

STYLE:

- realistic cinematic photography
- psychological horror
- dark mysterious atmosphere
- realistic human appearance
- dramatic lighting
- shallow depth of field
- cinematic lens
- realistic environment
- vertical composition
- 9:16
- no text
- no subtitles
- no logos
- no watermark

VERY IMPORTANT:

Return ONLY valid JSON.

No markdown.
No code fences.
No explanation.

Use EXACTLY this structure:

{
  "scenes": [
    "scene 1 prompt",
    "scene 2 prompt",
    "scene 3 prompt",
    "scene 4 prompt"
  ]
}
`;


        const sceneResult = await runWithRetry(
          env,
          "@cf/qwen/qwen3-30b-a3b-fp8",
          {
            messages: [
              {
                role: "user",
                content: scenePrompt
              }
            ],
            max_tokens: 1200,
            temperature: 0.15
          },
          3
        );


        const rawSceneText =
          extractAIText(sceneResult);


        if (!rawSceneText) {

          throw new Error(
            "Scene generation returned empty content."
          );

        }


        const scenes =
          parseSceneJSON(rawSceneText);


        if (
          !scenes ||
          !Array.isArray(scenes.scenes) ||
          scenes.scenes.length !== 4
        ) {

          throw new Error(
            "AI did not return exactly 4 valid scenes."
          );

        }


        // ======================================
        // 2. CREATE VOICE
        // ======================================

        const tts = await runWithRetry(
          env,
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
          },
          3
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


        // ======================================
        // 3. GENERATE 4 IMAGES
        // ======================================

        const images = [];


        for (let i = 0; i < 4; i++) {

          const imagePrompt = scenes.scenes[i];


          const imageResult =
            await runWithRetry(
              env,
              "alibaba/qwen-image-3.0-pro",
              {
                prompt: imagePrompt,

                size: "1024x1536",

                n: 1,

                watermark: false,

                prompt_extend: true
              },
              3
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

            prompt: imagePrompt,

            image

          });

        }


        // ======================================
        // 4. SUCCESS
        // ======================================

        return json({

          success: true,

          project: "UNKNOWN FILES",

          status: "ASSETS_READY",

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
            "Assets ready. Next step is automatic MP4 assembly."

        }, corsHeaders);


      } catch (error) {

        return json({

          success: false,

          status: "FAILED",

          error: getErrorMessage(error)

        }, corsHeaders, 500);

      }

    }


    // ==========================================
    // NOT FOUND
    // ==========================================

    return json({

      success: false,

      error: "Not found",

      path: url.pathname

    }, corsHeaders, 404);

  }

};


// ==================================================
// RUN AI WITH RETRIES
// ==================================================

async function runWithRetry(
  env,
  model,
  input,
  maxAttempts = 3
) {

  let lastError = null;


  for (
    let attempt = 1;
    attempt <= maxAttempts;
    attempt++
  ) {

    try {

      const result = await env.AI.run(

        model,

        input,

        {
          gateway: {
            id: "default"
          }
        }

      );


      return result;


    } catch (error) {

      lastError = error;


      const message =
        getErrorMessage(error).toLowerCase();


      const retryable =
        message.includes("7004") ||
        message.includes("upstream") ||
        message.includes("unavailable") ||
        message.includes("timeout") ||
        message.includes("temporarily");


      if (
        !retryable ||
        attempt === maxAttempts
      ) {

        throw error;

      }


      // Exponential backoff:
      // 1.5 sec → 3 sec

      const delay =
        1500 * Math.pow(2, attempt - 1);


      await sleep(delay);

    }

  }


  throw lastError;

}


// ==================================================
// EXTRACT AI TEXT
// ==================================================

function extractAIText(result) {

  if (!result) {
    return "";
  }


  if (typeof result === "string") {
    return result.trim();
  }


  if (
    typeof result.response === "string"
  ) {
    return result.response.trim();
  }


  if (
    typeof result.content === "string"
  ) {
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


    if (
      typeof message.content === "string"
    ) {

      return message.content.trim();

    }


    if (
      typeof message.reasoning_content === "string"
    ) {

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


    if (
      typeof message.content === "string"
    ) {

      return message.content.trim();

    }

  }


  return "";

}


// ==================================================
// SAFE SCENE JSON PARSER
// ==================================================

function parseSceneJSON(text) {

  let cleaned =
    String(text)

      .replace(/```json/gi, "")

      .replace(/```/g, "")

      .trim();


  // -----------------------------------------------
  // Direct JSON
  // -----------------------------------------------

  try {

    const direct =
      JSON.parse(cleaned);


    if (
      direct &&
      Array.isArray(direct.scenes)
    ) {

      return direct;

    }

  } catch (e) {}


  // -----------------------------------------------
  // Extract object
  // -----------------------------------------------

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

    } catch (e) {}

  }


  // -----------------------------------------------
  // Extract array
  // -----------------------------------------------

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

    } catch (e) {}

  }


  // -----------------------------------------------
  // Last resort
  // -----------------------------------------------

  const lines =
    cleaned

      .split("\n")

      .map(x => x.trim())

      .filter(x => x.length > 20);


  if (lines.length >= 4) {

    return {

      scenes:

        lines

          .slice(0, 4)

          .map(x =>

            x

              .replace(
                /^[-*0-9.)]+\s*/,
                ""
              )

              .replace(
                /^["']|["']$/g,
                ""
              )

          )

    };

  }


  throw new Error(

    "Could not parse scene prompts. AI returned: " +

    cleaned.substring(0, 1000)

  );

}


// ==================================================
// ERROR MESSAGE
// ==================================================

function getErrorMessage(error) {

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

    return JSON.stringify(error);

  } catch (e) {

    return String(error);

  }

}


// ==================================================
// SLEEP
// ==================================================

function sleep(ms) {

  return new Promise(
    resolve => setTimeout(resolve, ms)
  );

}


// ==================================================
// JSON RESPONSE
// ==================================================

function json(
  data,
  corsHeaders,
  status = 200
) {

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