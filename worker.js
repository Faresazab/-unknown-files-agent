export default {
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

    if (
      url.pathname === "/" &&
      request.method === "GET"
    ) {
      return new Response(
        "AI MODEL TESTER",
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "text/plain"
          }
        }
      );
    }

    if (
      url.pathname === "/api/test-models" &&
      request.method === "POST"
    ) {

      const results = {};

      // =========================
      // TEST 1 - QWEN3
      // =========================

      try {

        const result =
          await env.AI.run(
            "@cf/qwen/qwen3-30b-a3b-fp8",
            {
              messages: [
                {
                  role: "user",
                  content: "Reply with OK"
                }
              ],
              max_tokens: 100
            }
          );

        results.qwen3 = {
          success: true,
          result: result
        };

      } catch (error) {

        results.qwen3 = {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : String(error)
        };

      }


      // =========================
      // TEST 2 - QWEN IMAGE
      // =========================

      try {

        const result =
          await env.AI.run(
            "alibaba/qwen-image-3.0-pro",
            {
              prompt:
                "A simple cinematic photograph of an empty dark hallway",
              size:
                "1024x1536",
              n: 1,
              watermark: false
            }
          );

        results.qwenImage = {
          success: true,
          hasImage:
            !!(
              result &&
              result.images &&
              result.images[0]
            )
        };

      } catch (error) {

        results.qwenImage = {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : String(error)
        };

      }


      // =========================
      // TEST 3 - GROK TTS
      // =========================

      try {

        const result =
          await env.AI.run(
            "xai/grok-tts",
            {
              text:
                "This is a test.",
              language:
                "en",
              voice_id:
                "leo"
            }
          );

        results.grokTTS = {
          success: true,
          hasAudio:
            !!(
              result &&
              result.audio
            )
        };

      } catch (error) {

        results.grokTTS = {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : String(error)
        };

      }


      return new Response(

        JSON.stringify(
          results,
          null,
          2
        ),

        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json"
          }
        }

      );

    }


    return new Response(
      JSON.stringify({
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