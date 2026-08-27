export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // =========================
    // HEALTH CHECK
    // =========================

    if (url.pathname === "/" && request.method === "GET") {
      return new Response("AI Video Agent is running.", {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }

    // =========================
    // CREATE VIDEO
    // =========================

    if (
      url.pathname === "/api/create-video" &&
      request.method === "POST"
    ) {
      try {
        let body = {};

        try {
          body = await request.json();
        } catch {
          body = {};
        }

        const userPrompt =
          body.prompt ||
          "Create today's original mystery YouTube Short.";

        // =========================
        // 1. GENERATE STORY
        // =========================

        const storyPrompt = `
Create ONE original YouTube Shorts mystery story.

Genre:
Realistic mystery + psychological horror.

Length:
45-60 seconds.

Language:
English.

Structure:
Hook → Setup → Escalation → Twist → Open Ending.

The first sentence must be extremely strong.

The story must be completely original.
Do not present fictional events as real.

Return ONLY the final content.

Use EXACTLY this format:

TITLE:
[title]

SCRIPT:
[45-60 second narration]

SCENES:
1. [scene description]
2. [scene description]
3. [scene description]
4. [scene description]
5. [scene description]

VISUAL PROMPTS:
1. [detailed cinematic image prompt]
2. [detailed cinematic image prompt]
3. [detailed cinematic image prompt]
4. [detailed cinematic image prompt]
5. [detailed cinematic image prompt]

VOICE DIRECTION:
[voice direction]

USER REQUEST:
${userPrompt}
`;

        const storyResult = await env.AI.run(
          "@cf/qwen/qwen3-30b-a3b-fp8",
          {
            messages: [
              {
                role: "system",
                content:
                  "You are a professional YouTube Shorts writer. " +
                  "Do not reveal reasoning. " +
                  "Return only the final requested content."
              },
              {
                role: "user",
                content: storyPrompt
              }
            ],
            max_tokens: 1400,
            temperature: 0.7,
            top_p: 0.9
          }
        );

        let story = "";

        if (
          storyResult &&
          typeof storyResult.response === "string"
        ) {
          story = storyResult.response;
        } else if (typeof storyResult === "string") {
          story = storyResult;
        }

        story = story.trim();

        if (!story) {
          throw new Error(
            "Qwen3 returned an empty story."
          );
        }

        // =========================
        // REMOVE REASONING
        // =========================

        const reasoningMarkers = [
          "Final answer:",
          "FINAL ANSWER:",
          "Here is the final answer:"
        ];

        for (const marker of reasoningMarkers) {
          const index = story.indexOf(marker);

          if (index !== -1) {
            story = story
              .slice(index + marker.length)
              .trim();

            break;
          }
        }

        // =========================
        // PARSE SECTIONS
        // =========================

        function extractSection(text, name, nextNames) {
          const start =
            text.indexOf(name);

          if (start === -1) return "";

          const contentStart =
            start + name.length;

          let end = text.length;

          for (const next of nextNames) {
            const nextIndex =
              text.indexOf(next, contentStart);

            if (
              nextIndex !== -1 &&
              nextIndex < end
            ) {
              end = nextIndex;
            }
          }

          return text
            .slice(contentStart, end)
            .trim();
        }

        const script = extractSection(
          story,
          "SCRIPT:",
          ["SCENES:", "VISUAL PROMPTS:", "VOICE DIRECTION:"]
        );

        const scenesText = extractSection(
          story,
          "SCENES:",
          ["VISUAL PROMPTS:", "VOICE DIRECTION:"]
        );

        const visualText = extractSection(
          story,
          "VISUAL PROMPTS:",
          ["VOICE DIRECTION:"]
        );

        const title = extractSection(
          story,
          "TITLE:",
          ["SCRIPT:", "SCENES:"]
        );

        // =========================
        // PARSE NUMBERED ITEMS
        // =========================

        function parseNumberedList(text) {
          return text
            .split(/\n(?=\s*\d+\.)/)
            .map(item =>
              item
                .replace(/^\s*\d+\.\s*/, "")
                .trim()
            )
            .filter(Boolean);
        }

        let scenes =
          parseNumberedList(scenesText);

        let visualPrompts =
          parseNumberedList(visualText);

        // Safety fallback
        if (scenes.length < 5) {
          scenes = [
            "A mysterious woman discovering something disturbing in a dark apartment.",
            "The woman examining a strange clue under dim cinematic lighting.",
            "A dark hallway with an unsettling shadow in the distance.",
            "The woman confronting the mysterious discovery in a distorted mirror.",
            "A final disturbing image suggesting that reality may not be what it seems."
          ];
        }

        if (visualPrompts.length < 5) {
          visualPrompts = scenes;
        }

        scenes = scenes.slice(0, 5);
        visualPrompts = visualPrompts.slice(0, 5);

        // =========================
        // 2. GENERATE 5 IMAGES
        // =========================

        const imageResults =
          await Promise.all(
            visualPrompts.map(async (visualPrompt, index) => {

              const enhancedPrompt = `
Vertical cinematic YouTube Shorts frame.

9:16 composition.

Realistic psychological horror.
Dark cinematic lighting.
Photorealistic.
Film still.
High detail.
Strong atmosphere.
No text.
No captions.
No logos.
No watermark.

Scene ${index + 1}:

${visualPrompt}
`;

              const imageResult =
                await env.AI.run(
                  "alibaba/qwen-image-3.0-pro",
                  {
                    prompt: enhancedPrompt,
                    size: "1024x1536",
                    n: 1,
                    watermark: false,
                    prompt_extend: true
                  }
                );

              if (
                !imageResult ||
                !imageResult.images ||
                !imageResult.images[0]
              ) {
                throw new Error(
                  `Image ${index + 1} generation failed.`
                );
              }

              return imageResult.images[0];
            })
          );

        // =========================
        // 3. GENERATE VOICE
        // =========================

        if (!script) {
          throw new Error(
            "Could not extract the script from Qwen3."
          );
        }

        const voiceResult =
          await env.AI.run(
            "xai/grok-tts",
            {
              text: script,
              language: "en",
              voice_id: "leo",
              text_normalization: true
            }
          );

        const audioUrl =
          voiceResult &&
          voiceResult.audio;

        if (!audioUrl) {
          throw new Error(
            "Grok TTS did not return an audio URL."
          );
        }

        // =========================
        // 4. CREATE CREATOMATE RENDER
        // =========================

        const elements = [];

        // Five scenes, 12 seconds each = 60 seconds
        for (let i = 0; i < imageResults.length; i++) {

          elements.push({
            type: "image",
            source: imageResults[i],
            track: 1,
            duration: 12,
            fit: "cover"
          });
        }

        // Voice over
        elements.push({
          type: "audio",
          source: audioUrl,
          track: 2,
          time: 0
        });

        const renderScript = {
          output_format: "mp4",
          width: 720,
          height: 1280,
          duration: 60,
          frame_rate: 30,
          elements
        };

        const renderResponse =
          await fetch(
            "https://api.creatomate.com/v2/renders",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization":
                  `Bearer ${env.CREATOMATE_API_KEY}`
              },
              body: JSON.stringify(
                renderScript
              )
            }
          );

        const renderData =
          await renderResponse.json();

        if (!renderResponse.ok) {
          console.error(
            "CREATOMATE ERROR:",
            renderData
          );

          throw new Error(
            renderData?.message ||
            renderData?.error ||
            "Creatomate render failed."
          );
        }

        const renderId =
          renderData.id ||
          renderData.render_id;

        if (!renderId) {
          throw new Error(
            "Creatomate did not return a render ID."
          );
        }

        // =========================
        // SAVE JOB
        // =========================

        const job = {
          id: renderId,
          status: "rendering",
          title,
          script,
          scenes,
          visualPrompts,
          images: imageResults,
          audio: audioUrl,
          createdAt:
            new Date().toISOString()
        };

        if (env.STORIES) {
          await env.STORIES.put(
            `video:${renderId}`,
            JSON.stringify(job)
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            status: "rendering",
            renderId,
            title,
            message:
              "Video generation started."
          }),
          {
            status: 202,
            headers: {
              ...corsHeaders,
              "Content-Type":
                "application/json"
            }
          }
        );

      } catch (error) {

        console.error(
          "CREATE VIDEO ERROR:",
          error
        );

        return new Response(
          JSON.stringify({
            success: false,
            error:
              error instanceof Error
                ? error.message
                : String(error)
          }),
          {
            status: 500,
            headers: {
              ...corsHeaders,
              "Content-Type":
                "application/json"
            }
          }
        );
      }
    }

    // =========================
    // VIDEO STATUS
    // =========================

    if (
      url.pathname === "/api/video-status" &&
      request.method === "GET"
    ) {
      try {

        const renderId =
          url.searchParams.get("id");

        if (!renderId) {
          return new Response(
            JSON.stringify({
              success: false,
              error:
                "Missing render ID."
            }),
            {
              status: 400,
              headers: {
                ...corsHeaders,
                "Content-Type":
                  "application/json"
              }
            }
          );
        }

        const renderResponse =
          await fetch(
            `https://api.creatomate.com/v2/renders/${renderId}`,
            {
              headers: {
                "Authorization":
                  `Bearer ${env.CREATOMATE_API_KEY}`
              }
            }
          );

        const render =
          await renderResponse.json();

        if (!renderResponse.ok) {
          throw new Error(
            render?.message ||
            "Could not check render status."
          );
        }

        const status =
          render.status ||
          "unknown";

        let videoUrl =
          render.url ||
          render.output_url ||
          null;

        if (
          env.STORIES &&
          (status === "succeeded" ||
           status === "failed")
        ) {

          const key =
            `video:${renderId}`;

          const saved =
            await env.STORIES.get(key);

          if (saved) {

            const job =
              JSON.parse(saved);

            job.status = status;

            if (videoUrl) {
              job.videoUrl =
                videoUrl;
            }

            await env.STORIES.put(
              key,
              JSON.stringify(job)
            );
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            status,
            videoUrl,
            render
          }),
          {
            status: 200,
            headers: {
              ...corsHeaders,
              "Content-Type":
                "application/json"
            }
          }
        );

      } catch (error) {

        console.error(
          "VIDEO STATUS ERROR:",
          error
        );

        return new Response(
          JSON.stringify({
            success: false,
            error:
              error instanceof Error
                ? error.message
                : String(error)
          }),
          {
            status: 500,
            headers: {
              ...corsHeaders,
              "Content-Type":
                "application/json"
            }
          }
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: "Not found"
      }),
      {
        status: 404,
        headers: {
          ...corsHeaders,
          "Content-Type":
            "application/json"
        }
      }
    );
  }
};