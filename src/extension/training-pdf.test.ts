import { describe, expect, it, vi } from 'vitest';
import { readTrainingPdf } from './training-pdf';

// The Node test runtime needs PDF.js's polyfills. The extension bundles the browser build.
vi.mock('pdfjs-dist', () => vi.importActual('pdfjs-dist/legacy/build/pdf.mjs'));
vi.mock('pdfjs-dist/build/pdf.worker.mjs', () => vi.importActual('pdfjs-dist/legacy/build/pdf.worker.mjs'));

function syntheticPdf(lines: string[]): Blob {
  const characters = [...new Set(lines.join(''))];
  const hex = (text: string) => [...text].map(char => char.charCodeAt(0).toString(16).padStart(4, '0')).join('');
  const encoding = [
    '/CIDInit /ProcSet findresource begin 12 dict begin begincmap',
    '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def',
    '/CMapName /SyntheticUnicode def /CMapType 2 def',
    '1 begincodespacerange <0000> <ffff> endcodespacerange',
    `${characters.length} beginbfchar`,
    ...characters.map(char => `<${hex(char)}> <${hex(char)}>`),
    'endbfchar endcmap CMapName currentdict /CMap defineresource pop end end',
  ].join('\n');
  const stream = (text: string) => `<< /Length ${text.length} >>\nstream\n${text}\nendstream`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F 4 0 R >> >> /Contents 7 0 R >>',
    '<< /Type /Font /Subtype /Type0 /BaseFont /Synthetic /Encoding /Identity-H /DescendantFonts [5 0 R] /ToUnicode 6 0 R >>',
    '<< /Type /Font /Subtype /CIDFontType2 /BaseFont /Synthetic /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /DW 600 >>',
    stream(encoding),
    stream(lines.map((line, index) => `BT /F 12 Tf 40 ${750 - index * 20} Td <${hex(line)}> Tj ET`).join('\n')),
  ];
  let file = '%PDF-1.7\n';
  const offsets = objects.map((object, index) => {
    const offset = file.length;
    file += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  return new Blob([
    file, `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`,
    ...offsets.map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`),
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${file.length}\n%%EOF\n`,
  ], { type: 'application/pdf' });
}

describe('local PDF text extraction', () => {
  it('reads Korean text from an Identity-H PDF with a ToUnicode map', async () => {
    const certificate = syntheticPdf([
      '교육과정: 모형 조립 입문',
      '교육기간: 2031.02.03. ~ 2031.03.04.',
      '교육시간: 2시간45분',
    ]);
    await expect(readTrainingPdf(certificate, new AbortController().signal)).resolves.toMatchObject({
      course: '모형 조립 입문',
      begin: '20310203', end: '20310304',
      actual: { hours: 2, minutes: 45 }, recognized: { hours: 2, minutes: 45 },
    });
  });

  it('reports that a PDF without embedded text is unreadable', async () => {
    const certificate = syntheticPdf([]);
    await expect(readTrainingPdf(certificate, new AbortController().signal)).rejects.toThrow('no readable text');
  });
});
