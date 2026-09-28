#!/usr/bin/env python3
"""Preserve the two responsive district-table layouts from the archived 2024 page.

Input: January 23, 2025 Wayback capture of texasaft.org/lost-decade-and-a-half/.
This is a read-only exhibit. It does not republish the inaccessible workbooks.
"""
import hashlib
from pathlib import Path
import re
import sys

raw = Path(sys.argv[1]).read_bytes()
source = raw.decode()
assert hashlib.sha256(raw).hexdigest() == '4beec49feb2fb5200d3f16aab33bc98063efc0b124c2d08153259754b5e6e746'
style = next(s for s in re.findall(r'<style>(.*?)</style>', source, re.S) if '.district-table-wide' in s)
style = re.sub(r"@import\s+url\([^)]*\);", '', style).strip()
style = style.replace('#007bff', '#1d4e89')  # Accessible contrast for the read-only labels.
style = style.replace('.district-table-wide a', '.district-table-wide .original-link').replace('.district-table-narrow a', '.district-table-narrow .original-link')
tables = []
for kind in ['wide', 'narrow']:
    table = re.search(r"<div id='district-list-" + kind + r"'>.*?</div>", source, re.S).group()
    assert len(re.findall(r'<a\b', table)) == 1209
    table = re.sub(r'<a\b[^>]*>', '<span class="original-link">', table).replace('</a>', '</span>')
    assert not re.search(r'<(?:script|iframe)|\son\w+=|href=', table, re.I)
    tables.append(table)
html = '''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>2024 Lost Decade district index — preserved layout</title><style>body{font-family:Arial,sans-serif;margin:16px;color:#222;background:#fff}p{line-height:1.5}
''' + style + '</style></head><body><p><strong>2024 district index.</strong> Read-only copy of the published layout. The archived Texas AFT page retains the original workbook links.</p>' + ''.join(tables) + '</body></html>\n'
Path(__file__).resolve().parents[1].joinpath('public/portfolio/lost-decade-2024-tables.html').write_text(html)
