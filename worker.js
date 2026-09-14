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

        version: "6.1",

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


        console.log(
          "🧠 Generating story..."
        );


        const result =
          await aiRun(

            env,

            "@cf/qwen/qwen3-30b-a3b-fp8",

            {

              messages: [

                {

                  role: "user",

                  content: prompt

                }

              ],

              max_tokens: 800,

              temperature: 0.7

            }

          );


        const story =
          extractAIText(result);


        if (!story) {

          console.error(
            "❌ Qwen returned no extractable story."
          );

          throw new Error(
            "Story generation returned empty content."
          );

        }


        console.log(
          "✅ Story generated successfully."
        );


        return json({

          success: true,

          topic,

          story

        }, corsHeaders);


      } catch (error) {

        console.error(
          "CREATE STORY ERROR:",
          error
        );


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


          console.log(
            "🧠 Generating story inside create-assets..."
          );


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

                max_tokens: 800,

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

        console.log(
          "🎬 Creating 4 scene prompts..."
        );


        const scenePrompt = `

You are a professional cinematic storyboard director.

Read this mystery story:

${story}

Create EXACTLY 4 visual scenes for a vertical YouTube Short.

Each scene MUST represent a different moment.

The four scenes MUST be visually different.

They MUST have different:

- camera composition
- camera angle
- character pose
- character action
- facial expression
- character position
- environment details
- lighting
- visual event

DO NOT describe the same image four times.

CHARACTER CONSISTENCY:

Use the SAME main character in every scene.

Keep consistent:

- age
- gender
- hairstyle
- clothing
- face
- cinematic visual identity

The character stays the same, BUT the ACTION and COMPOSITION must change significantly.

SCENE PROGRESSION:

Scene 1:
Establish the location and introduce the character.

Scene 2:
Show the mysterious event beginning.

Scene 3:
Show the situation becoming more disturbing.

Scene 4:
Show the twist or final mysterious reveal.

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

Return ONLY valid JSON.

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

              max_tokens: 1400,

              temperature: 0.2

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


        console.log(
          "✅ 4 scene prompts created."
        );


        // ==================================================
        // 3. CREATE VOICE
        // ==================================================

        console.log(
          "🎙️ Generating voice..."
        );


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


        console.log(
          "✅ Voice generated."
        );


        // ==================================================
        // 4. GENERATE 4 DIFFERENT IMAGES
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


          // ==================================================
          // SCENE DIRECTIONS
          // ==================================================

          const sceneDirections = [

            `
SCENE 1 — ESTABLISHING SHOT.

Show the main character entering or standing in the main location.

Use a WIDE cinematic shot.

The environment must be clearly visible.

The character should be relatively small in frame.

This is the beginning of the story.

Create a strong establishing composition.
`,

            `
SCENE 2 — MYSTERIOUS EVENT.

Show the SAME character reacting to the mysterious event.

Use a MEDIUM cinematic shot.

Use a completely different camera angle from Scene 1.

Change the character's pose.

Change the facial expression.

Show a NEW visual event happening.

Do not copy Scene 1 composition.
`,

            `
SCENE 3 — ESCALATION.

Show the SAME character much closer to the disturbing situation.

Use a CLOSE or MEDIUM-CLOSE cinematic shot.

Use a different camera angle.

Change the character's pose.

Change the facial expression.

Add NEW environmental information.

The character should appear more tense.

This must clearly look like a different moment.
`,

            `
SCENE 4 — FINAL REVEAL.

Show the final mysterious reveal or twist.

Use a dramatically different composition.

Use a different camera angle.

Place the character differently in the frame.

Change the action and expression.

Create the strongest and most mysterious image.

This must NOT look like Scene 1, Scene 2, or Scene 3.
`

          ];


          const sceneDirection =
            sceneDirections[i];


          // ==================================================
          // IMAGE PROMPT
          // ==================================================

          const imagePrompt = `

UNKNOWN FILES — SCENE ${i + 1} OF 4.

THIS MUST BE A COMPLETELY NEW IMAGE.

DO NOT REUSE THE COMPOSITION OF ANOTHER SCENE.

DO NOT CREATE A STATIC REPEAT OF THE SAME IMAGE.

STORY SCENE:

${originalScene}

SCENE DIRECTION:

${sceneDirection}

VISUAL CONTINUITY:

The main character must remain visually consistent.

Keep:

- same person
- same face
- same hairstyle
- same clothing
- same general visual identity

BUT THIS FRAME MUST BE VISUALLY DIFFERENT.

Change:

- camera angle
- framing
- character position
- character pose
- facial expression
- action
- background
- lighting emphasis
- visual event

IMPORTANT:

This is Scene ${i + 1}.

The image must look like a different moment in a cinematic sequence.

Vertical 9:16.

Realistic professional photography.

Dark mysterious psychological suspense atmosphere.

Dramatic cinematic lighting.

Shallow depth of field.

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


          console.log(
            "========================================"
          );

          console.log(
            `🎬 GENERATING SCENE ${i + 1}`
          );

          console.log(
            "========================================"
          );


          // ==================================================
          // GENERATE IMAGE
          // ==================================================

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


          console.log(
            `✅ Scene ${i + 1} image generated`
          );

          console.log(
            `📦 Image size: ${base64Image.length} characters`
          );


          images.push({

            scene:
              i + 1,

            prompt:
              originalScene,

            image:
              `data:image/jpeg;base64,${base64Image}`

          });

        }


        // ==================================================
        // 5. SEND IMAGES + AUDIO TO VIDEO CONTAINER
        // ==================================================

        console.log(
          "🎥 Sending 4 images to video container..."
        );


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


        if (
          !videoBuffer ||
          videoBuffer.byteLength === 0
        ) {

          throw new Error(
            "Container returned an empty MP4."
          );

        }


        console.log(
          `🎥 Final MP4 bytes: ${videoBuffer.byteLength}`
        );


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

        console.error(
          "========================================"
        );

        console.error(
          "❌ UNKNOWN FILES ERROR"
        );

        console.error(
          error
        );

        console.error(
          "========================================"
        );


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


    if (

      message.includes("8007") ||

      message.includes("nsfw") ||

      message.includes("input prompt")

    ) {

      console.log(
        "⚠️ Image prompt triggered safety filter."
      );


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

    [/nude/gi, "fully clothed"],

    [/nudity/gi, "fully clothed"],

    [/naked/gi, "fully clothed"],

    [/sexual/gi, "non-romantic"],

    [/sex/gi, "non-romantic"],

    [/erotic/gi, "cinematic"],

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

      console.log(
        `🤖 AI request: ${model} | attempt ${attempt}`
      );


      const result =
        await env.AI.run(

          model,

          input,

          {

            gateway: {

              id: "default"

            }

          }

        );


      console.log(
        `✅ AI request completed: ${model}`
      );


      return result;

    } catch (error) {

      lastError =
        error;


      const message =
        getErrorMessage(
          error
        ).toLowerCase();


      console.error(
        `❌ AI error attempt ${attempt}:`,
        message
      );


      const retryable =

        message.includes("7004") ||

        message.includes("upstream") ||

        message.includes("unavailable") ||

        message.includes("timeout");


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
// EXTRACT AI TEXT - ROBUST VERSION
// ==================================================

function extractAIText(result) {

  console.log(
    "🧠 RAW AI RESULT:",
    JSON.stringify(result)
  );


  if (!result) {

    console.log(
      "❌ AI result is null or undefined."
    );

    return "";

  }


  // ==================================================
  // DIRECT STRING
  // ==================================================

  if (
    typeof result === "string"
  ) {

    return result.trim();

  }


  // ==================================================
  // STANDARD CLOUDFLARE RESPONSE
  // ==================================================

  if (
    typeof result.response === "string"
  ) {

    return result.response.trim();

  }


  // ==================================================
  // NESTED RESPONSE
  // ==================================================

  if (
    result.result &&
    typeof result.result.response === "string"
  ) {

    return result.result.response.trim();

  }


  // ==================================================
  // CONTENT
  // ==================================================

  if (
    typeof result.content === "string"
  ) {

    return result.content.trim();

  }


  if (
    result.result &&
    typeof result.result.content === "string"
  ) {

    return result.result.content.trim();

  }


  // ==================================================
  // OPENAI STYLE
  // ==================================================

  if (
    Array.isArray(result.choices) &&
    result.choices.length > 0
  ) {

    const choice =
      result.choices[0];


    if (
      choice.message &&
      typeof choice.message.content === "string"
    ) {

      return choice.message.content.trim();

    }


    if (
      typeof choice.text === "string"
    ) {

      return choice.text.trim();

    }

  }


  // ==================================================
  // NESTED OPENAI STYLE
  // ==================================================

  if (
    result.result &&
    Array.isArray(result.result.choices) &&
    result.result.choices.length > 0
  ) {

    const choice =
      result.result.choices[0];


    if (
      choice.message &&
      typeof choice.message.content === "string"
    ) {

      return choice.message.content.trim();

    }


    if (
      typeof choice.text === "string"
    ) {

      return choice.text.trim();

    }

  }


  // ==================================================
  // REASONING CONTENT
  // ==================================================

  if (
    typeof result.reasoning_content === "string"
  ) {

    return result.reasoning_content.trim();

  }


  if (
    result.result &&
    typeof result.result.reasoning_content === "string"
  ) {

    return result.result.reasoning_content.trim();

  }


  // ==================================================
  // LAST RESORT
  // ==================================================

  console.log(
    "❌ Could not extract text from AI response."
  );


  console.log(
    "❌ AI RESULT KEYS:",
    Object.keys(result)
  );


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