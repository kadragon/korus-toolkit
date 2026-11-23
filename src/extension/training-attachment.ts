import { readTrainingPdf } from './training-pdf';
import type { TrainingCertificate } from './training-certificate';
import { trainingPanelStyle } from './training-panel-style';
import {
  attachmentButtonId, attachmentDialog, classifications, getTrainingRoot, hasTrainingDialog, isTrainingFrame,
  isTrainingMenu, requestEvent, responseEvent, uploadCompleteEvent, uploadFileKey,
  type ClassificationField, type FormField, type FormValues, type LookupField, type TrainingCommand,
} from './training-form';

function formValues(certificate: TrainingCertificate): FormValues {
  const { begin, end, actual, recognized, content } = certificate;
  return {
    begin, end, content,
    actualHours: actual?.hours,
    actualMinutes: actual?.minutes,
    recognizedHours: recognized?.hours,
    recognizedMinutes: recognized?.minutes,
  };
}

function send(root: HTMLElement, command: TrainingCommand): void {
  root.dispatchEvent(new root.ownerDocument.defaultView!.CustomEvent(requestEvent, {
    bubbles: true, detail: JSON.stringify(command),
  }));
}

function requestReply(root: HTMLElement, command: Extract<TrainingCommand, { kind: 'fill' | 'select' }>) {
  let reply: ReturnType<typeof parseReply>;
  const receive = (event: Event) => {
    const response = parseReply(event);
    if (response?.kind !== command.kind || (command.kind === 'select' &&
      (response.field !== command.field || response.value !== command.value))) return;
    reply = response;
  };
  root.addEventListener(responseEvent, receive);
  try {
    send(root, command);
  } finally {
    root.removeEventListener(responseEvent, receive);
  }
  return reply;
}

function parseReply(event: Event) {
  try {
    const detail = (event as CustomEvent<unknown>).detail;
    return typeof detail === 'string' && detail.length < 4096 ? JSON.parse(detail) : undefined;
  } catch {
    return undefined;
  }
}

type LookupStatus = { button: HTMLButtonElement; status: HTMLElement; settled: boolean };

