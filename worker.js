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
    // HOME
    // =========================

    if (url.pathname === "/" && request.method === "GET") {
      return new Response(
        "AI Story Agent is running.",
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "text/plain; charset=utf-8",
          },
        }
      );
    }

    // =========================
    // CREATE STORY
    // =========================

    if (
      url.pathname === "/api/create-story" &&
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
          typeof body.prompt === "string" && body.prompt.trim()
            ? body.prompt.trim()
            : `
Create one original YouTube Shorts mystery story.

Genre:
realistic mystery + psychological horror.

Length:
45-60 seconds.

Language:
English.

Structure:
Hook → Setup → Escalation → Twist → Open Ending.

The story must be completely original.

Do not claim that fictional events are real.

Make the first sentence extremely strong.

Return:
TITLE:
SCRIPT:
SCENES:
VISUAL PROMPTS:
VOICE DIRECTION:
`;

        // =========================
        // AI
        // =========================

        const aiResponse = await env.AI.run(
          "@cf/qwen/qwen3-30b-a3b-fp8",
          {
            prompt: userPrompt,
            max_tokens: 500,
            temperature: 0.7,
          }
        );

        // =========================
        // GET GENERATED TEXT
        // =========================

        let story = "";

        if (typeof aiResponse === "string") {
          story = aiResponse;
        } else if (
          aiResponse &&
          typeof aiResponse.response === "string"
        ) {
          story = aiResponse.response;
        } else if (
          aiResponse &&
          aiResponse.result &&
          typeof aiResponse.result.response === "string"
        ) {
          story = aiResponse.result.response;
        }

        story = story.trim();

        // =========================
        // EMPTY RESPONSE
        // =========================

        if (!story) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "Qwen3 returned an empty response.",
              debug: aiResponse ?? null,
            }),
            {
              status: 502,
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
              },
            }
          );
        }

        // =========================
        // SAVE TO KV
        // =========================

        const id =
          Date.now().toString() +
          "-" +
          Math.random().toString(36).slice(2, 8);

        const storyData = {
          id,
          prompt: userPrompt,
          story,
          createdAt: new Date().toISOString(),
        };

        if (env.STORIES) {
          await env.STORIES.put(
            id,
            JSON.stringify(storyData)
          );
        }

        // =========================
        // RESPONSE
        // =========================

        return new Response(
          JSON.stringify({
            success: true,
            story,
            id,
            createdAt: storyData.createdAt,
          }),
          {
            status: 200,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );

      } catch (error) {
        console.error("CREATE STORY ERROR:", error);

        return new Response(
          JSON.stringify({
            success: false,
            error: "Failed to create story.",
            message:
              error instanceof Error
                ? error.message
                : String(error),
          }),
          {
            status: 500,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }
    }

    // =========================
    // STORIES
    // =========================

    if (
      url.pathname === "/api/stories" &&
      request.method === "GET"
    ) {
      try {
        if (!env.STORIES) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "STORIES KV binding is missing.",
            }),
            {
              status: 500,
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
              },
            }
          );
        }

        const list = await env.STORIES.list();

        const stories = [];

        for (const key of list.keys) {
          const value = await env.STORIES.get(key.name);

          if (value) {
            try {
              stories.push(JSON.parse(value));
            } catch {
              // Ignore invalid entries
            }
          }
        }

        stories.sort((a, b) => {
          return String(b.createdAt || "").localeCompare(
            String(a.createdAt || "")
          );
        });

        return new Response(
          JSON.stringify({
            success: true,
            stories,
          }),
          {
            status: 200,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );

      } catch (error) {
        console.error("GET STORIES ERROR:", error);

        return new Response(
          JSON.stringify({
            success: false,
            error: "Failed to load stories.",
            message:
              error instanceof Error
                ? error.message
                : String(error),
          }),
          {
            status: 500,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }
    }

    // =========================
    // 404
    // =========================

    return new Response(
      JSON.stringify({
        success: false,
        error: "Not found.",
      }),
      {
        status: 404,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  },
};