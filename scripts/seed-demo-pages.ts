#!/usr/bin/env tsx
/**
 * Seed Congress-focused demo action pages with real imagery.
 *
 * Usage:
 *   MCP_ADMIN_TOKEN=xxx BASE_URL=https://adpena.com tsx scripts/seed-demo-pages.ts
 *
 * Creates 6 demo pages exercising all templates, themes, and action types.
 * Uses Wikimedia Commons public-domain images and Unsplash CC0 photos.
 *
 * Idempotent: re-running updates existing pages with the same slug.
 */

const BASE_URL = process.env.BASE_URL ?? "http://localhost:8788";
const TOKEN = process.env.MCP_ADMIN_TOKEN;

if (!TOKEN) {
	console.error("MCP_ADMIN_TOKEN environment variable required");
	process.exit(1);
}

// Public-domain / CC-licensed images — all usable without attribution issues.
// Sourced from Wikimedia Commons and Unsplash (Unsplash License allows commercial use).
const IMG = {
	capitol: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/US_Capitol_west_side.JPG/1920px-US_Capitol_west_side.JPG",
	schoolchildren: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=1920&q=80",
	climate_rally: "https://images.unsplash.com/photo-1569163139394-de4e5f43e4e3?auto=format&fit=crop&w=1920&q=80",
	voting_booth: "https://images.unsplash.com/photo-1611095973362-88e8e2557e58?auto=format&fit=crop&w=1920&q=80",
	hospital: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1920&q=80",
	town_hall: "https://images.unsplash.com/photo-1591115765373-5207764f72e7?auto=format&fit=crop&w=1920&q=80",
	voting_rights: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/Voting_rights_march_1965.jpg/1920px-Voting_rights_march_1965.jpg",
};

interface PageDefinition {
	slug: string;
	template: string;
	template_props: Record<string, unknown>;
	action: string;
	action_props: Record<string, unknown>;
	followup?: string;
	followup_props?: Record<string, unknown>;
	followup_message?: string;
	disclaimer: { committee_name: string; treasurer_name?: string };
	theme: string;
	locale?: string;
	consent?: { privacy_url?: string; required?: boolean };
	sharing?: { enabled?: boolean; text?: string };
	turnstile_site_key?: string;
}

