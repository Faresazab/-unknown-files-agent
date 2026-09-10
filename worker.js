import { Container, getContainer } from "@cloudflare/containers";


// ==================================================
// VIDEO CONTAINER
// ==================================================

export class VideoContainer extends Container {

  defaultPort = 8080;

  sleepAfter = "10m";

}


// ==================================================
// WORKER
// ==================================================

var worker_default = {

  async fetch(request, env) {

    const url = new URL(request.url);

    const corsHeaders = {

      "Access-Control-Allow-Origin": "*",

      "Access-Control-Allow-Methods":
        "GET, POST, OPTIONS",

      "Access-Control-Allow-Headers":
        "Content-Type"

    };


    if (request.method === "OPTIONS") {

      return new Response(null, {

        status: 204,

        headers: corsHeaders

      });

    }


    // ==================================================
    // HOME
    // ==================================================

    if (
      url.pathname === "/" &&
      request.method === "GET"
    ) {

      return json({

        status: "ONLINE",

        agent: "UNKNOWN FILES",

        version: "5.1",

        image_model:
          "@cf/black-forest-labs/flux-1-schnell",

        video_engine:
          "Cloudflare Container + FFmpeg",

        endpoints: [

          "POST /api/create-story",

          "POST /api/create-assets",

          "POST /api/generate-short"

        ]

      }, corsHeaders);

    }


    // ==================================================
    // CREATE STORY
    // ==================================================

    if (
      url.pathname === "/api/create-story" &&
      request.method === "POST"
    ) {

      try {

        const body =
          await request.json();

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
- Keep the horror non-graphic
- No explicit violence
- No sexual content

Return ONLY the story.

`;


        const result = await aiRun(

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

          }

        );


        const story =
          extractAIText(result);


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

          error:
            getErrorMessage(error)

        }, corsHeaders, 500);

      }

    }


    // ==================================================
    // CREATE ASSETS + GENERATE MP4
    // ==================================================

    if (

      (
        url.pathname === "/api/create-assets" ||
        url.pathname === "/api/generate-short"
      )

      &&

      request.method === "POST"

    ) {

      try {

        const body =
          await request.json();


        let story =
          body.story;


        // ==================================================
        // 1. CREATE STORY IF NEEDED
        // ==================================================

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
- No bullet points
- Keep the horror non-graphic
- No explicit violence
- No sexual content

Return ONLY the story.

`;


          const storyResult =
            await aiRun(

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

              }

            );


          story =
            extractAIText(
              storyResult
            );


          if (!story) {

            throw new Error(
              "Story generation returned empty content."
            );

          }

        }


        // ==================================================
        // 2. CREATE 4 SCENES
        // ==================================================

        const scenePrompt = `

You are a professional cinematic storyboard director.

Read this mystery story:

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

Keep strong visual continuity between scenes.

STYLE:

- realistic cinematic photography
- psychological suspense
- mysterious atmosphere
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
- non-graphic horror
- no explicit violence
- no blood
- no gore
- no sexual content
- no nudity

VERY IMPORTANT:

Return ONLY valid JSON.

No markdown.
No code fences.
No explanation.

Use EXACTLY:

{
  "scenes": [
    "scene 1 prompt",
    "scene 2 prompt",
    "scene 3 prompt",
    "scene 4 prompt"
  ]
}

`;


        const sceneResult =
          await aiRun(

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

            }

          );


        const rawSceneText =
          extractAIText(
            sceneResult
          );


        if (!rawSceneText) {

          throw new Error(
            "Scene generation returned empty content."
          );

        }


        const scenes =
          parseSceneJSON(
            rawSceneText
          );


        if (

          !scenes ||

          !Array.isArray(
            scenes.scenes
          ) ||

          scenes.scenes.length !== 4

        ) {

          throw new Error(
            "AI did not return exactly 4 valid scenes."
          );

        }


        // ==================================================
        // 3. CREATE VOICE
        // ==================================================

        const tts =
          await aiRun(

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


        // ==================================================
        // 4. GENERATE 4 IMAGES
        // ==================================================

        const images = [];


        for (
          let i = 0;
          i < 4;
          i++
        ) {

          const originalScene =
            String(
              scenes.scenes[i]
            );


          const imagePrompt = `

${originalScene}

IMPORTANT IMAGE REQUIREMENTS:

Vertical cinematic composition.

Portrait 9:16 feeling.

Realistic professional photography.

Dark mysterious psychological suspense atmosphere.

Keep the same main character and visual identity
as the other scenes.

No text.

No subtitles.

No logos.

No watermark.

Non-graphic horror.

No explicit violence.

No blood.

No gore.

No nudity.

No sexual content.

`;


          const imageResult =
            await generateSafeImage(

              env,

              imagePrompt

            );


          const base64Image =

            imageResult?.image ||

            imageResult?.result?.image ||

            null;


          if (!base64Image) {

            throw new Error(

              `FLUX image generation failed for scene ${i + 1}.`

            );

          }


          images.push({

            scene: i + 1,

            prompt:
              originalScene,

            image:
              `data:image/jpeg;base64,${base64Image}`

          });

        }


        // ==================================================
        // 5. SEND IMAGES + AUDIO TO FFMPEG CONTAINER
        // ==================================================

        const container =

          getContainer(

            env.VIDEO_CONTAINER,

            "unknown-files-main"

          );


        const renderRequest =

          new Request(

            "http://video/render",

            {

              method: "POST",

              headers: {

                "Content-Type":
                  "application/json"

              },

              body:
                JSON.stringify({

                  images:
                    images.map(
                      item => item.image
                    ),

                  audio

                })

            }

          );


        const renderResponse =

          await container.fetch(
            renderRequest
          );


        if (!renderResponse.ok) {

          const errorText =
            await renderResponse.text();


          throw new Error(

            "MP4 rendering failed: " +
            errorText

          );

        }


        // ==================================================
        // 6. GET MP4
        // ==================================================

        const videoBuffer =
          await renderResponse.arrayBuffer();


        const videoBase64 =
          arrayBufferToBase64(
            videoBuffer
          );


        // ==================================================
        // 7. FINAL RESPONSE
        // ==================================================

        return json({

          success: true,

          status:
            "SHORT_CREATED",

          project:
            "UNKNOWN FILES",

          duration:
            "45-60 seconds",

          story,

          audio: {

            model:
              "xai/grok-tts",

            voice:
              "leo",

            url:
              audio

          },

          scenes:
            scenes.scenes,

          images,

          video: {

            filename:
              "UNKNOWN_FILES.mp4",

            mime_type:
              "video/mp4",

            base64:
              videoBase64

          },

          image_model:
            "@cf/black-forest-labs/flux-1-schnell",

          video_model:
            "FFmpeg",

          next_step:
            "Short successfully rendered."

        }, corsHeaders);


      } catch (error) {

        return json({

          success: false,

          status:
            "FAILED",

          error:
            getErrorMessage(error)

        }, corsHeaders, 500);

      }

    }


    // ==================================================
    // NOT FOUND
    // ==================================================

    return json({

      success: false,

      error:
        "Not found",

      path:
        url.pathname

    }, corsHeaders, 404);

  }

};


