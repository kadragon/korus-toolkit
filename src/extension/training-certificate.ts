import { compactDate } from './training-date';

export interface Duration {
  hours: number;
  minutes: number;
}

export interface TrainingCertificate {
  course?: string;
  institution?: string;
  begin?: string;
  end?: string;
  actual?: Duration;
  recognized?: Duration;
  content?: string;
}

const labels = {
  course: ['교육과정명', '교육과정', '과정명', '과정', '교육명', '강좌명'],
  institution: ['교육기관명', '교육기관', '연수기관', '주관기관', '운영기관'],
  issuer: ['발급기관명', '발급기관', '발급처'],
  period: ['교육기간', '학습기간', '수강기간', '이수기간', '연수기간', '기간'],
  begin: ['교육시작일', '시작일자', '시작일', '교육개시일'],
  end: ['교육종료일', '종료일자', '종료일', '교육완료일'],
  actual: ['상시학습실적시간', '교육실적시간', '학습실적시간', '실적시간', '교육시간', '이수시간', '수강시간', '교육시수'],
  recognized: ['상시학습인정시간', '학습인정시간', '인정시간', '상시학습인정시수', '인정시수'],
  content: ['교육내용', '학습내용', '연수내용'],
} as const;

const labelFields = new Map<string, keyof typeof labels>(
  Object.entries(labels).flatMap(([field, names]) => names.map(name => [name, field as keyof typeof labels] as const)),
);
const labelPattern = new RegExp(
  `(?:^|\\s)(${[...labelFields.keys()].sort((a, b) => b.length - a.length).map(name => [...name].join('\\s*')).join('|')})\\s*[:：]`,
  'gu',
);
const dateSource = String.raw`(\d{4})\s*(?:[./-]|년)\s*(\d{1,2})\s*(?:[./-]|월)\s*(\d{1,2})\s*[.일]?`;
const singleDatePattern = new RegExp(`^${dateSource}$`, 'u');
const periodPattern = new RegExp(`^${dateSource}\\s*[~∼～–—-]\\s*${dateSource}$`, 'u');

function parseDate(value: string): string | undefined {
  const match = singleDatePattern.exec(value);
  return match ? compactDate(match[1], match[2], match[3]) : undefined;
}

function parsePeriod(value: string): { begin: string; end: string } | undefined {
  const match = periodPattern.exec(value);
  if (!match) return undefined;
  const begin = compactDate(match[1], match[2], match[3]);
  const end = compactDate(match[4], match[5], match[6]);
  return begin && end && begin <= end ? { begin, end } : undefined;
}

function parseDuration(value: string): Duration | undefined {
  const match = /^(?:(\d{1,3})\s*시\s*간)?\s*(?:(\d{1,4})\s*분)?$/u.exec(value);
  if (!match || (!match[1] && !match[2])) return undefined;
  const minutes = Number(match[2] ?? 0);
  const hours = Number(match[1] ?? 0) + Math.floor(minutes / 60);
  return hours <= 999 && (hours > 0 || minutes > 0) ? { hours, minutes: minutes % 60 } : undefined;
}

function cleanText(value: string): string {
  return value.replace(/[\p{Cc}\p{Cf}\s]+/gu, ' ').trim();
}

function nameKey(value: string): string {
  return value.replace(/\s+/gu, '');
}

function inferIssuer(lines: readonly string[]): string | undefined {
  const sentence = lines.join(' ');
  const award = /위\s*사\s*람\s*은\s*([\p{L}\p{N}()·\s]{2,80}?)\s*에\s*서/u.exec(sentence)?.[1]?.trim();
  const signers = lines.flatMap(line => {
    const match = /^([\p{L}()·\s]{2,60}?(?:기관|센터|대학|학교|위원회|협회|원|회|청))\s*장$/u.exec(line);
    return match ? [match[1].trim()] : [];
  });
  const matches = [...new Set(signers.filter(signer => !award || nameKey(award).endsWith(nameKey(signer))))];
  return matches.length === 1 ? matches[0] : award;
}

/** Interpret labeled certificate fields independently. Conflicting explicit values are left blank. */
export function parseTrainingCertificate(rawLines: readonly string[]): TrainingCertificate {
  const lines = rawLines.map(cleanText).filter(Boolean);
  const values = new Map<keyof typeof labels, string[]>();
  for (const [lineIndex, line] of lines.entries()) {
    const matches = [...line.matchAll(labelPattern)];
    for (const [matchIndex, match] of matches.entries()) {
      const field = labelFields.get(nameKey(match[1]))!;
      const next = matches[matchIndex + 1];
      const rest = line.slice(match.index + match[0].length, next?.index).trim();
      const following = lines[lineIndex + 1];
      const value = rest || (!next && following && ![...following.matchAll(labelPattern)].length ? following : '');
      const previous = values.get(field) ?? [];
      previous.push(value);
      values.set(field, previous);
    }
  }

  function unique<T>(field: keyof typeof labels, parse: (value: string) => T | undefined): T | undefined {
    const candidates = values.get(field) ?? [];
    const first = parse(candidates[0] ?? '');
    return first !== undefined && candidates.every(value => JSON.stringify(parse(value)) === JSON.stringify(first))
      ? first : undefined;
  }

  const text = (max: number) => (value: string) => value.length > 0 && value.length <= max ? value : undefined;
  const period = unique('period', parsePeriod);
  let begin = values.has('begin') ? unique('begin', parseDate) : period?.begin;
  let end = values.has('end') ? unique('end', parseDate) : period?.end;
  if (begin && end && begin > end) {
    begin = undefined;
    end = undefined;
  }
  const institution = unique('institution', text(100)) ?? unique('issuer', text(100)) ??
    (!values.has('institution') && !values.has('issuer') ? inferIssuer(lines) : undefined);
  const actual = unique('actual', parseDuration);
  const recognized = unique('recognized', parseDuration);

  return {
    course: unique('course', text(200)),
    institution,
    begin,
    end,
    actual: values.has('actual') ? actual : recognized,
    recognized: values.has('recognized') ? recognized : actual,
    content: unique('content', text(1000)),
  };
}
