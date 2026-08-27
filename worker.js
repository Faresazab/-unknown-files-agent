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

    if (url.pathname === "/" && request.method === "GET") {
      return new Response("AI Story Agent is running.", {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }

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

        const prompt = `
Create ONE original YouTube Shorts mystery story.

IMPORTANT:
Do NOT explain your reasoning.
Do NOT describe your thinking process.
Do NOT say "let me think".
Do NOT provide analysis.
Return ONLY the final answer.

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

Return EXACTLY this format:

TITLE:
[short catchy title]

SCRIPT:
[the complete 45-60 second narration]

SCENES:
1. [scene description]
2. [scene description]
3. [scene description]
4. [scene description]
5. [scene description]

VISUAL PROMPTS:
1. [AI image/video prompt]
2. [AI image/video prompt]
3. [AI image/video prompt]
4. [AI image/video prompt]
5. [AI image/video prompt]

VOICE DIRECTION:
[tone, pacing and emotion]

USER REQUEST:
${body.prompt || "Create today's mystery short."}
`;

        const result = await env.AI.run(
          "@cf/qwen/qwen3-30b-a3b-fp8",
          {
            prompt: prompt,
            max_tokens: 800,
            temperature: 0.7,
          }
        );

        let story = "";

        if (result && typeof result.response === "string") {
          story = result.response;
        } else if (typeof result === "string") {
          story = result;
        }

        story = story.trim();

        if (!story) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "Qwen3 returned an empty response.",
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

        // Remove accidental reasoning if the model includes it
        const markers = [
          "Final answer:",
          "FINAL ANSWER:",
          "Here is the final answer:",
        ];

        for (const marker of markers) {
          const index = story.indexOf(marker);

          if (index !== -1) {
            story = story
              .slice(index + marker.length)
              .trim();

            break;
          }
        }

        const id =
          Date.now().toString() +
          "-" +
          Math.random().toString(36).slice(2, 8);

        const storyData = {
          id,
          story,
          createdAt: new Date().toISOString(),
        };

        if (env.STORIES) {
          await env.STORIES.put(
            id,
            JSON.stringify(storyData)
          );
        }

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
        console.error(error);

        return new Response(
          JSON.stringify({
            success: false,
            error: "AI generation failed.",
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

    return new Response(
      JSON.stringify({
        success: false,
        error: "Not found",
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