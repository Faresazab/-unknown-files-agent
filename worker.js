export default {
  async fetch(request, env) {

    const url = new URL(request.url);

    // API endpoint for the AI agent
    if (url.pathname === "/api/create-story" && request.method === "POST") {

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

Return:
title
script
scenes
visual prompts
voice direction
`;

        const result = await env.AI.run(
          "@cf/meta/llama-3.1-8b-instruct",
          {
            messages: [
              {
                role: "system",
                content:
                  "You are the Story Agent for UNKNOWN FILES, an original YouTube Shorts channel."
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
            result
          }),
          {
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

    // Serve the Web App
    return env.ASSETS.fetch(request);
  }
};