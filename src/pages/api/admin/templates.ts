/**
 * Page template gallery.
 *
 * GET /api/admin/templates
 * Authorization: Bearer <MCP_ADMIN_TOKEN>
 *
 * Returns a library of pre-built campaign templates grouped by category.
 * Each template is a partial ActionPageConfig that can be cloned as a
 * starting point in the admin page builder.
 */

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { verifyBearer } from "../../../lib/auth.ts";

interface PageTemplate {
	id: string;
	name: string;
	description: string;
	category: "petition" | "fundraise" | "event" | "letter" | "signup" | "gotv" | "call";
	preview_image?: string;
	config: Record<string, unknown>;
}

const TEMPLATES: PageTemplate[] = [
	// ---------- Petitions ----------
	{
		id: "petition-editorial",
		name: "Editorial Petition",
		description: "Long-form story petition with lead photo, pull quote, and fundraise followup. Best for issue advocacy with a narrative.",
		category: "petition",
		preview_image: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=600&q=70",
		config: {
			template: "hero-story",
			template_props: {
				headline: "Your headline here",
				subhead: "A compelling subhead that explains the stakes.",
				body: "Two to four paragraphs telling the story.\n\nThis is where you connect the reader emotionally to the cause. Use concrete details and specific examples.\n\nClose with a clear call to action.",
				pull_quote: "A memorable quote that crystallizes the argument.",
			},
			action: "petition",
			action_props: {
				target: "Congress",
				goal: 50000,
				progress: { enabled: true, goal: 50000, mode: "bar", labelKey: "progress_signatures" },
			},
			followup: "fundraise",
			followup_message: "Thanks for signing! Will you also chip in?",
			theme: "warm",
		},
	},
	{
		id: "petition-urgent",
		name: "Urgent Call to Action",
		description: "Full-bleed dark hero with countdown timer. Use when there's a vote coming up.",
		category: "petition",
		config: {
			template: "hero-layered",
			template_props: {
				eyebrow: "Time Sensitive",
				headline: "We need your signature now",
				subhead: "The vote is in 72 hours.",
				overlay: "dark",
				overlay_opacity: 0.55,
				content_position: "bottom-left",
				content_color: "#ffffff",
			},
			action: "petition",
			action_props: {
				target: "Congress",
				goal: 25000,
				progress: {
					enabled: true,
					goal: 25000,
					mode: "countdown",
					deadline: new Date(Date.now() + 3 * 86400 * 1000).toISOString(),
				},
			},
			theme: "bold",
		},
	},

	// ---------- Fundraising ----------
	{
		id: "fundraise-thermometer",
		name: "Thermometer Fundraiser",
		description: "Visual fundraising progress with amount tiers. Defaults to ActBlue integration.",
		category: "fundraise",
		config: {
			template: "hero-media",
			template_props: {
				headline: "Help us reach our goal",
				subhead: "Every contribution fuels the fight.",
				media_type: "image",
				overlay_opacity: 0.45,
			},
			action: "fundraise",
			action_props: {
				amounts: [25, 50, 100, 250, 500, 1000],
				actblue_url: "https://secure.actblue.com/donate/your-committee",
				progress: { enabled: true, goal: 100000, mode: "thermometer", labelKey: "progress_donors" },
			},
			theme: "bold",
		},
	},

	// ---------- Events ----------
	{
		id: "event-town-hall",
		name: "Town Hall / Community Event",
		description: "Event RSVP with calendar export and multi-platform event ID sync (Mobilize, Eventbrite, Facebook).",
		category: "event",
		config: {
			template: "hero-media",
			template_props: {
				headline: "Join us for a community town hall",
				subhead: "An evening of conversation with local leaders.",
				media_type: "image",
				overlay_opacity: 0.5,
			},
			action: "event",
			action_props: {
				event_name: "Community Town Hall",
				event_date: "2026-05-15T18:30:00-05:00",
				event_location: "Your venue here",
				event_description: "Doors open at 6:00 PM. Childcare provided. ASL interpretation available on request.",
				allow_guests: true,
				offer_calendar: true,
				event_ids: { mobilize: "", eventbrite: "", facebook: "" },
			},
			theme: "clean",
		},
	},

	// ---------- Letter to Congress ----------
	{
		id: "letter-to-rep",
		name: "Letter to Your Representatives",
		description: "Zip-based rep lookup with editable letter template. Matches Action Network's Letter Campaign tool.",
		category: "letter",
		config: {
			template: "hero-story",
			template_props: {
				headline: "Tell Congress what matters to you",
				subhead: "Personal letters carry more weight than form letters.",
				body: "We'll look up your representatives and pre-fill a letter template. You can edit every word before sending.",
			},
			action: "letter",
			action_props: {
				subject: "Your subject line",
				letter_template: "Dear {{rep_name}},\n\nAs your constituent, I am writing to urge you to...\n\nSincerely,",
				rep_level: "both",
				talking_points: [
					"First key point",
					"Second key point",
					"Third key point",
				],
			},
			theme: "warm",
		},
	},

	// ---------- Click to Call ----------
	{
		id: "call-your-rep",
		name: "Call Your Representatives",
		description: "Click-to-dial phone action with rep lookup. Mobile-friendly with tap targets and call tracking.",
		category: "call",
		config: {
			template: "hero-simple",
			template_props: {
				headline: "Call Congress now",
				subhead: "A 60-second phone call is the most effective thing you can do.",
				align: "center",
			},
			action: "call",
			action_props: {
				target: "Congress",
				script: "Hi, my name is [NAME] and I'm calling from [CITY, STATE]. I'm urging the Senator/Representative to vote [YES/NO] on [BILL]. Can I leave a message?",
				rep_level: "both",
				talking_points: [
					"Be brief — 30-60 seconds is plenty",
					"State your zip code to confirm you're a constituent",
					"Ask for a specific action (vote yes/no on X)",
				],
			},
			theme: "bold",
		},
	},

	// ---------- GOTV ----------
	{
		id: "gotv-pledge",
		name: "Pledge to Vote",
		description: "Get-out-the-vote pledge with election countdown. Collects first name + zip only for low friction.",
		category: "gotv",
		config: {
			template: "hero-split",
			template_props: {
				headline: "Pledge to vote on election day",
				subhead: "Your vote is your voice.",
				media_type: "image",
				media_side: "right",
				ratio: "1/1",
			},
			action: "gotv",
			action_props: {
				pledge_text: "I pledge to vote in the upcoming election.",
				election_date: "November 5, 2026",
				progress: {
					enabled: true,
					goal: 10000,
					mode: "countdown",
					deadline: "2026-11-05T20:00:00-05:00",
					labelKey: "progress_pledges",
				},
			},
			theme: "clean",
		},
	},

	// ---------- Email list signup ----------
	{
		id: "signup-newsletter",
		name: "Email Newsletter Signup",
		description: "Minimal email capture with optional first name. Single-click, mobile-optimized.",
		category: "signup",
		config: {
			template: "hero-simple",
			template_props: {
				headline: "Stay in the loop",
				subhead: "Get updates on the campaign straight to your inbox.",
				align: "center",
			},
			action: "signup",
			action_props: {
				list_name: "Campaign Updates",
				cta_text: "Sign me up",
			},
			theme: "warm",
		},
	},
];

export const GET: APIRoute = async ({ url, request }) => {
	const token = (env as Record<string, unknown>).MCP_ADMIN_TOKEN as string | undefined;
	if (!(await verifyBearer(request.headers.get("Authorization"), token))) {
		return json(401, { error: "Unauthorized" });
	}

	const category = url.searchParams.get("category");
	const filtered = category
		? TEMPLATES.filter((t) => t.category === category)
		: TEMPLATES;

	return json(200, {
		data: filtered,
		total: filtered.length,
		categories: Array.from(new Set(TEMPLATES.map((t) => t.category))),
	});
};

function json(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json", "Cache-Control": "private, no-cache" },
	});
}
