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

    // Home
    if (url.pathname === "/" && request.method === "GET") {
      return new Response("AI MODEL TESTER", {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/plain"
        }
      });
    }

    // Test all AI models
    if (url.pathname === "/api/test-models" && request.method === "POST") {
      const results = {};

      // =========================
      // 1. QWEN 3 - TEXT
      // =========================
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
            max_tokens: 20
          }
        );

        results.qwen3 = {
          success: true,
          result: result
        };

      } catch (error) {
        results.qwen3 = {
          success: false,
          error: error instanceof Error
            ? error.message
            : String(error)
        };
      }

      // =========================
      // 2. QWEN IMAGE
      // =========================
      try {
        const result = await env.AI.run(
          "alibaba/qwen-image-3.0-pro",
          {
            prompt: "A cinematic photograph of an empty dark hallway at night",
            size: "1024x1536",
            n: 1,
            watermark: false
          }
        );

        results.qwenImage = {
          success: true,
          hasImage: !!(
            result &&
            result.images &&
            result.images[0]
          )
        };

      } catch (error) {
        results.qwenImage = {
          success: false,
          error: error instanceof Error
            ? error.message
            : String(error)
        };
      }

      // =========================
      // 3. GROK TTS
      // =========================
      try {
        const result = await env.AI.run(
          "xai/grok-tts",
          {
            text: "This is a test of the AI voice system.",
            language: "en",
            voice_id: "leo"
          }
        );

        results.grokTTS = {
          success: true,
          hasAudio: !!(
            result &&
            result.audio
          )
        };

      } catch (error) {
        results.grokTTS = {
          success: false,
          error: error instanceof Error
            ? error.message
            : String(error)
        };
      }

      // =========================
      // RETURN RESULTS
      // =========================
      return new Response(
        JSON.stringify(results, null, 2),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        }
      );
    }

    // Not found
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