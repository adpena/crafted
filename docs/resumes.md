# Public resume maintenance

The software and research resumes share `src/data/resumes/profile.json`. It supplies `/resume/software` and `/resume/research`, plus the downloadable one-page PDFs in `public/resumes/`. Keep dates, contact details, and education consistent; focus-specific experience bullets and selected projects can differ.

The September 25, 2026 edition was distilled from Alejandro’s current Civitech and Talarico policy resumes, checked against the project descriptions and public source artifacts already reviewed for the portfolio. Source documents remain private and are not copied into this repository. Public downloads use the site contact address and omit the private phone number and personal email address. No unverified availability, current leaderboard rank, or client outcome has been added.

To regenerate the PDFs, use Python with ReportLab installed:

```sh
python3 scripts/build-resumes.py
```

Review both rendered pages after any text change: check fit, headings, bullets, clickable links, and agreement with HTML. The September 25 files were rendered and visually checked at one page each. The release guard hashes both PDFs and the rest of the public artifacts. Regeneration changes the artifact hashes, so commit and prepare again before shipping.
