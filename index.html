export default {
  async fetch(request, env) {

    const url = new URL(request.url);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    // =========================
    // CORS
    // =========================

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }


    // =========================
    // HOME
    // =========================

    if (
      url.pathname === "/" &&
      request.method === "GET"
    ) {

      return new Response(
        "AI TEST WORKER IS RUNNING",
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "text/plain; charset=utf-8"
          }
        }
      );

    }


    // =========================
    // TEST QWEN3
    // =========================

    if (
      url.pathname === "/api/test-ai" &&
      request.method === "POST"
    ) {

      try {

        const result = await env.AI.run(
          "@cf/qwen/qwen3-30b-a3b-fp8",
          {
            messages: [
              {
                role: "system",
                content:
                  "You are a test assistant. " +
                  "Reply with only: AI WORKS"
              },
              {
                role: "user",
                content:
                  "Test the AI connection."
              }
            ],

            max_tokens: 20,

            temperature: 0.1
          }
        );


        // =========================
        // GET RESPONSE
        // =========================

        let responseText = "";

        if (
          result &&
          typeof result.response === "string"
        ) {

          responseText =
            result.response;

        } else if (
          typeof result === "string"
        ) {

          responseText =
            result;

        } else {

          responseText =
            JSON.stringify(result);

        }


        // =========================
        // RETURN
        // =========================

        return new Response(

          JSON.stringify({
            success: true,
            message:
              "Workers AI is working.",
            result:
              responseText
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
          "AI TEST ERROR:",
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
    // NOT FOUND
    // =========================

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