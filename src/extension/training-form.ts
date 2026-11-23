import { compactDate } from './training-date';

export const trainingRootId = 'mainframe_FrameSet0_HRPFA1500101_NHRPFA013_01_form';
export const attachmentButtonId = trainingRootId + '_div_url_btn_attfgNo_search';
const origin = 'https://knue.korus.ac.kr';

export const requestEvent = 'korus-toolkit:training-request';
export const responseEvent = 'korus-toolkit:training-response';
export const uploadCompleteEvent = 'korus-toolkit:training-upload-complete';

export function uploadFileKey(file: Pick<File, 'name' | 'size'>): string {
  return JSON.stringify([file.name, file.size]);
}

export const fieldSuffix = {
  begin: 'cal_edcBeginDe',
  end: 'cal_edcEndDe',
  actualHours: 'edt_acmsltHour',
  actualMinutes: 'edt_acmsltMinute',
  recognizedHours: 'edt_rcognHour',
  recognizedMinutes: 'edt_rcognMinute',
  content: 'edt_edcCn',
} as const;

export type FormField = keyof typeof fieldSuffix;
export type FormValues = Partial<Record<FormField, string | number>>;
export const lookupSuffix = {
  course: '_NHRHFA005_01_form',
  institution: '_NHRPFA007_01_form',
} as const;
export type LookupField = keyof typeof lookupSuffix;

export const classifications = {
  learningMethod: {
    suffix: 'cbo_edcFomCode', label: '학습방법',
    options: [['집합', 'NHRF0049N00020'], ['사이버', 'NHRF0049N00030'], ['집합+사이버', 'NHRF0049N00040']],
  },
  learningCategory: {
    suffix: 'cbo_lrnKndCode', label: '학습종류',
    options: [['기관주관 사이버교육', 'NHRF0048N00020'], ['개인학습 기타', 'NHRF0048N00820']],
  },
  institutionCategory: {
    suffix: 'cbo_edctrSeCode', label: '교육기관구분',
    options: [['공무원교육기관', 'NHRF0025N00100'], ['직장교육', 'NHRF0025N00030'], ['개인학습', 'NHRF0025N00070']],
  },
  workHoursCategory: {
    suffix: 'cbo_edcTimeSeCode', label: '업무시간구분',
    options: [['업무시간', 'NHRF0043N00010'], ['업무시간외', 'NHRF0043N00020']],
  },
  domesticForeign: {
    suffix: 'cbo_hbrdSeCode', label: '국내외구분',
    options: [['국내', 'NFIA0051N00010'], ['국외', 'NFIA0051N00020']],
  },
  internalExternal: {
    suffix: 'cbo_schioSeCode', label: '교내외구분',
    options: [['교내', 'NARA0027N00010'], ['교외', 'NARA0027N00020']],
  },
  jobRelevance: {
    suffix: 'cbo_dtyRelateAt', label: '직무관계여부',
    options: [['Y', '1'], ['N', '2']],
  },
} as const;
export type ClassificationField = keyof typeof classifications;

export type TrainingCommand =
  | { kind: 'fill'; values: FormValues }
  | { kind: 'lookup'; field: LookupField; value: string }
  | { kind: 'select'; field: ClassificationField; value: string }
  | { kind: 'cancel' };

export function isTrainingFrame(frame: Window): boolean {
  try {
    return frame.location.origin === origin && frame.location.pathname === '/cm/NUSS_UI/indexForSTD.html';
  } catch {
    return false;
  }
}

export function isTrainingMenu(frame: Window): boolean {
  try {
    const top = frame.top?.location;
    if (!top || frame === frame.top || top.origin !== origin || top.pathname !== '/poc/mi/IndxCtr/indx.do') return false;
    const params = new URLSearchParams(top.hash.slice(1));
    return params.get('cmd') === 'menu' && params.get('mId') === 'HRPFA1500101';
  } catch {
    return false;
  }
}

export function isVisible(element: HTMLElement): boolean {
  return element.isConnected && element.getClientRects().length > 0 &&
    element.ownerDocument.defaultView?.getComputedStyle(element).visibility === 'visible';
}

export function getTrainingRoot(frame: Window): HTMLElement | undefined {
  if (!isTrainingFrame(frame) || !isTrainingMenu(frame)) return undefined;
  const roots = frame.document.querySelectorAll<HTMLElement>(`[id="${trainingRootId}"]`);
  const root = roots[0];
  return roots.length === 1 && isVisible(root) && root.querySelector(`[id="${attachmentButtonId}"]`) ? root : undefined;
}

export function formControl(root: HTMLElement, suffix: string): HTMLElement | null {
  return root.querySelector<HTMLElement>(`[id="${root.id}_div_url_${suffix}"]`);
}

export function attachmentDialog(doc: Document): { dialog: HTMLElement; input: HTMLInputElement } | undefined {
  const dialogs = [...doc.querySelectorAll<HTMLElement>('.ui-dialog[role="dialog"]')].filter(dialog => {
    const title = doc.getElementById(dialog.getAttribute('aria-labelledby') ?? '') ??
      dialog.querySelector('.ui-dialog-title');
    return title?.textContent?.trim() === '파일관리' && isVisible(dialog);
  });
  if (dialogs.length !== 1) return undefined;
  const inputs = dialogs[0].querySelectorAll<HTMLInputElement>('input#files[type="file"][name="files[]"][multiple]');
  return inputs.length === 1 ? { dialog: dialogs[0], input: inputs[0] } : undefined;
}

export function hasTrainingDialog(doc: Document): boolean {
  if (attachmentDialog(doc)) return true;
  return Object.values(lookupSuffix).some(suffix =>
    [...doc.querySelectorAll<HTMLElement>(`[id$="${suffix}"]`)].some(isVisible));
}

function validText(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim() === value && value.length > 0 &&
    value.length <= max && !/[\p{Cc}\p{Cf}]/u.test(value);
}

function validField(field: FormField, value: unknown): boolean {
  if (field === 'content') return validText(value, 1000);
  if (field === 'begin' || field === 'end') {
    if (typeof value !== 'string' || !/^\d{8}$/u.test(value)) return false;
    return compactDate(value.slice(0, 4), value.slice(4, 6), value.slice(6)) === value;
  }
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 &&
    value <= (field.endsWith('Minutes') ? 59 : 999);
}

export function decodeCommand(detail: unknown): TrainingCommand | undefined {
  if (typeof detail !== 'string' || detail.length > 4096) return undefined;
  try {
    const command = JSON.parse(detail);
    if (!command || typeof command !== 'object') return undefined;
    if (command.kind === 'cancel') return { kind: 'cancel' };
    if (command.kind === 'lookup' && (command.field === 'course' || command.field === 'institution') &&
      validText(command.value, command.field === 'course' ? 200 : 100)) return command;
    if (command.kind === 'select' && typeof command.field === 'string' && Object.hasOwn(classifications, command.field)) {
      const field = command.field as ClassificationField;
      const value: unknown = command.value;
      if (typeof value === 'string' && classifications[field].options.some(([, code]) => code === value)) {
        return { kind: 'select', field, value };
      }
    }
    if (command.kind !== 'fill' || !command.values || typeof command.values !== 'object' ||
      Array.isArray(command.values)) return undefined;
    const values: FormValues = {};
    for (const [field, value] of Object.entries(command.values)) {
      const key = field as FormField;
      if (!Object.hasOwn(fieldSuffix, field) || !validField(key, value)) return undefined;
      values[key] = value as string | number;
    }
    return { kind: 'fill', values };
  } catch {
    return undefined;
  }
}
