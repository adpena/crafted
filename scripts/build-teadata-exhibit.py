"""Export a small public-data example through the actual teadata query engine.

Run with teadata commit 7b206d8a0fb086fec2176b78bb22bf1530486247 on PYTHONPATH.
Input: examples/campus_stats_district.xlsx from that commit.
"""
import argparse
import hashlib
import json
import uuid
from pathlib import Path

import openpyxl
from teadata import Campus, DataEngine, District

parser = argparse.ArgumentParser()
parser.add_argument("workbook", type=Path)
parser.add_argument("output", type=Path)
args = parser.parse_args()
engine = DataEngine(indexes_enabled=False)
districts = {}
workbook = openpyxl.load_workbook(args.workbook, read_only=True, data_only=True)
records = list(workbook.active.values)
assert records[0][0] == "Campus Number" and records[0][15] == "2023-24 % Beginning Teachers"
for row in records[1:]:
    number = str(row[0]).lstrip("'").zfill(9)
    district_number = number[:6]
    if district_number not in districts:
        district = District(id=uuid.uuid5(uuid.NAMESPACE_URL, district_number), name=row[2], district_number=district_number)
        districts[district_number] = district
        engine.add_district(district)
    rate = row[15] if isinstance(row[15], (int, float)) else None
    engine.add_campus(Campus(
        id=uuid.uuid5(uuid.NAMESPACE_URL, number), district_id=districts[district_number].id,
        name=row[1], campus_number=number, district_number=district_number,
        charter_type="Public", is_charter=False, rating=row[8],
        meta={"district_name": row[2], "county": row[3], "school_type": row[6], "beginning_teachers_pct": rate},
    ))

def select(district_name, rating, minimum):
    return (engine >> ("district", district_name) >> ("campuses_in",)
            >> ("filter", lambda c: (rating == "all" or c.rating == rating)
                and c.beginning_teachers_pct is not None and c.beginning_teachers_pct >= minimum)
            >> ("sort", lambda c: c.campus_number)
            >> ("sort", lambda c: c.beginning_teachers_pct, True)
            >> ("take", 10))

rows = []
for district in districts.values():
    for campus in engine >> ("district", district.district_number) >> ("campuses_in",):
        rows.append({"id": campus.campus_number.lstrip("'"), "name": campus.name, "district": campus.district_name,
                     "rating": campus.rating,
                     "beginningTeachers": campus.beginning_teachers_pct})
assert len(rows) == 795 and len({r["id"] for r in rows}) == 795
checks = []
for district in ["Austin ISD", "Houston ISD", "Dallas ISD", "Abilene ISD"]:
    for rating, minimum in [("all", 0), ("D", 10), ("F", 20)]:
        checks.append({"district": district, "rating": rating, "minimum": minimum,
                       "ids": [c.campus_number.lstrip("'") for c in select(district, rating, minimum)]})
payload = {"sourceCommit": "7b206d8a0fb086fec2176b78bb22bf1530486247",
           "workbookSha256": hashlib.sha256(args.workbook.read_bytes()).hexdigest(),
           "scope": "795 selected D/F-rated district campuses in the repository's example workbook; not a statewide campus inventory.",
           "districtCount": len(districts), "rows": sorted(rows, key=lambda r: r["id"]), "verifiedQueries": checks}
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
print(f"Exported {len(rows)} campuses in {len(districts)} districts; {len(checks)} reference queries executed by teadata.")
