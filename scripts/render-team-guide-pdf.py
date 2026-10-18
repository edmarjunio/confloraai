from pathlib import Path
import re
from xml.sax.saxutils import escape
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'output/pdf/manual-equipe-conflora.pdf'
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
pdfmetrics.registerFont(TTFont('Conflora', 'C:/Windows/Fonts/arial.ttf'))
pdfmetrics.registerFont(TTFont('ConfloraBold', 'C:/Windows/Fonts/arialbd.ttf'))
pdfmetrics.registerFontFamily('Conflora', normal='Conflora', bold='ConfloraBold', italic='Conflora', boldItalic='ConfloraBold')
GREEN = colors.HexColor('#155332')
styles = {
    'body': ParagraphStyle('body', fontName='Conflora', fontSize=10, leading=14.5, spaceAfter=8, textColor=colors.HexColor('#20372b')),
    'h1': ParagraphStyle('h1', fontName='ConfloraBold', fontSize=27, leading=32, spaceAfter=18, textColor=GREEN, keepWithNext=True),
    'h2': ParagraphStyle('h2', fontName='ConfloraBold', fontSize=17, leading=22, spaceBefore=14, spaceAfter=12, textColor=GREEN, keepWithNext=True),
    'h3': ParagraphStyle('h3', fontName='ConfloraBold', fontSize=12, leading=16, spaceBefore=12, spaceAfter=8, textColor=GREEN, keepWithNext=True),
    'cell': ParagraphStyle('cell', fontName='Conflora', fontSize=9, leading=12, alignment=TA_LEFT),
    'list': ParagraphStyle('list', fontName='Conflora', fontSize=10, leading=14.5, leftIndent=21, firstLineIndent=-18, spaceAfter=7),
}

def inline(text):
    text = escape(text.replace('\u2011', '-').replace('—', '-').replace('–', '-'))
    text = re.sub(r'\*\*([^*]+)\*\*', r'<b>\1</b>', text)
    return re.sub(r'`([^`]+)`', r'<font color="#155332">\1</font>', text)

def paragraph(text, style='body'):
    return Paragraph(inline(text), styles[style])

story = [paragraph('Conflora Horta e Viveiro', 'h1'), paragraph('Manual da equipe', 'h2'), paragraph('Operação por função - versão de 18/10/2026'), Spacer(1, 18)]
for title, detail in [
    ('Administrador e dono', 'Equipe, catálogo, importação, aprovações, gestão e fechamento.'),
    ('Caixa', 'Vendas, pagamentos, conferência do Pix e recebimentos.'),
    ('Vendedor', 'Montagem de pedidos, identificação e encaminhamento.'),
    ('Entregador', 'Separação, saída, atendimento e conclusão.'),
    ('Responsável pelo estoque', 'Entradas, perdas, contagem e preços.'),
    ('Orientação ao cliente', 'Compra, acompanhamento e envio de comprovante.'),
]:
    story.append(KeepTogether([paragraph(title, 'h3'), paragraph(detail)]))
story.extend([Spacer(1, 22), paragraph('Antes de operar', 'h3'), paragraph('Este guia descreve a versão preparada com Pix manual. A nova interface precisa estar publicada e o catálogo atualizado precisa ser importado antes do início da operação. A integração automática depende da habilitação e homologação com o Sicredi.'), PageBreak()])
lines = (ROOT / 'docs/MANUAL-EQUIPE-CONFLORA.md').read_text(encoding='utf-8').splitlines()
width = A4[0] - 88
table_rows = []

def flush_table():
    if not table_rows:
        return
    count = len(table_rows[0])
    if count == 2:
        widths = [width * 0.31, width * 0.69]
    else:
        widths = [width / count] * count
    table = Table([[paragraph(cell, 'cell') for cell in row] for row in table_rows], colWidths=widths, repeatRows=1, hAlign='LEFT')
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e8f1eb')),
        ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#cfded3')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8), ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 7), ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
    ]))
    story.extend([table, Spacer(1, 12)])
    table_rows.clear()

for line in lines:
    if line.startswith('# '):
        continue
    if line.startswith('|'):
        if not re.match(r'^\|[\s|:-]+\|$', line):
            table_rows.append([cell.strip() for cell in line.strip('|').split('|')])
        continue
    flush_table()
    if not line.strip():
        continue
    if line.startswith('## '):
        text = line[3:]
        if re.match(r'^(3|4|5|6|7|8|9|11)\.', text):
            story.append(PageBreak())
        story.append(paragraph(text, 'h2'))
    elif line.startswith('### '):
        story.append(paragraph(line[4:], 'h3'))
    elif re.match(r'^\d+\. ', line):
        story.append(paragraph(line, 'list'))
    else:
        story.append(paragraph(line))
flush_table()

def decorate(canvas, doc):
    canvas.saveState()
    canvas.setFont('Conflora', 8)
    canvas.setFillColor(GREEN)
    canvas.drawString(44, A4[1] - 28, 'CONFLORA | Manual da equipe')
    canvas.setStrokeColor(colors.HexColor('#d8e4db'))
    canvas.line(44, 34, A4[0] - 44, 34)
    canvas.drawString(44, 22, 'Operação com Pix manual | 18/10/2026')
    canvas.drawRightString(A4[0] - 44, 22, str(doc.page))
    canvas.restoreState()

document = SimpleDocTemplate(str(OUTPUT), pagesize=A4, leftMargin=44, rightMargin=44, topMargin=48, bottomMargin=48, title='Manual da equipe Conflora', author='Conflora Horta e Viveiro')
document.build(story, onFirstPage=decorate, onLaterPages=decorate)
print(str(OUTPUT))
