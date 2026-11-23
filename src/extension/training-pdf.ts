import { getDocument, VerbosityLevel } from 'pdfjs-dist';
// Registers PDF.js's local in-process handler in this isolated world.
import 'pdfjs-dist/build/pdf.worker.mjs';

import { parseTrainingCertificate, type TrainingCertificate } from './training-certificate';

interface PositionedText {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

function textLines(items: readonly PositionedText[]): string[] {
  const ordered = items.filter(item => item.str.trim()).sort((a, b) =>
    b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4],
  );
  const rows: PositionedText[][] = [];
  for (const item of ordered) {
    const row = rows.at(-1);
    if (row && Math.abs(row[0].transform[5] - item.transform[5]) <= 2) {
      row.push(item);
    } else {
      rows.push([item]);
    }
  }
  return rows.map(row => {
    row.sort((a, b) => a.transform[4] - b.transform[4]);
    let line = '';
    let previousEnd = row[0].transform[4];
    for (const item of row) {
      if (item.transform[4] - previousEnd > Math.max(1, item.height * 0.12)) line += ' ';
      line += item.str;
      previousEnd = item.transform[4] + item.width;
    }
    return line;
  });
}

export async function readTrainingPdf(
  file: Pick<File, 'arrayBuffer' | 'size'>,
  signal: AbortSignal,
): Promise<TrainingCertificate> {
  // The in-process parser shares the UI thread. Keep certificate work bounded.
  if (file.size > 25 * 1024 * 1024) throw new Error('Certificate file size exceeds limit');
  const data = new Uint8Array(await file.arrayBuffer());
  signal.throwIfAborted();
  const task = getDocument({
    data,
    useWasm: false,
    useWorkerFetch: false,
    disableFontFace: true,
    verbosity: VerbosityLevel.ERRORS,
  });
  let cleanup: Promise<void> | undefined;
  const destroy = () => (cleanup ??= task.destroy().catch(() => undefined));
  const abort = () => { void destroy(); };
  signal.addEventListener('abort', abort, { once: true });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 30) throw new Error('Certificate page count exceeds limit');
    const lines: string[] = [];
    for (let index = 1; index <= pdf.numPages; index++) {
      signal.throwIfAborted();
      const page = await pdf.getPage(index);
      const { items } = await page.getTextContent();
      lines.push(...textLines(items.filter(item => 'str' in item)));
      page.cleanup();
    }
    if (!lines.length || !lines.some(line => /[\p{L}\p{N}]/u.test(line))) {
      throw new Error('Certificate has no readable text');
    }
    return parseTrainingCertificate(lines);
  } finally {
    signal.removeEventListener('abort', abort);
    await destroy();
  }
}