// ==================================================
// SAFE IMAGE GENERATION
// ==================================================

async function generateSafeImage(
  env,
  prompt
) {

  try {

    return await aiRun(

      env,

      "@cf/black-forest-labs/flux-1-schnell",

      {

        prompt,

        steps: 6

      }

    );

  } catch (error) {

    const message =
      getErrorMessage(
        error
      ).toLowerCase();


    // If FLUX safety filter blocks the prompt,
    // create a safer visual version and retry once.

    if (

      message.includes("8007") ||

      message.includes("nsfw") ||

      message.includes("input prompt")

    ) {

      const safePrompt =
        sanitizeImagePrompt(
          prompt
        );


      return await aiRun(

        env,

        "@cf/black-forest-labs/flux-1-schnell",

        {

          prompt:
            safePrompt,

          steps: 6

        }

      );

    }


    throw error;

  }

}


// ==================================================
// SANITIZE IMAGE PROMPT
// ==================================================

function sanitizeImagePrompt(
  prompt
) {

  let safe =
    String(prompt);


  const replacements = [

    // Violence

    [/blood/gi, "dark red lighting"],

    [/bloody/gi, "dark dramatic lighting"],

    [/gore/gi, "dramatic suspense"],

    [/gory/gi, "dramatic suspense"],

    [/corpse/gi, "empty room"],

    [/dead body/gi, "empty room"],

    [/dead person/gi, "empty room"],

    [/murder/gi, "mysterious incident"],

    [/killed/gi, "disappeared"],

    [/kill/gi, "disappear"],

    [/suicide/gi, "disturbing event"],

    [/self-harm/gi, "disturbing event"],

    [/stabbed/gi, "suddenly disappeared"],

    [/stabbing/gi, "disturbing movement"],

    [/weapon/gi, "mysterious object"],

    [/gun/gi, "mysterious object"],

    [/knife/gi, "metallic object"],


    // Sexual content

    [/nude/gi, "fully clothed"],

    [/nudity/gi, "fully clothed"],

    [/naked/gi, "fully clothed"],

    [/sexual/gi, "non-romantic"],

    [/sex/gi, "non-romantic"],

    [/erotic/gi, "cinematic"],


    // Other potentially sensitive terms

    [/torture/gi, "psychological tension"],

    [/abuse/gi, "disturbing situation"],

    [/assault/gi, "confrontation"],

    [/violent/gi, "intense"],

    [/violence/gi, "psychological tension"]

  ];


  for (
    const [pattern, replacement]
    of replacements
  ) {

    safe =
      safe.replace(
        pattern,
        replacement
      );

  }


  return `

Realistic cinematic psychological mystery scene.

${safe}

VISUAL SAFETY REQUIREMENTS:

Adult characters only.

Fully clothed.

Non-graphic psychological suspense.

No blood.

No gore.

No wounds.

No corpses.

No weapons.

No sexual content.

No nudity.

No explicit violence.

No disturbing graphic imagery.

Dark cinematic atmosphere.

Professional realistic photography.

Dramatic lighting.

Shallow depth of field.

Vertical 9:16 composition.

No text.

No subtitles.

No logos.

No watermark.

`;

}