const pages: PageDefinition[] = [
	{
		slug: "fund-public-schools",
		template: "hero-story",
		template_props: {
			headline: "Fully fund public schools",
			subhead: "Congress is debating the federal education budget. Tell your representative that public school students deserve full funding — not cuts.",
			body:
				"The current federal budget proposal would cut Title I funding by 15% — hitting the schools that need it most.\n\nTeachers are spending their own money on supplies. Librarians are being laid off. Arts programs are disappearing. Meanwhile, the schools we all depend on are being told to do more with less.\n\nWe need Congress to hear from constituents — not lobbyists. Add your name to the petition.",
			pull_quote: "Our students are worth fighting for. Our teachers deserve our backing. Our public schools are the bedrock of American opportunity.",
			image_url: IMG.schoolchildren,
			image_alt: "Children in a classroom raising their hands",
			image_credit: "Photo: Kenny Eliason / Unsplash",
		},
		action: "petition",
		action_props: {
			target: "Congress",
			goal: 50000,
			progress: {
				enabled: true,
				goal: 50000,
				mode: "bar",
				labelKey: "progress_signatures",
				refreshInterval: 30000,
			},
		},
		followup: "fundraise",
		followup_props: {
			amounts: [10, 25, 50, 100, 250],
			actblue_url: "https://secure.actblue.com/donate/example-fund-schools",
		},
		followup_message:
			"Thanks for signing! Will you also chip in to help us reach more voters before the budget vote?",
		disclaimer: {
			committee_name: "Educators for America",
			treasurer_name: "Maria Lopez",
		},
		theme: "warm",
		locale: "en",
		consent: { required: true },
		sharing: {
			enabled: true,
			text: "I just signed the petition to fully fund public schools. Add your name:",
		},
	},
	{
		slug: "climate-action-now",
		template: "hero-layered",
		template_props: {
			eyebrow: "Climate Emergency",
			headline: "We can't wait another year",
			subhead: "Help us pressure Congress to pass the strongest climate legislation in a generation.",
			background_type: "image",
			background_image: IMG.climate_rally,
			overlay: "dark",
			overlay_opacity: 0.55,
			content_position: "bottom-left",
			content_color: "#ffffff",
		},
		action: "fundraise",
		action_props: {
			amounts: [25, 50, 100, 250, 500, 1000],
			actblue_url: "https://secure.actblue.com/donate/example-climate-action",
			progress: {
				enabled: true,
				goal: 100000,
				mode: "thermometer",
				labelKey: "progress_donors",
			},
		},
		disclaimer: {
			committee_name: "Climate Action Now PAC",
			treasurer_name: "James Chen",
		},
		theme: "bold",
		locale: "en",
		consent: { required: true },
		sharing: { enabled: true, text: "I just donated to fight for climate action — join me:" },
	},
	{
		slug: "healthcare-pledge",
		template: "hero-split",
		template_props: {
			headline: "Pledge to vote for healthcare",
			subhead: "Affordable healthcare is on the ballot. Take the pledge, and we'll send a reminder before election day.",
			body: "More than 40 million Americans have gained coverage since the Affordable Care Act. Your vote determines whether that progress continues or gets rolled back.",
			media_url: IMG.hospital,
			media_alt: "Medical professional in a hospital",
			media_side: "right",
			ratio: "1/1",
		},
		action: "gotv",
		action_props: {
			pledge_text: "I pledge to vote for candidates who will protect and expand healthcare access.",
			election_date: "November 5, 2026",
			progress: {
				enabled: true,
				goal: 25000,
				mode: "countdown",
				deadline: "2026-11-05T20:00:00-05:00",
				labelKey: "progress_pledges",
			},
		},
		disclaimer: {
			committee_name: "Healthcare Voters United",
			treasurer_name: "Aisha Patel",
		},
		theme: "clean",
		locale: "en",
		consent: { required: true },
		sharing: { enabled: true },
	},
	{
		slug: "voting-rights-signup",
		template: "hero-media",
		template_props: {
			headline: "Defend the right to vote",
			subhead: "Sign up for alerts on the John Lewis Voting Rights Act and key votes in Congress.",
			media_url: IMG.voting_rights,
			media_type: "image",
			overlay_opacity: 0.45,
		},
		action: "signup",
		action_props: {
			list_name: "Voting Rights Advocates",
			cta_text: "Keep me posted",
		},
		disclaimer: {
			committee_name: "Voting Rights Now",
		},
		theme: "warm",
		locale: "en",
		consent: { required: false },
		sharing: { enabled: true },
	},
	{
		slug: "write-your-rep",
		template: "hero-story",
		template_props: {
			headline: "Tell Congress what matters to you",
			subhead: "Personal letters from constituents carry more weight than form letters. Share your story in your own words.",
			body:
				"We'll look up your representatives and pre-fill a letter template. You can edit every word before sending — the more personal, the more effective.\n\nCongressional staff report that handwritten letters and personal emails are taken more seriously than petitions or form messages. Your voice matters.",
			image_url: IMG.capitol,
			image_alt: "US Capitol Building",
			image_credit: "Photo: Wikimedia Commons",
		},
		action: "letter",
		action_props: {
			subject: "Support full federal education funding",
			letter_template:
				"Dear {{rep_name}},\n\nAs your constituent, I am writing to urge you to support full funding for Title I schools in the upcoming federal budget.\n\nPublic education is the foundation of American opportunity. Cutting Title I funding would harm the students who need the most support — kids in rural districts, kids in low-income neighborhoods, kids whose families are counting on public schools to give them a fair shot.\n\nPlease vote NO on any budget that cuts federal education funding. I am counting on your leadership.\n\nSincerely,",
			rep_level: "both",
			talking_points: [
				"Title I funds serve over 25 million students nationwide",
				"Cuts would fall hardest on rural and low-income districts",
				"Teachers are already spending $750/year on classroom supplies",
				"Arts, librarians, and counselors are on the chopping block first",
			],
		},
		disclaimer: {
			committee_name: "Educators for America",
			treasurer_name: "Maria Lopez",
		},
		theme: "warm",
		locale: "en",
		consent: { required: true },
		sharing: { enabled: true, text: "I just wrote my representatives about education funding. Join me:" },
	},
	{
		slug: "rally-town-hall",
		template: "hero-media",
		template_props: {
			headline: "Healthcare Town Hall",
			subhead: "Join us for a community conversation with local healthcare advocates and elected officials.",
			media_url: IMG.town_hall,
			media_type: "image",
			overlay_opacity: 0.5,
		},
		action: "event",
		action_props: {
			event_name: "Healthcare Town Hall",
			event_date: "2026-05-15T18:30:00-05:00",
			event_location: "Austin Public Library, Central Branch — Community Room",
			event_description:
				"Doors at 6:00 PM. Panel begins at 6:30 PM. Childcare provided. ASL interpretation available on request — please note in the RSVP form.",
			allow_guests: true,
			offer_calendar: true,
			// External platform IDs — syncs RSVPs to Mobilize + Eventbrite + Facebook
			event_ids: {
				mobilize: "demo-mobilize-id-12345",
				eventbrite: "demo-eventbrite-id-67890",
				facebook: "demo-fb-event-id-abcde",
			},
			event_urls: {
				eventbrite: "https://www.eventbrite.com/e/healthcare-town-hall-demo",
				facebook: "https://www.facebook.com/events/demo-healthcare-town-hall",
				mobilize: "https://www.mobilize.us/healthcare-voters/event/demo/",
			},
		},
		disclaimer: {
			committee_name: "Healthcare Voters United",
			treasurer_name: "Aisha Patel",
		},
		theme: "clean",
		locale: "en",
		consent: { required: true },
		sharing: { enabled: true, text: "I'm going to the Healthcare Town Hall — join me:" },
	},
	{
		slug: "call-your-rep",
		template: "hero-simple",
		template_props: {
			headline: "Call Congress now",
			subhead: "A 60-second phone call is the most effective thing you can do. We'll look up your representatives and give you a script.",
			align: "center",
		},
		action: "call",
		action_props: {
			target: "Congress",
			script: "Hi, my name is [YOUR NAME] and I'm a constituent from [YOUR CITY]. I'm calling to urge the Senator/Representative to support full funding for Title I schools in the upcoming federal budget. Public education funding is critical for our community. Can I leave a message? Thank you.",
			rep_level: "both",
			talking_points: [
				"Title I funds serve over 25 million students nationwide",
				"Cuts would fall hardest on rural and low-income districts",
				"Be brief — 30-60 seconds is plenty",
				"State your zip code to confirm you're a constituent",
			],
		},
		disclaimer: {
			committee_name: "Educators for America",
			treasurer_name: "Maria Lopez",
		},
		theme: "bold",
		locale: "en",
		consent: { required: true },
		sharing: { enabled: true, text: "I just called Congress about education funding — you should too:" },
	},
	{
		slug: "education-survey",
		template: "hero-simple",
		template_props: {
			headline: "How should Congress invest in education?",
			subhead: "Take our 3-question survey and we'll share the results with your representatives.",
			align: "center",
		},
		action: "step",
		action_props: {
			steps: [
				{
					id: "priorities",
					heading: "What's your top education priority?",
					body: "Select the issue that matters most to you.",
					fields: [
						{
							type: "radio",
							name: "priority",
							label: "Top priority",
							required: true,
							options: [
								{ value: "funding", label: "Increase federal funding for public schools" },
								{ value: "teachers", label: "Raise teacher pay and reduce class sizes" },
								{ value: "access", label: "Expand pre-K and early childhood education" },
								{ value: "equity", label: "Close the achievement gap in underserved communities" },
							],
						},
					],
				},
				{
					id: "contact",
					heading: "Add your voice",
					body: "We'll include your response when we present the results to Congress.",
					fields: [
						{ type: "text", name: "first_name", label: "First name", required: true, autoComplete: "given-name" },
						{ type: "text", name: "last_name", label: "Last name", required: true, autoComplete: "family-name" },
						{ type: "email", name: "email", label: "Email", required: true, autoComplete: "email" },
						{ type: "zip", name: "zip", label: "Zip code", required: true, autoComplete: "postal-code" },
					],
				},
				{
					id: "comment",
					heading: "Anything else?",
					body: "Optional — share a personal story or message for your representative.",
					fields: [
						{ type: "textarea", name: "comment", label: "Your message (optional)", maxLength: 1000 },
					],
				},
			],
			submit_label: "Submit survey",
		},
		disclaimer: {
			committee_name: "Educators for America",
			treasurer_name: "Maria Lopez",
		},
		theme: "clean",
		locale: "en",
		consent: { required: true },
		sharing: { enabled: true, text: "I just took the education priorities survey — add your voice:" },
	},
];

interface RpcResponse {
	jsonrpc?: string;
	result?: { ok?: boolean; page_id?: string; data?: unknown };
	error?: { code: number; message: string };
}

async function rpc(method: string, params: Record<string, unknown>): Promise<RpcResponse> {
	const res = await fetch(`${BASE_URL}/api/mcp/actions`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${TOKEN}`,
		},
		body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
	});
	try {
		return (await res.json()) as RpcResponse;
	} catch {
		return { error: { code: -1, message: `Non-JSON response (HTTP ${res.status})` } };
	}
}

async function main() {
	console.log(`Seeding ${pages.length} demo pages to ${BASE_URL}…\n`);

	for (const page of pages) {
		process.stdout.write(`  ${page.slug.padEnd(28)} `);
		const result = await rpc("create_page", page as unknown as Record<string, unknown>);
		if (result.error) {
			console.log(`✗ ${result.error.message}`);
		} else {
			console.log(`✓`);
		}
	}

	console.log(`\nDone. View at:`);
	for (const p of pages) {
		console.log(`  ${BASE_URL}/action/${p.slug}`);
	}
}

main().catch((err) => {
	console.error("Seed failed:", err);
	process.exit(1);
});
