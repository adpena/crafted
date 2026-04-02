# Verification Process

This document describes the process for verifying the accuracy of disclaimer records in this dataset.

## Verification Steps

For each record in the dataset:

1. **Visit `source_url`** and confirm the statute text is accessible and matches the cited `statute_citation`. If the URL returns a 404 or has moved, locate the current official source and update the record.

2. **Verify `required_text`** against the statutory language. Confirm that the template placeholders (e.g., `{committee_name}`, `{treasurer_name}`) accurately represent the information the statute requires to be disclosed.

3. **Check `effective_date`** against the statute's enactment or effective date. For statutes that have been amended, use the effective date of the version that established the current disclaimer requirement.

4. **Update `last_verified`** to today's date after completing verification. This field tracks when a human last confirmed the record against the official source.

5. **If the source page has changed** since last verification (e.g., the statute has been amended, renumbered, or repealed), update all affected fields in the record: `required_text`, `statute_citation`, `source_url`, `effective_date`, and any AI disclosure fields.

## Additional Checks

- For records with `ai_disclosure_required: true`, separately verify the `ai_disclosure_statute` and `ai_disclosure_scope` fields against the cited AI disclosure statute.
- For records with a `context` other than `general`, verify that the statute does in fact distinguish between entity types and that the correct context is assigned.
- Cross-reference the `adapted_text` field (if non-null) against any regulatory guidance or common usage to confirm it is an accepted abbreviation or alternative form.

## Frequency

Records should be re-verified:

- At minimum once per year
- After any state legislative session that may have addressed campaign finance or political advertising
- When a new AI disclosure law is enacted or amended in a covered jurisdiction
- Before any production deployment that relies on this data