// ==================================================
// AI RUN
// ==================================================

async function aiRun(
  env,
  model,
  input
) {

  let lastError = null;


  for (
    let attempt = 1;
    attempt <= 3;
    attempt++
  ) {

    try {

      return await env.AI.run(

        model,

        input,

        {

          gateway: {

            id: "default"

          }

        }

      );

    } catch (error) {

      lastError =
        error;


      const message =
        getErrorMessage(
          error
        ).toLowerCase();


      const retryable =

        message.includes("7004") ||

        message.includes(
          "upstream"
        ) ||

        message.includes(
          "unavailable"
        ) ||

        message.includes(
          "timeout"
        );


      if (
        !retryable ||
        attempt === 3
      ) {

        throw error;

      }


      await sleep(

        attempt === 1
          ? 1500
          : 3000

      );

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


  if (
    typeof result === "string"
  ) {

    return result.trim();

  }


  if (
    typeof result.response ===
    "string"
  ) {

    return result.response.trim();

  }


  if (
    typeof result.content ===
    "string"
  ) {

    return result.content.trim();

  }


  if (

    result.result &&

    typeof result.result.response ===
    "string"

  ) {

    return result.result.response.trim();

  }


  if (

    result.result &&

    typeof result.result.content ===
    "string"

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
      typeof message.content ===
      "string"
    ) {

      return message.content.trim();

    }


    if (
      typeof message.reasoning_content ===
      "string"
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
      typeof message.content ===
      "string"
    ) {

      return message.content.trim();

    }

  }


  return "";

}


// ==================================================
// SCENE JSON PARSER
// ==================================================

function parseSceneJSON(text) {

  let cleaned =

    String(text)

      .replace(
        /```json/gi,
        ""
      )

      .replace(
        /```/g,
        ""
      )

      .trim();


  // Direct JSON

  try {

    const direct =
      JSON.parse(cleaned);


    if (

      direct &&

      Array.isArray(
        direct.scenes
      )

    ) {

      return direct;

    }

  } catch (e) {}


  // Object extraction

  const firstBrace =
    cleaned.indexOf("{");

  const lastBrace =
    cleaned.lastIndexOf("}");


  if (

    firstBrace !== -1 &&

    lastBrace !== -1

  ) {

    try {

      const parsed =

        JSON.parse(

          cleaned.substring(

            firstBrace,

            lastBrace + 1

          )

        );


      if (

        parsed &&

        Array.isArray(
          parsed.scenes
        )

      ) {

        return parsed;

      }

    } catch (e) {}

  }


  // Array extraction

  const firstBracket =
    cleaned.indexOf("[");

  const lastBracket =
    cleaned.lastIndexOf("]");


  if (

    firstBracket !== -1 &&

    lastBracket !== -1

  ) {

    try {

      const array =

        JSON.parse(

          cleaned.substring(

            firstBracket,

            lastBracket + 1

          )

        );


      if (

        Array.isArray(array) &&

        array.length === 4

      ) {

        return {

          scenes:
            array

        };

      }

    } catch (e) {}

  }


  // Last resort

  const lines =

    cleaned

      .split("\n")

      .map(
        x => x.trim()
      )

      .filter(
        x => x.length > 20
      );


  if (
    lines.length >= 4
  ) {

    return {

      scenes:

        lines

          .slice(0, 4)

          .map(

            x =>

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

    cleaned.substring(
      0,
      1000
    )

  );

}


// ==================================================
// ARRAY BUFFER → BASE64
// ==================================================

function arrayBufferToBase64(
  buffer
) {

  const bytes =
    new Uint8Array(buffer);


  let binary = "";


  const chunkSize =
    0x8000;


  for (

    let i = 0;

    i < bytes.length;

    i += chunkSize

  ) {

    binary +=

      String.fromCharCode(

        ...bytes.subarray(

          i,

          Math.min(
            i + chunkSize,
            bytes.length
          )

        )

      );

  }


  return btoa(binary);

}


// ==================================================
// ERROR
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

    return String(error);

  }

}


// ==================================================
// SLEEP
// ==================================================

function sleep(ms) {

  return new Promise(
    resolve =>
      setTimeout(
        resolve,
        ms
      )
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


// ==================================================
// EXPORT
// ==================================================

export default worker_default;