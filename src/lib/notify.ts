/**
 * Contact form notification dispatch.
 *
 * Thin wrapper around @adpena/notifications that maps the contact form's
 * Submission interface to the shared package's Message interface.
 */

import { notifyAll as dispatch, type NotifyResult, type NotifyEnv } from "@adpena/notifications";

export type { NotifyResult, NotifyEnv };

export interface Submission {
	name: string;
	email: string;
	message: string;
}

/**
 * Send a contact form submission to all configured notification channels.
 */
export async function notifyAll(env: NotifyEnv, sub: Submission): Promise<NotifyResult> {
	const name = typeof sub?.name === "string" ? sub.name : "";
	const email = typeof sub?.email === "string" ? sub.email : "";
	const message = typeof sub?.message === "string" ? sub.message : "";

	if (!name || !email || !message) {
		console.warn("[notify] skipped: empty name, email, or message");
		return { sent: [], failed: [], skipped: [] };
	}

	return dispatch(env, {
		subject: `Contact from ${name}`,
		body: `From: ${name} (${email})\n\n${message}`,
		replyTo: email,
		fields: { name, email, message },
	});
}
