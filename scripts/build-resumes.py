#!/usr/bin/env python3
"""Generate public resume PDFs from the same data as the HTML resume pages."""
import json
from pathlib import Path
from html import escape
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph

ROOT = Path(__file__).resolve().parents[1]
profile = json.loads((ROOT / 'src/data/resumes/profile.json').read_text())
# Built-in PDF fonts keep this builder portable and support Peña in WinAnsi.
styles = {
 'name': ParagraphStyle('name',fontName='Helvetica',fontSize=22,leading=26,spaceAfter=4),
 'title': ParagraphStyle('title',fontName='Helvetica',fontSize=12,leading=16,spaceAfter=5),
 'contact': ParagraphStyle('contact',fontName='Helvetica',fontSize=8.5,leading=12,spaceAfter=10),
 'body': ParagraphStyle('body',fontName='Helvetica',fontSize=9,leading=11.5,spaceAfter=5),
 'section': ParagraphStyle('section',fontName='Helvetica-Bold',fontSize=10,leading=13,spaceBefore=8,spaceAfter=4,keepWithNext=True),
 'job': ParagraphStyle('job',fontName='Helvetica-Bold',fontSize=9.2,leading=12,spaceBefore=5,spaceAfter=2,keepWithNext=True),
 'meta': ParagraphStyle('meta',fontName='Helvetica',fontSize=8,leading=11,textColor=colors.HexColor('#444444'),spaceAfter=4,keepWithNext=True),
 'bullet': ParagraphStyle('bullet',fontName='Helvetica',fontSize=9,leading=11.5,leftIndent=8,firstLineIndent=-8,spaceAfter=4),
}
def clean(text):
 return escape(text.replace('—','-').replace('–','-').replace('’',"'"))
def p(text,style='body'):
 return Paragraph(clean(text), styles[style])
def footer(canvas,doc):
 canvas.setFont('Helvetica',7.5);canvas.setFillColor(colors.HexColor('#555555'))
 canvas.drawString(42,27,'Alejandro Peña | adpena.com | Updated September 25, 2026')
 canvas.drawRightString(570,27,str(doc.page))

for focus,version in profile['versions'].items():
 out=ROOT/'public/resumes'/f'alejandro-pena-{focus}.pdf';out.parent.mkdir(parents=True,exist_ok=True)
 doc=SimpleDocTemplate(str(out),pagesize=(612,792),leftMargin=42,rightMargin=42,topMargin=34,bottomMargin=42,title=f"Alejandro Peña - {version['title']}",author='Alejandro Peña')
 flow=[p(profile['name'],'name'),p(version['title'],'title'),Paragraph('Austin, Texas | <link href="mailto:contact@adpena.com">contact@adpena.com</link> | <link href="https://adpena.com">adpena.com</link> | <link href="https://github.com/adpena">github.com/adpena</link>',styles['contact']),p(version['summary']),p('Skills','section'),p(version['skills']),p('Experience','section')]
 for job in profile['experience']:
  flow += [p(job['role'],'job'),p(job['organization']+' | '+job['dates'],'meta')]
  flow += [p('- '+point,'bullet') for point in job[focus]]
 flow += [p('Selected work','section')]
 for project in version['projects']:
  flow += [Paragraph(f'<link href="https://adpena.com{project["href"]}">{clean(project["title"])}</link>',styles['job']),p(project['text'])]
 flow += [p('Education & certification','section')]+[p(line) for line in profile['education']]
 doc.build(flow,onFirstPage=footer,onLaterPages=footer)
 print(out)
