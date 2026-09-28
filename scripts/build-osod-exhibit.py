#!/usr/bin/env python3
"""Check the published OSOD comparison against TEA Snapshot 2023 public records.

Usage: python3 scripts/build-osod-exhibit.py <directory-containing-TEA-downloads>
Files: tea-2023-district.dat/.lyt and tea-2023-summary.dat/.lyt.
Obtain each via POST to https://rptsvr1.tea.texas.gov/perfreport/snapshot/push.cgi
with level=district or analyze, set=23, suf=.dat or .lyt.
"""
import csv
import hashlib
import json
from pathlib import Path
import sys

source = Path(sys.argv[1])
rows = list(csv.DictReader((source / "tea-2023-district.dat").open()))
assert len(rows) == 1209
layout = (source / "tea-2023-district.lyt").read_text()
assert "TOTAL ACTUAL OPERATING EXPENDITURES (2021-22)" in layout
groups = []
for charter in (False, True):
    group = [r for r in rows if (r["COMMTYPE"] == "Charters") == charter]
    valid = []
    for row in group:
        try:
            expenditure, percentage = float(row["DPFEAOPFT"]), float(row["DZEXADMP"])
        except ValueError:
            continue
        if expenditure > 0:
            valid.append((expenditure, percentage))
    total = sum(v[0] for v in valid)
    share = sum(spending * percent for spending, percent in valid) / total
    groups.append({"group": "Charters" if charter else "Districts", "sourceRows": len(group),
                   "usableRows": len(valid), "operatingExpenditure": total,
                   "weightedSharePercent": share, "publishedSharePercent": 10.3 if charter else 6.8})
    assert round(share, 1) == groups[-1]["publishedSharePercent"]
result = {"source": "https://rptsvr1.tea.texas.gov/perfreport/snapshot/download.html",
          "snapshotYear": 2023, "financialYear": "2021-22", "retrievedAt": "2026-09-28",
          "method": "Weighted mean of DZEXADMP using DPFEAOPFT; excludes rows with unavailable or nonpositive spending or unavailable percentage. Input percentages are rounded, so this is an approximate reconstruction, not exact central-administration dollars.",
          "groups": groups, "sources": {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(source.glob("tea-2023-*"))}}
root = Path(__file__).resolve().parents[1]
(root / "public/portfolio/osod-source-check.json").write_text(json.dumps(result, indent=2) + "\n")
with (root / "public/portfolio/osod-snapshot-2023.csv").open("w") as output:
    writer = csv.DictWriter(output, fieldnames=["DISTRICT", "DISTNAME", "COMMTYPE", "DPFEAOPFT", "DZEXADMP"])
    writer.writeheader()
    writer.writerows({k: r[k] for k in writer.fieldnames} for r in rows)
print(json.dumps(groups, indent=2))
