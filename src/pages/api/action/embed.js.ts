import type { APIRoute } from "astro";
import { handleEmbed } from "../../../../plugin/src/routes/embed.ts";

// Active JavaScript belongs to a site asset route, outside EmDash's raw API.
export const GET: APIRoute = async ({ request }) => {
  const { status, body, headers } = await handleEmbed({ request, input: {} });
  return typeof body === "string"
    ? new Response(body, { status, headers })
    : Response.json(body, { status });
};
