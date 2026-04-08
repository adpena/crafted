/**
 * Contact record types for the action-pages contacts table.
 *
 * Contacts are stored in `_plugin_storage` with plugin_id='action-pages',
 * collection='contacts'. Each contact is dedup'd by lowercased email and
 * accumulates an action history across all submissions.
 */

export interface ContactAction {
  slug: string;
  type: string;
  timestamp: string;
}

export interface Contact {
  email: string;
  first_name?: string;
  last_name?: string;
  zip?: string;
  first_seen_at: string;
  last_action_at: string;
  total_actions: number;
  tags: string[];
  action_history: ContactAction[];
}

export interface ContactRow {
  id: string;
  contact: Contact;
  created_at: string;
  updated_at: string;
}
