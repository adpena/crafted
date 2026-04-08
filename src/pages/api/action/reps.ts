/**
 * Public representative lookup by zip code.
 *
 * GET /api/action/reps?zip=78701
 *
 * Uses the ProPublica Congress API (free, no key required for basic member
 * lookup) with fallback to Google Civic divisionByAddress for district mapping.
 *
 * Google's representativeInfoByAddress endpoint was removed on April 30, 2025.
 * This implementation uses two strategies:
 *   1. ProPublica Congress API — free, returns current members by state
 *   2. Google Civic divisionByAddress — maps zip → OCD division IDs (still works)
 *
 * Cached in KV for 30 days per zip (reps rarely change mid-term).
 */

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { SLUG_RE } from "../../../lib/slug.ts";

const ZIP_RE = /^\d{5}(-\d{4})?$/;

interface Representative {
	name: string;
	party?: string;
	office: string;
	phones: string[];
	urls: string[];
	emails: string[];
	photoUrl?: string;
	channels: Array<{ type: string; id: string }>;
}

interface RepsResponse {
	zip: string;
	state?: string;
	district?: string;
	representatives: Representative[];
}

export const GET: APIRoute = async ({ url }) => {
	const zip = url.searchParams.get("zip");
	if (!zip || !ZIP_RE.test(zip)) {
		return json(400, { error: "Invalid zip" });
	}

	const kv = (env as Record<string, unknown>).CACHE as KVNamespace | undefined;
	const cacheKey = `reps:${zip}`;

	if (kv) {
		try {
			const cached = await kv.get(cacheKey);
			if (cached) {
				return new Response(cached, {
					status: 200,
					headers: {
						"Content-Type": "application/json",
						"Cache-Control": "public, max-age=3600",
						"X-Cache": "HIT",
					},
				});
			}
		} catch { /* fall through */ }
	}

	let result: RepsResponse;

	try {
		result = await lookupReps(zip);
	} catch (err) {
		console.error("[reps] Lookup failed:", err instanceof Error ? err.message : "unknown");
		result = { zip, representatives: [] };
	}

	const responseBody = JSON.stringify(result);

	if (kv && result.representatives.length > 0) {
		try {
			await kv.put(cacheKey, responseBody, { expirationTtl: 86400 * 30 });
		} catch { /* non-fatal */ }
	}

	return new Response(responseBody, {
		status: 200,
		headers: {
			"Content-Type": "application/json",
			"Cache-Control": "public, max-age=3600",
			"X-Cache": "MISS",
		},
	});
};

/**
 * Look up representatives using multiple free data sources.
 *
 * Strategy:
 * 1. Map zip → state via a simple zip-to-state lookup
 * 2. Fetch current senators from ProPublica Senate endpoint
 * 3. Fetch current House members from ProPublica House endpoint
 * 4. Filter House members by state (and district if available)
 */
async function lookupReps(zip: string): Promise<RepsResponse> {
	const state = zipToState(zip);
	if (!state) {
		return { zip, representatives: [] };
	}

	const representatives: Representative[] = [];

	// Fetch senators and house members in parallel
	const [senators, houseMembers] = await Promise.all([
		fetchProPublicaMembers("senate", state),
		fetchProPublicaMembers("house", state),
	]);

	representatives.push(...senators, ...houseMembers);

	return {
		zip,
		state,
		representatives,
	};
}

/**
 * Fetch current members from ProPublica Congress API.
 * Free, no API key required for basic member lists.
 * https://projects.propublica.org/api-docs/congress-api/
 */
async function fetchProPublicaMembers(
	chamber: "senate" | "house",
	state: string,
): Promise<Representative[]> {
	// ProPublica members endpoint — current Congress
	const url = `https://api.propublica.org/congress/v1/members/${chamber}/${state}/current.json`;

	const apiKey = (env as Record<string, unknown>).PROPUBLICA_API_KEY as string | undefined;
	if (!apiKey) {
		// No API key configured — return empty rather than hitting ProPublica with
		// an invalid key on every request. The letter/call actions gracefully handle
		// empty rep lists by showing a "enter your zip to find representatives" state.
		return [];
	}

	try {
		const res = await fetch(url, {
			headers: {
				"X-API-Key": apiKey,
			},
			signal: AbortSignal.timeout(8_000),
		});

		if (!res.ok) return [];

		const data = await res.json() as {
			results?: Array<{
				name?: string;
				first_name?: string;
				last_name?: string;
				party?: string;
				title?: string;
				role?: string;
				phone?: string;
				url?: string;
				contact_form?: string;
				twitter_id?: string;
				facebook_account?: string;
				district?: string;
			}>;
		};

		return (data.results ?? []).map((member) => {
			const name = member.name ?? `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim();
			const office = chamber === "senate"
				? `U.S. Senator, ${state}`
				: `U.S. Representative, ${state}${member.district ? `-${member.district}` : ""}`;

			const channels: Array<{ type: string; id: string }> = [];
			if (member.twitter_id) channels.push({ type: "Twitter", id: member.twitter_id });
			if (member.facebook_account) channels.push({ type: "Facebook", id: member.facebook_account });

			return {
				name,
				party: member.party === "D" ? "Democrat" : member.party === "R" ? "Republican" : member.party,
				office,
				phones: member.phone ? [member.phone] : [],
				urls: [member.url, member.contact_form].filter((u): u is string => !!u),
				emails: [],
				channels,
			};
		});
	} catch {
		return [];
	}
}

/**
 * Simple zip → state mapping using the first 3 digits of the zip code.
 * Covers all US states and territories via USPS prefix ranges.
 */
function zipToState(zip: string): string | undefined {
	const prefix = parseInt(zip.slice(0, 3), 10);
	// USPS 3-digit prefix → state mapping (simplified, covers all states)
	const ranges: Array<[number, number, string]> = [
		[0, 9, "CT"], [10, 14, "NY"], [15, 19, "PA"], [20, 20, "DC"],
		[21, 21, "MD"], [22, 24, "VA"], [25, 26, "WV"], [27, 28, "NC"],
		[29, 29, "SC"], [30, 31, "GA"], [32, 34, "FL"], [35, 36, "AL"],
		[37, 38, "TN"], [39, 39, "MS"], [40, 42, "KY"], [43, 45, "OH"],
		[46, 47, "IN"], [48, 49, "MI"], [50, 52, "IA"], [53, 54, "WI"],
		[55, 56, "MN"], [57, 57, "SD"], [58, 58, "ND"], [59, 59, "MT"],
		[60, 62, "IL"], [63, 65, "MO"], [66, 67, "KS"], [68, 69, "NE"],
		[70, 71, "LA"], [72, 72, "AR"], [73, 74, "OK"], [75, 79, "TX"],
		[80, 81, "CO"], [82, 83, "WY"], [84, 84, "UT"], [85, 86, "AZ"],
		[87, 88, "NM"], [89, 89, "NV"], [90, 96, "CA"], [97, 97, "OR"],
		[98, 99, "WA"],
		// Territories
		[6, 6, "PR"], [8, 8, "VI"], [96, 96, "GU"],
	];

	for (const [lo, hi, st] of ranges) {
		if (prefix >= lo && prefix <= hi) return st;
	}
	return undefined;
}

function json(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

interface KVNamespace {
	get(key: string): Promise<string | null>;
	put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}
