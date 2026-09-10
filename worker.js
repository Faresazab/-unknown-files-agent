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
      return new Response(
        JSON.stringify({
          status: "OK",
          worker: "unknown-files-agent1",
          tests: {
            text: "/api/test-text",
            tts: "/api/test-tts",
            image: "/api/test-image"
          }
        }, null, 2),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        }
      );
    }

    // =========================
    // TEST TEXT ONLY
    // =========================
    if (url.pathname === "/api/test-text" && request.method === "GET") {
      try {
        const result = await env.AI.run(
          "@cf/qwen/qwen3-30b-a3b-fp8",
          {
            messages: [
              {
                role: "user",
                content: "Reply with exactly: OK"
              }
            ],
            max_tokens: 50
          }
        );

        return new Response(
          JSON.stringify({
            success: true,
            model: "qwen3-30b-a3b-fp8",
            result
          }, null, 2),
          {
            status: 200,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json"
            }
          }
        );

      } catch (error) {
        return new Response(
          JSON.stringify({
            success: false,
            model: "qwen3-30b-a3b-fp8",
            error: error instanceof Error
              ? error.message
              : String(error)
          }, null, 2),
          {
            status: 500,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json"
            }
          }
        );
      }
    }

    // =========================
    // TEST GROK TTS ONLY
    // =========================
    if (url.pathname === "/api/test-tts" && request.method === "GET") {
      try {
        const result = await env.AI.run(
          "xai/grok-tts",
          {
            text: "This is a test of the UNKNOWN FILES voice system.",
            language: "en",
            voice_id: "leo"
          }
        );

        return new Response(
          JSON.stringify({
            success: true,
            model: "xai/grok-tts",
            hasAudio: !!(
              result &&
              result.audio
            ),
            audio: result?.audio || null
          }, null, 2),
          {
            status: 200,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json"
            }
          }
        );

      } catch (error) {
        return new Response(
          JSON.stringify({
            success: false,
            model: "xai/grok-tts",
            error: error instanceof Error
              ? error.message
              : String(error)
          }, null, 2),
          {
            status: 500,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json"
            }
          }
        );
      }
    }

    // =========================
    // TEST IMAGE ONLY
    // =========================
    if (url.pathname === "/api/test-image" && request.method === "GET") {
      try {
        const result = await env.AI.run(
          "alibaba/qwen-image-3.0-pro",
          {
            prompt:
              "A cinematic realistic photograph of an empty dark hallway at night, mysterious psychological horror atmosphere, vertical composition",
            size: "1024x1536",
            n: 1,
            watermark: false
          }
        );

        return new Response(
          JSON.stringify({
            success: true,
            model: "alibaba/qwen-image-3.0-pro",
            hasImage: !!(
              result &&
              result.images &&
              result.images[0]
            ),
            image: result?.images?.[0] || null
          }, null, 2),
          {
            status: 200,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json"
            }
          }
        );

      } catch (error) {
        return new Response(
          JSON.stringify({
            success: false,
            model: "alibaba/qwen-image-3.0-pro",
            error: error instanceof Error
              ? error.message
              : String(error)
          }, null, 2),
          {
            status: 500,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json"
            }
          }
        );
      }
    }

    // =========================
    // NOT FOUND
    // =========================
    return new Response(
      JSON.stringify({
        error: "Not found",
        path: url.pathname
      }),
      {
        status: 404,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      }
    );
  }
};

export {
  worker_default as default
};