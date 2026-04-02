# Legal Notes

## Scope

This dataset covers paid-for-by disclaimer requirements for political advertisements across 10 US state jurisdictions (CA, CO, DC, FL, GA, MD, NY, PA, TX, VA) and the federal level (FEC/FCC rules under 11 CFR 110.11).

This dataset does **not** cover:

- Campaign finance reporting requirements
- Platform-specific advertising policies (Meta, Google, etc.)
- Municipal or county-level disclaimer rules
- Electioneering communication definitions or windows
- Issue advocacy vs. express advocacy distinctions
- Disclaimer requirements for ballot measure committees

## Not Legal Advice

This dataset is provided for informational purposes only and does not constitute legal advice. The information may be incomplete, outdated, or inaccurate. Always consult qualified election law counsel before relying on any information in this dataset for compliance decisions.

## Jurisdictional Layering

Federal disclaimer rules (11 CFR 110.11) apply to all federal candidates and committees nationwide. State rules layer on top for state and local races, and in some cases apply to federal races as well. This dataset does not model the interaction between federal and state requirements. Campaigns operating in multiple jurisdictions must independently assess compliance at each level.

## Entity Type Context

Records include a `context` field that disambiguates disclaimer requirements by entity type:

- `general` -- Default disclaimer applicable to most political committees
- `candidate_authorized` -- Specific to ads authorized by a candidate's campaign
- `independent_expenditure` -- Specific to independent expenditure committees
- `pac` -- Specific to political action committees

Campaigns must select the correct context for their advertisement. Using the wrong context may result in a non-compliant disclaimer.

## AI Disclosure Scope

Several jurisdictions now require disclosure when political advertisements use AI-generated or AI-altered content. The `ai_disclosure_required` boolean indicates whether a jurisdiction has such a requirement, but the boolean alone is insufficient for compliance decisions.

The `ai_disclosure_scope` field documents conditional triggers. For example, some states only require disclosure for deepfakes depicting real persons within a certain window before an election, or only when content is created with intent to deceive. The `ai_disclosure_statute` field provides the specific statutory citation when it differs from the main disclaimer statute.

## Embeddable Widgets

Whether an embeddable widget (iframe, web component, etc.) constitutes a "political advertisement" is jurisdiction-specific and often legally unresolved. Some jurisdictions define "advertisement" broadly enough to encompass interactive digital content; others have not addressed the question. Consult counsel before deploying embeddable political content.

## Multi-Jurisdiction Ads

Geo-targeted digital advertisements may be displayed to users in multiple states simultaneously. In such cases, the ad may need to comply with the disclaimer requirements of every state where it is displayed. This dataset does not model multi-jurisdiction compliance. Campaigns running geo-targeted ads should independently assess requirements in each target jurisdiction.

## Staleness

Check the `last_verified` date on each record. State legislatures can change disclaimer requirements each legislative session. AI disclosure requirements in particular are an area of active legislation, with multiple states considering or enacting new rules each year.

## Dataset Disclaimer

This dataset is provided for informational purposes only and does not constitute legal advice. Political advertising laws change frequently. Always verify current requirements with official sources and qualified legal counsel before publishing any political advertisement.
