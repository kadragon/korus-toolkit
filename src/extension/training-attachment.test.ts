import { JSDOM } from 'jsdom';
import { expect, it, vi } from 'vitest';
import { observeTrainingAttachment } from './training-attachment';
import {
  attachmentButtonId, decodeCommand, requestEvent, responseEvent, trainingRootId, uploadCompleteEvent, uploadFileKey,
} from './training-form';

it.each([
  { parsed: true, multiple: false },
  { parsed: false, multiple: false },
  { parsed: true, multiple: true },
])('handles confirmed files before keeping panel choices available (parse: $parsed, multiple: $multiple)', async ({ parsed, multiple }) => {
  const { window } = new JSDOM(`<main id="${trainingRootId}"><button id="${attachmentButtonId}"></button></main>`);
  const doc = window.document;
  const root = doc.querySelector('main')!;
  const visible = () => [new window.DOMRect(0, 0, 100, 20)] as unknown as DOMRectList;
  root.getClientRects = visible;
  const title = doc.createElement('div');
  title.id = trainingRootId + '_stc_titlebar';
  title.textContent = '상시학습 신청';
  title.getBoundingClientRect = () => new window.DOMRect(0, 0, 190, 44);
  root.append(title);
  const frame = {
    document: doc,
    location: new URL('https://knue.korus.ac.kr/cm/NUSS_UI/indexForSTD.html'),
    top: { location: new URL('https://knue.korus.ac.kr/poc/mi/IndxCtr/indx.do#cmd=menu&mId=HRPFA1500101'), addEventListener() {} },
  } as unknown as Window;
  const listeners = vi.spyOn(window.EventTarget.prototype, 'addEventListener');
  // Invoke the registered listeners with explicit trust. JSDOM only dispatches untrusted user events.
  const trusted = (node: EventTarget, type: string, target: EventTarget = node) => {
    const index = listeners.mock.calls.findIndex(([name], i) => name === type && listeners.mock.contexts[i] === node);
    expect(index).toBeGreaterThanOrEqual(0);
    const handler = listeners.mock.calls[index][1] as EventListener;
    return handler({ type, target, isTrusted: true } as Event);
  };
  const send = vi.fn((event: Event) => {
    const command = decodeCommand((event as CustomEvent<string>).detail);
    if (command?.kind === 'select') {
      root.dispatchEvent(new window.CustomEvent(responseEvent, {
        detail: JSON.stringify({ ...command, applied: command.value !== 'NHRF0049N00040' }),
      }));
    }
  });
  root.addEventListener(requestEvent, send);
  const read = vi.fn(async (_file: Pick<File, 'arrayBuffer' | 'size'>) => {
    if (!parsed) throw new Error('Synthetic parse failure');
    return { course: '가상 과정명', institution: '가상 교육기관' };
  });
  observeTrainingAttachment(frame, read);
  expect(root.textContent).toContain('PDF 이수증을 업로드하면 자동으로 분석합니다.');
  trusted(doc, 'pointerdown', doc.getElementById(attachmentButtonId)!);

  const dialog = doc.createElement('div');
  dialog.className = 'ui-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.getClientRects = visible;
  dialog.innerHTML = '<span class="ui-dialog-title">파일관리</span><input id="files" type="file" name="files[]" multiple>';
  const input = dialog.querySelector('input')!;
  const file = new window.File(['fixture'], 'fixture.pdf');
  const other = new window.File(['notes'], multiple ? 'second.pdf' : 'notes.txt');
  Object.defineProperty(input, 'files', { value: [other, file] });
  doc.body.append(dialog);
  trusted(doc, 'change', input);
  const completed = (keys: string[]) => root.dispatchEvent(new window.CustomEvent(uploadCompleteEvent, {
    detail: JSON.stringify(keys),
  }));
  completed([uploadFileKey({ name: 'different.pdf', size: file.size })]);
  completed([uploadFileKey(other)]);
  completed([uploadFileKey(file)]);
  completed([uploadFileKey(file)]);
  expect(read).not.toHaveBeenCalled();
  expect(!!doc.querySelector('section')).toBe(false);
  dialog.remove();
  await new Promise((resolve) => setTimeout(resolve, 0));
  const panel = doc.querySelector('section')!;
  expect(panel.hidden).toBe(false);
  if (multiple) {
    expect(read).not.toHaveBeenCalled();
    expect(panel.textContent).toContain('자동 입력할 PDF를 하나만 선택하세요.');
  } else {
    expect(read).toHaveBeenCalledTimes(1);
    expect(read.mock.calls[0][0]).toBe(file);
  }
  const groups = [...panel.querySelectorAll('[role="group"]')];
  expect(groups.map(group => group.getAttribute('aria-label'))).toEqual([
    '학습방법', '학습종류', '교육기관구분', '업무시간구분', '국내외구분', '교내외구분', '직무관계여부',
  ]);
  expect(groups.map(group => [...group.querySelectorAll('button')].map(button => button.textContent))).toEqual([
    ['집합', '사이버', '집합+사이버'], ['기관주관 사이버교육', '개인학습 기타'],
    ['공무원교육기관', '직장교육', '개인학습'], ['업무시간', '업무시간외'],
    ['국내', '국외'], ['교내', '교외'], ['Y', 'N'],
  ]);
  const panelButtons = [...panel.querySelectorAll('button')];
  if (parsed && !multiple) {
    expect(panelButtons.map(button => button.textContent).slice(1, 5)).toEqual([
      '자동입력하기', '복사', '교육기관 조회 및 입력', '복사',
    ]);
  }
  const [first, second, failing] = groups[0].querySelectorAll('button');
  expect(panel.querySelector('[aria-pressed="true"]')).toBeNull();
  send.mockClear();
  expect(first.disabled).toBe(false);
  first.click();
  expect(send).not.toHaveBeenCalled();
  trusted(first, 'click');
  expect(first.getAttribute('aria-pressed')).toBe('true');
  trusted(second, 'click');
  trusted(failing, 'click');
  expect([...panel.querySelectorAll('[aria-pressed="true"]')]).toEqual([second]);
  expect(groups[0].querySelector('[role="status"]')?.textContent).toBe('선택을 반영하지 못했습니다.');

  for (const [group, field, codes] of [
    [groups[1], 'learningCategory', ['NHRF0048N00020', 'NHRF0048N00820']],
    [groups[2], 'institutionCategory', ['NHRF0025N00100', 'NHRF0025N00030', 'NHRF0025N00070']],
    [groups[3], 'workHoursCategory', ['NHRF0043N00010', 'NHRF0043N00020']],
    [groups[6], 'jobRelevance', ['1', '2']],
  ] as const) {
    for (const [index, button] of [...group.querySelectorAll('button')].entries()) {
      trusted(button, 'click');
      const [event] = send.mock.lastCall!;
      expect(JSON.parse((event as CustomEvent<string>).detail)).toEqual({ kind: 'select', field, value: codes[index] });
      expect([...group.querySelectorAll('[aria-pressed="true"]')]).toEqual([button]);
    }
  }

  if (parsed && !multiple) {
    trusted(panelButtons[1], 'click');
    expect(first.disabled).toBe(true);
    root.dispatchEvent(new window.CustomEvent(responseEvent, {
      detail: JSON.stringify({ kind: 'lookup', field: 'course', applied: false }),
    }));
    expect(first.disabled).toBe(false);
    expect(panel.textContent).toContain('코러스에서 직접 입력');
  }
  trusted(panelButtons[0], 'click');
  listeners.mockRestore();
  window.close();
});
