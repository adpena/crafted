/**
 * Shared timing-safe Bearer auth for admin endpoints.
 *
 * All admin endpoints use a single implementation to prevent drift
 * and ensure consistent security behavior.
 *
 * The HMAC key is derived from the admin token itself, so even if an
 * attacker reads this source code, they cannot forge valid comparisons
 * without already possessing the secret.
 */

/**
 * Minimum admin token length. Tokens shorter than this are rejected outright
 * because they provide insufficient HMAC key entropy for timing-safe comparison
 * to be meaningful. 32 bytes matches the output size of SHA-256.
 */
const MIN_TOKEN_LENGTH = 32;

/**
 * Constant-time comparison of a Bearer Authorization header against the
 * expected token. Returns true only if the header exactly matches `Bearer ${token}`.
 *
 * Implementation uses HMAC-SHA256 where the HMAC key is the expected token
 * itself. This means:
 *   1. Comparison is constant-time (prevents byte-by-byte timing leaks)
 *   2. An attacker without the token cannot compute a valid HMAC offline
 *   3. Byte-length mismatches fail fast without leaking length info
 *
 * Short tokens (< 32 bytes) are rejected to enforce minimum key entropy.
 */
export async function verifyBearer(
	authHeader: string | null | undefined,
	expectedToken: string | undefined,
): Promise<boolean> {
	if (!expectedToken || !authHeader) return false;
	if (expectedToken.length < MIN_TOKEN_LENGTH) return false;
	return timingSafeCompare(`Bearer ${expectedToken}`, authHeader, expectedToken);
}

/**
 * Constant-time string comparison using HMAC-SHA256.
 * The key material must be secret for this to provide meaningful protection.
 */
export async function timingSafeCompare(
	a: string,
	b: string,
	keyMaterial: string,
): Promise<boolean> {
	const encoder = new TextEncoder();
	let key: CryptoKey;
	try {
		key = await crypto.subtle.importKey(
			"raw",
			encoder.encode(keyMaterial),
			{ name: "HMAC", hash: "SHA-256" },
			false,
			["sign"],
		);
	} catch {
		return false;
	}

	const [sigA, sigB] = await Promise.all([
		crypto.subtle.sign("HMAC", key, encoder.encode(a)),
		crypto.subtle.sign("HMAC", key, encoder.encode(b)),
	]);

	const viewA = new Uint8Array(sigA);
	const viewB = new Uint8Array(sigB);
	if (viewA.length !== viewB.length) return false;

	let result = 0;
	for (let i = 0; i < viewA.length; i++) {
		result |= viewA[i]! ^ viewB[i]!;
	}
	return result === 0;
}

/**
 * SHA-256 hex digest — used for privacy-preserving hashing of
 * IPs, emails, and other identifiers. Replace djb2 in audit/webhook
 * code paths with this.
 */
export async function sha256Hex(value: string): Promise<string> {
	const data = new TextEncoder().encode(value);
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	return Array.from(new Uint8Array(hashBuffer))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}