export function observeTrainingAttachment(
  frame: Window, readPdf: typeof readTrainingPdf = readTrainingPdf,
): void {
  if (!isTrainingFrame(frame)) return;
  const doc = frame.document;
  if (!doc.body) return;
  let armed: {
    root: HTMLElement;
    dialog?: HTMLElement;
    deadline: number;
    files: Map<string, File>;
    completed: Set<string>;
  } | undefined;
  let draft: HTMLElement | undefined;
  let parsing: AbortController | undefined;
  let panel: HTMLElement | undefined;
  let lookup: LookupField | undefined;
  let status: HTMLElement | undefined;
  let details: HTMLElement | undefined;
  let lookupSection: HTMLElement | undefined;
  let lookupRows: HTMLElement | undefined;
  let dialogHint: HTMLElement | undefined;
  let titleHint: HTMLElement | undefined;
  const optionButtons: HTMLButtonElement[] = [];
  const lookups: Partial<Record<LookupField, LookupStatus>> = {};

  const busy = () => !!lookup || hasTrainingDialog(doc);

  const refreshButtons = () => {
    const disabled = busy();
    if (panel) panel.hidden = !!attachmentDialog(doc);
    for (const item of Object.values(lookups)) {
      item.button.disabled = disabled || item.settled;
    }
    for (const button of optionButtons) button.disabled = disabled;
    if (dialogHint) dialogHint.hidden = !disabled || !!lookup;
  };

  const onReply = (event: Event) => {
    const reply = parseReply(event);
    if (!lookup || reply?.kind !== 'lookup' || reply.field !== lookup) return;
    const item = lookups[lookup];
    lookup = undefined;
    if (item) {
      item.settled = reply.applied === true;
      item.status.textContent = item.settled ? '입력됨' : reply.field === 'course'
        ? '자동 입력 보류 · 코러스에서 직접 입력' : '자동 선택 보류 · 코러스 조회 창에서 확인';
    }
    refreshButtons();
  };

  const clearPanel = () => {
    parsing?.abort();
    parsing = undefined;
    if (draft) {
      draft.removeEventListener(responseEvent, onReply);
      if (lookup) send(draft, { kind: 'cancel' });
    }
    draft = undefined;
    lookup = undefined;
    panel?.remove();
    panel = undefined;
    status = undefined;
    details = undefined;
    lookupSection = undefined;
    lookupRows = undefined;
    dialogHint = undefined;
    optionButtons.length = 0;
    delete lookups.course;
    delete lookups.institution;
  };

  const sync = () => {
    const root = getTrainingRoot(frame);
    if (titleHint && titleHint.parentElement !== root) {
      titleHint.remove();
      titleHint = undefined;
    }
    const title = !titleHint && root ? doc.getElementById(root.id + '_stc_titlebar') : null;
    if (root && title && root.contains(title)) {
      const rect = title.getBoundingClientRect();
      const parent = root.getBoundingClientRect();
      if (rect.width && rect.height) {
        titleHint = doc.createElement('span');
        titleHint.textContent = 'PDF 이수증을 업로드하면 자동으로 분석합니다.';
        Object.assign(titleHint.style, {
          position: 'absolute', zIndex: '1', left: `${rect.right - parent.left + 8}px`,
          top: `${rect.top - parent.top + rect.height / 2}px`, transform: 'translateY(-50%)',
          color: '#244f7d', background: '#eef5fc', borderRadius: '5px', padding: '3px 8px',
          font: '12px/1.5 system-ui, sans-serif', whiteSpace: 'nowrap', pointerEvents: 'none',
        });
        root.append(titleHint);
      }
    }
    if (armed || draft) {
      const popup = attachmentDialog(doc);
      if (armed && (root !== armed.root || (!armed.dialog && Date.now() > armed.deadline))) {
        armed = undefined;
      } else if (armed?.dialog && popup?.dialog !== armed.dialog) {
        const finished = armed;
        armed = undefined;
        if (!popup) {
          const files = [...finished.completed].flatMap(key => finished.files.get(key) ?? []);
          if (files.length) void analyzeFiles(finished.root, files);
        }
      } else if (armed && !armed.dialog && popup) {
        armed.dialog = popup.dialog;
      }
      if (draft && root !== draft) clearPanel();
      else refreshButtons();
    }
    if (!isTrainingMenu(frame)) observer.disconnect();
  };

  const observer = new (doc.defaultView!.MutationObserver)(sync);
  const watch = () => observer.observe(doc.body, {
    childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'aria-hidden'],
  });
  try {
    frame.top?.addEventListener('hashchange', () => {
      if (isTrainingMenu(frame)) watch();
      sync();
    });
  } catch {
    return;
  }
  if (isTrainingMenu(frame)) {
    watch();
    sync();
  }

  const openPanel = (root: HTMLElement) => {
    draft = root;
    root.addEventListener(responseEvent, onReply);
    panel = doc.createElement('section');
    panel.className = 'korus-training-panel';
    panel.setAttribute('aria-label', '이수증 자동 입력');
    const style = doc.createElement('style');
    style.textContent = trainingPanelStyle;
    const header = doc.createElement('header');
    header.className = 'kt-header';
    const title = doc.createElement('h2');
    title.className = 'kt-title';
    title.textContent = '이수증 자동 입력';
    const close = doc.createElement('button');
    close.type = 'button';
    close.className = 'kt-button kt-close';
    close.textContent = '결과 숨기기';
    close.addEventListener('click', clearPanel);
    header.append(title, close);

    const body = doc.createElement('div');
    body.className = 'kt-body';
    const summary = doc.createElement('div');
    summary.className = 'kt-summary';
    status = doc.createElement('div');
    status.className = 'kt-summary-status';
    status.setAttribute('role', 'status');
    details = doc.createElement('div');
    details.className = 'kt-details';
    summary.append(status, details);

    lookupSection = doc.createElement('div');
    lookupSection.className = 'kt-section';
    lookupSection.hidden = true;
    const lookupTitle = doc.createElement('h3');
    lookupTitle.className = 'kt-section-title';
    lookupTitle.textContent = '과정 및 교육기관';
    lookupRows = doc.createElement('div');
    lookupRows.className = 'kt-lookups';
    lookupSection.append(lookupTitle, lookupRows);

    const optionRows = doc.createElement('div');
    optionRows.className = 'kt-section';
    const optionTitle = doc.createElement('h3');
    optionTitle.className = 'kt-section-title';
    optionTitle.textContent = '신청 분류';
    optionRows.append(optionTitle);
    dialogHint = doc.createElement('p');
    dialogHint.className = 'kt-hint';
    dialogHint.textContent = '코러스 팝업을 닫으면 입력할 수 있습니다.';
    body.append(summary, dialogHint, lookupSection, optionRows);
    panel.append(style, header, body);
    for (const field of Object.keys(classifications) as ClassificationField[]) {
      optionRows.append(classificationRow(root, field));
    }
    doc.body.append(panel);
    refreshButtons();
    watch();
  };

  function classificationRow(root: HTMLElement, field: ClassificationField): HTMLElement {
    const { label, options } = classifications[field];
    const row = doc.createElement('div');
    row.className = field === 'learningCategory' || field === 'institutionCategory' ? 'kt-group kt-wide-group' : 'kt-group';
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', label);
    const heading = doc.createElement('span');
    heading.className = 'kt-label';
    heading.textContent = label;
    const result = doc.createElement('span');
    result.className = 'kt-choice-status';
    result.setAttribute('role', 'status');
    const choices = doc.createElement('div');
    choices.className = 'kt-choices';
    const buttons = options.map(([text, value]) => {
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'kt-button';
      button.textContent = text;
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', event => {
        if (!event.isTrusted || draft !== root || getTrainingRoot(frame) !== root || busy()) return;
        const applied = requestReply(root, { kind: 'select', field, value })?.applied === true;
        result.textContent = applied ? '' : '선택을 반영하지 못했습니다.';
        if (!applied) return;
        for (const item of buttons) {
          item.setAttribute('aria-pressed', String(item === button));
        }
      });
      return button;
    });
    optionButtons.push(...buttons);
    choices.append(...buttons);
    row.append(heading, choices, result);
    return row;
  }

  const showLookup = (root: HTMLElement, field: LookupField, label: string, value: string) => {
    const row = doc.createElement('div');
    row.className = 'kt-lookup';
    const labelAndValue = doc.createElement('div');
    labelAndValue.className = 'kt-value';
    const heading = doc.createElement('span');
    heading.className = 'kt-label';
    heading.textContent = label;
    const extracted = doc.createElement('div');
    extracted.className = 'kt-extracted';
    extracted.textContent = value;
    extracted.title = value;
    labelAndValue.append(heading, extracted);
    const actions = doc.createElement('div');
    actions.className = 'kt-actions';
    const copy = doc.createElement('button');
    copy.type = 'button';
    copy.className = 'kt-button';
    copy.textContent = '복사';
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'kt-button kt-primary';
    button.textContent = field === 'course' ? '자동입력하기' : '교육기관 조회 및 입력';
    if (field === 'course') button.setAttribute('aria-label', '과정명 자동입력하기');
    const result = doc.createElement('span');
    result.className = 'kt-lookup-status';
    result.setAttribute('role', 'status');
    copy.addEventListener('click', async event => {
      if (!event.isTrusted) return;
      try {
        await frame.navigator.clipboard.writeText(value);
        copy.textContent = '복사됨';
      } catch {
        const range = doc.createRange();
        range.selectNodeContents(extracted);
        const selection = doc.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        result.textContent = '선택한 텍스트를 복사하세요.';
      }
    });
    button.addEventListener('click', event => {
      if (!event.isTrusted || draft !== root || getTrainingRoot(frame) !== root || busy()) return;
      lookup = field;
      result.textContent = field === 'course' ? '입력 중…' : '조회 중…';
      refreshButtons();
      send(root, { kind: 'lookup', field, value });
    });
    actions.append(button, copy);
    row.append(labelAndValue, actions, result);
    lookupRows!.append(row);
    lookupSection!.hidden = false;
    lookups[field] = { button, status: result, settled: false };
  };

  const date = (value?: string) => value ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}` : '—';
  function renderCertificate(root: HTMLElement, certificate: TrainingCertificate, values: FormValues, applied: FormField[]) {
    const fields = Object.values(values).filter(value => value !== undefined).length;
    status!.textContent = fields ? `입력 ${applied.length}개 · 보류 ${fields - applied.length}개`
      : certificate.course || certificate.institution ? '입력할 항목을 확인하세요.' : '이수증에서 입력할 항목을 찾지 못했습니다.';
    const add = (line: string, duration = false) => {
      const element = doc.createElement('div');
      if (duration) element.className = 'kt-duration';
      element.textContent = line;
      details?.append(element);
    };
    if (certificate.begin || certificate.end) add(`기간 · ${date(certificate.begin)} ~ ${date(certificate.end)}`);
    if (certificate.actual) add(`실적시간 · ${certificate.actual.hours}시간 ${certificate.actual.minutes}분`, true);
    if (certificate.recognized) add(`인정시간 · ${certificate.recognized.hours}시간 ${certificate.recognized.minutes}분`, true);
    if (certificate.content) {
      const disclosure = doc.createElement('details');
      const summary = doc.createElement('summary');
      const content = doc.createElement('div');
      summary.textContent = '교육내용';
      content.textContent = certificate.content;
      disclosure.append(summary, content);
      details?.append(disclosure);
    }
    if (certificate.course) showLookup(root, 'course', '과정명', certificate.course);
    if (certificate.institution) showLookup(root, 'institution', '교육기관', certificate.institution);
    refreshButtons();
  }

  const arm = (event: Event) => {
    if (!event.isTrusted || (event.type === 'keydown' && !['Enter', ' '].includes((event as KeyboardEvent).key))) return;
    const root = getTrainingRoot(frame);
    const target = event.target as Node | null;
    if (!root || !target || !doc.getElementById(attachmentButtonId)?.contains(target) || attachmentDialog(doc)) return;
    if (armed?.root === root && !armed.dialog && Date.now() < armed.deadline) return;
    parsing?.abort();
    if (lookup) send(root, { kind: 'cancel' });
    armed = { root, deadline: Date.now() + 8000, files: new Map(), completed: new Set() };
    watch();
  };
  for (const event of ['pointerdown', 'keydown', 'click']) doc.addEventListener(event, arm, true);

  doc.addEventListener('change', event => {
    if (!event.isTrusted || !armed) return;
    const popup = attachmentDialog(doc);
    if (!popup || event.target !== popup.input) return;
    sync();
    if (!armed || popup.dialog !== armed.dialog || getTrainingRoot(frame) !== armed.root) return;
    for (const file of popup.input.files ?? []) armed.files.set(uploadFileKey(file), file);
  }, true);

  doc.addEventListener(uploadCompleteEvent, event => {
    if (!armed || event.target !== armed.root || getTrainingRoot(frame) !== armed.root) return;
    const detail = (event as CustomEvent<unknown>).detail;
    if (typeof detail !== 'string' || detail.length > 32768) return;
    let keys: unknown;
    try {
      keys = JSON.parse(detail);
    } catch {
      return;
    }
    if (!Array.isArray(keys) || !keys.every(key => typeof key === 'string')) return;
    for (const key of keys) {
      if (armed.files.has(key)) armed.completed.add(key);
    }
  }, true);

  async function analyzeFiles(root: HTMLElement, files: File[]) {
    clearPanel();
    const pdfs = files.filter(file => /\.pdf$/iu.test(file.name) || file.type === 'application/pdf');
    openPanel(root);
    if (pdfs.length !== 1) {
      status!.textContent = pdfs.length ? '자동 입력할 PDF를 하나만 선택하세요.' : '선택한 파일에 PDF가 없습니다.';
      return;
    }

    status!.textContent = '이수증을 읽는 중…';
    const controller = new AbortController();
    parsing = controller;
    const current = () => parsing === controller && !controller.signal.aborted && draft === root && getTrainingRoot(frame) === root;
    try {
      const certificate = await readPdf(pdfs[0], controller.signal);
      if (!current()) return;
      const values = formValues(certificate);
      const reply = requestReply(root, { kind: 'fill', values });
      renderCertificate(root, certificate, values, Array.isArray(reply?.applied) ? reply.applied : []);
    } catch {
      if (current()) status!.textContent = 'PDF에서 글자를 읽을 수 없습니다. 텍스트가 포함된 이수증을 선택하세요.';
    } finally {
      if (parsing === controller) parsing = undefined;
    }
  }
}

if (typeof window !== 'undefined') observeTrainingAttachment(window);
