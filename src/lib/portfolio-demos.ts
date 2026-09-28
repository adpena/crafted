/** Reserved portfolio examples, including old direct links and the admin preview. */
export const PORTFOLIO_DEMOS = new Set([
  "fund-public-schools", "climate-action-now", "healthcare-pledge",
  "voting-rights-signup", "write-your-rep", "rally-town-hall",
  "call-your-rep", "education-survey", "preview",
]);

/** Keep the public examples explicitly fictional as their original dates age. */
export function preparePortfolioDemo(slug: string, source: Record<string, any>) {
  if (!PORTFOLIO_DEMOS.has(slug)) return source;
  const page = structuredClone(source);
  page.disclaimer = { committee_name: "Example campaign — portfolio demo" };
  page.consent = undefined;
  page.callbacks = [];
  page.sharing = { enabled: false };
  page.turnstile_site_key = undefined;
  for (const key of ["action_props", "followup_props"]) {
    const props = page[key];
    if (!props) continue;
    props.actblue_url = "";
    props.event_ids = undefined;
    props.event_urls = undefined;
    props.offer_calendar = false;
    if (props.progress) {
      props.progress = { ...props.progress, mode: "bar", deadline: undefined, refreshInterval: undefined, sseUrl: undefined };
    }
  }
  const copy: Record<string, Record<string, string>> = {
    "fund-public-schools": { subhead: "A sample petition for public school funding.", body: "Try signing this example petition, then explore the donation follow-up. Use made-up contact details; the form runs in your browser.", pull_quote: "A petition and a follow-up action on the same page." },
    "climate-action-now": { eyebrow: "Sample fundraiser", headline: "Support a climate campaign", subhead: "Choose an amount to preview the donation flow. This demo does not take payments." },
    "healthcare-pledge": { subhead: "Try a sample pledge form for a healthcare campaign.", body: "This is fictional campaign content. No election reminders will be sent." },
    "voting-rights-signup": { subhead: "A sample signup form for a voting-rights campaign. No mailing list is created." },
    "write-your-rep": { subhead: "Try editing a letter addressed to fictional representatives.", body: "Enter any valid five-digit ZIP to load sample recipients. You can edit the letter before trying the submit button. No letter is sent." },
    "call-your-rep": { headline: "Try a call campaign", subhead: "Enter a ZIP to load fictional representatives and a sample script. Demo call buttons do not dial a phone." },
    "rally-town-hall": { headline: "Sample Healthcare Town Hall", subhead: "A fictional event for trying the RSVP form: May 15, 2027, at 6:30 p.m. Central Time." },
    "education-survey": { subhead: "Try a sample education survey. Your answers stay in this browser session." },
  };
  page.template_props = { ...page.template_props, ...copy[slug] };
  if (slug === "voting-rights-signup") { page.template = "hero-simple"; page.template_props.media_url = undefined; }
  if (slug === "write-your-rep") { page.template_props.image_url = undefined; page.template_props.image_credit = undefined; }
  if (slug === "healthcare-pledge") page.action_props.election_date = "Sample pledge — no election date";
  if (slug === "write-your-rep" || slug === "call-your-rep") {
    page.action_props.talking_points = ["Introduce yourself in one sentence.", "Explain the issue in your own words.", "Ask for a specific action."];
  }
  if (slug === "write-your-rep") page.action_props.letter_template = "Dear {{rep_name}},\n\nI’m writing about public school funding. [Add your own experience here.]\n\nPlease support funding for the students and staff in our community.\n\nSincerely,";
  if (slug === "rally-town-hall") Object.assign(page.action_props, {
    event_name: "Sample Healthcare Town Hall", event_timezone: "America/Chicago", event_date: "2027-05-15T18:30:00-05:00",
    event_location: "Example community room — no real venue",
    event_description: "Fictional event. May 15, 2027, at 6:30 p.m. Central Time. No reservation or calendar event is created.",
  });
  if (slug === "education-survey") {
    page.action_props.steps = page.action_props.steps.map((step: Record<string, unknown>) => step.id === "contact" ? { ...step, body: "Use made-up contact details to try the form." } : step);
  }
  if (page.followup) page.followup_message = "Demo petition complete. Try the sample donation step next.";
  return page;
}
