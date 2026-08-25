export default {
  async fetch(request, env) {

    const url = new URL(request.url);

    // AI STORY API
    if (
      url.pathname === "/api/create-story" &&
      request.method === "POST"
    ) {

      try {

        const body = await request.json();

        const prompt = body.prompt || `
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

Do not claim fictional events are real.

Return:
TITLE:
SCRIPT:
SCENES:
VISUAL PROMPTS:
VOICE DIRECTION:
`;

        const result = await env.AI.run(
          "@cf/meta/llama-3.1-8b-instruct",
          {
            messages: [
              {
                role: "system",
                content:
                  "You are the Story Agent for UNKNOWN FILES, a YouTube Shorts channel."
              },
              {
                role: "user",
                content: prompt
              }
            ]
          }
        );

        return new Response(
          JSON.stringify({
            success: true,
            result: result
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            }
          }
        );

      } catch (error) {

        return new Response(
          JSON.stringify({
            success: false,
            error: error.message
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            }
          }
        );

      }
    }

    // Simple response for normal browser visits
    return new Response(
      "UNKNOWN FILES AI Agent is online. Use POST /api/create-story to generate a story.",
      {
        status: 200,
        headers: {
          "Content-Type": "text/plain",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );

  }
};