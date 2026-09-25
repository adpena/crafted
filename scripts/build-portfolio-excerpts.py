"""Render dated workbook excerpts for the portfolio; these are new exhibits, not original client reports."""
from pathlib import Path
import json
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import simpleSplit

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/pdf'
OUT.mkdir(parents=True, exist_ok=True)
W, H = A4
INK, MUTED, LINE = HexColor('#1e2927'), HexColor('#52635e'), HexColor('#c9d4cf')

def money(value):
    return 'Not reported' if value is None else f'${value:,.2f}'

def report(filename, title, subtitle, rows, notes, url):
    c = canvas.Canvas(str(OUT / filename), pagesize=A4, invariant=1)
    c.setTitle(title)
    c.setAuthor('Alejandro Peña')
    c.setFillColor(INK)
    c.setFont('Helvetica-Bold', 10)
    c.drawString(48, H-52, 'ALEJANDRO PEÑA  /  PORTFOLIO EXCERPT')
    c.setFont('Times-Bold', 27)
    c.drawString(48, H-101, title)
    c.setFillColor(MUTED)
    c.setFont('Helvetica', 10)
    c.drawString(48, H-125, subtitle)
    y = H-175
    for label, value in rows:
        c.setFillColor(INK)
        c.setFont('Helvetica', 10)
        label_lines = simpleSplit(label, 'Helvetica', 10, 270)
        value_lines = simpleSplit(str(value), 'Helvetica-Bold', 10, 190)
        for i, line in enumerate(label_lines): c.drawString(48, y-i*14, line)
        c.setFont('Helvetica-Bold', 10)
        for i, line in enumerate(value_lines): c.drawRightString(W-48, y-i*14, line)
        y -= max(len(label_lines), len(value_lines))*14+16
        c.setStrokeColor(LINE);c.line(48,y+15,W-48,y+15)
    y -= 28
    c.setFillColor(INK);c.setFont('Helvetica-Bold', 11);c.drawString(48,y,'How to read this excerpt');y-=22
    c.setFont('Helvetica', 10)
    for note in notes:
        for line in simpleSplit(note,'Helvetica',10,W-96):
            c.drawString(48,y,line);y-=15
        y-=12
    c.setFillColor(MUTED);c.setFont('Helvetica',9)
    c.drawString(48,100,'Source: the linked public workbook/export, reproduced without recalculation.')
    c.setFont('Helvetica-Bold',9);c.drawString(48,82,'Open the source and interactive exhibit')
    c.linkURL(url,(48,78,300,94),relative=0)
    c.setFont('Helvetica',8);c.drawString(48,51,'Prepared September 25, 2026. Historical data; not a current funding estimate.')
    c.drawRightString(W-48,51,'1 / 1')
    assert y>122, f'Content overflows {filename}'
    c.showPage();c.save()

hb2=next(r for r in json.loads((ROOT/'src/data/portfolio/hb2.json').read_text()) if r['id']=='101902')
report('hb2-aldine-workbook-excerpt.pdf','Aldine ISD: HB 2 funding','District 101902 | 2025-26 comparison workbook',[
 ('Estimated Support Staff Retention Allotment',money(hb2['ssra'])),
 ('SSRA attributed to attendance adjustment',money(hb2['bonus'])),
 ('Sparsity-adjusted regular program ADA',f"{hb2['ada']:,.5f}"),
 ('Paraprofessional FTE used in this workbook',f"{hb2['paraFte']:,.2f}"),
], [
 'This is a new portfolio excerpt from the published comparison workbook. It is not one of the original 35 customized reports prepared for local leaders.',
 'The amounts describe estimated allotment funding. They do not show an observed employee raise or guarantee how a district spent the allocation.',
 'The workbook uses a paraprofessional staffing count. Texas AFT\'s published raise examples use a broader support-staff denominator; those measures should not be substituted for one another.',
], 'https://adpena.com/work/policy/hb2-support-staff-raises')
charter=next(r for r in json.loads((ROOT/'src/data/portfolio/charter-cost.json').read_text()) if r['id']=='227901')
report('charter-cost-austin-workbook-excerpt.pdf','Austin ISD: charter transfers','District 227901 | 2023-24 export calculated June 21, 2024',[
 ('Estimated district revenue',money(charter['revenue'])),
 ('Refined average daily attendance',f"{charter['ada']:,.3f}"),
 ('District enrollment',f"{charter['enrollment']:,.0f}"),
 ('Reported charter transfers out',charter['transfers']),
 ('Estimated revenue effect',money(charter['loss'])),
 ('Summary of Finances',charter['sof']),
], [
 'This new portfolio excerpt reproduces a row from the project\'s statewide export. It is not an original district statement of impact.',
 'The estimate associates district funding and attendance inputs with reported charter transfers. It does not measure recoverable savings or guarantee that every estimated dollar would return if students transferred back.',
 'The full project spans five years and 1,023 districts. This 2023-24 export contains 1,020 district rows; the two counts describe different populations.',
], 'https://adpena.com/work/policy/fiscal-impact-of-charter-school-expansion')
print('Created two dated portfolio excerpts.')
