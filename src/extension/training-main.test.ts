import { JSDOM } from 'jsdom';
import { describe, expect, it, vi } from 'vitest';
import { applyTrainingLookup, applyTrainingValues, startTrainingMain } from './training-main';
import {
  attachmentButtonId, attachmentDialog, decodeCommand, fieldSuffix, requestEvent, responseEvent,
  trainingRootId, uploadCompleteEvent, uploadFileKey, type FormField, type FormValues,
} from './training-form';

function setup() {
  const { window } = new JSDOM('<main></main>');
  const root = window.document.querySelector('main')!;
  root.id = trainingRootId;
  const bound: FormValues = {};
  const wrappers = {} as Record<FormField, HTMLElement>;
  const controls = {} as Record<FormField, { set_value(value: string | number): void }>;
  for (const [key, suffix] of Object.entries(fieldSuffix)) {
    const field = key as FormField;
    const wrapper = window.document.createElement('div');
    const input = window.document.createElement('input');
    wrapper.id = root.id + '_div_url_' + suffix;
    wrapper.append(input);
    root.append(wrapper);
    const date = field === 'begin' || field === 'end';
    let value: unknown = date || field === 'content' ? null : '0';
    input.value = date ? '    -  -      ' : field === 'content' ? '' : '0';
    const control = {
      get value() { return value; },
      get text() { return input.value; },
      set_value(assigned: string | number) {
        value = date ? { nativeCalendar: true } : assigned;
        bound[field] = assigned;
        const text = String(assigned);
        input.value = date ? `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6)}` : text;
        if (field === 'actualHours') controls.recognizedHours.set_value(assigned);
        if (field === 'actualMinutes') controls.recognizedMinutes.set_value(assigned);
      },
    };
    Object.assign(wrapper, {
      _linked_element: { linkedcontrol: control },
      getClientRects: () => [new window.DOMRect(0, 0, 100, 20)],
    });
    wrappers[field] = wrapper;
    controls[field] = control;
  }
  return { root, bound, wrappers, controls };
}

function activeFrame() {
  const { window } = new JSDOM('<main></main>');
  const doc = window.document;
  const root = doc.querySelector('main')!;
  root.id = trainingRootId;
  root.getClientRects = () => [new window.DOMRect(0, 0, 100, 20)] as unknown as DOMRectList;
  root.append(Object.assign(doc.createElement('button'), { id: attachmentButtonId }));
  const frame = {
    document: doc,
    location: new URL('https://knue.korus.ac.kr/cm/NUSS_UI/indexForSTD.html'),
    top: { location: new URL('https://knue.korus.ac.kr/poc/mi/IndxCtr/indx.do#cmd=menu&mId=HRPFA1500101') },
  } as unknown as Window;
  return { window, doc, root, frame };
}

const distinct = { actualHours: 3, actualMinutes: 10, recognizedHours: 2, recognizedMinutes: 45 };

describe('Nexacro training binding', () => {
  it('writes masked dates and separate durations through native binding despite automatic mirroring', () => {
    const { root, bound } = setup();
    const values = { ...distinct, begin: '20310203', end: '20310304' };
    expect(applyTrainingValues(root, values)).toHaveLength(6);
    expect(bound).toEqual(values);
  });

  it('recognizes current mirror values as applied when both requested durations agree', () => {
    const { root, bound } = setup();
    const values = { actualHours: 2, actualMinutes: 45, recognizedHours: 2, recognizedMinutes: 45 };
    expect(applyTrainingValues(root, values)).toEqual(Object.keys(values));
    expect(bound).toEqual(values);
  });

  it('preserves an existing recognition pair even when actual values are blank', () => {
    const { root, bound, controls } = setup();
    controls.recognizedHours.set_value(1);
    controls.recognizedMinutes.set_value(20);
    expect(applyTrainingValues(root, distinct)).toEqual([]);
    expect(bound).toEqual({ recognizedHours: 1, recognizedMinutes: 20 });
  });

  it('preserves intentionally edited zero and a pending uncommitted DOM input', () => {
    const { root, bound, wrappers } = setup();
    wrappers.actualMinutes.querySelector('input')!.value = '40';
    expect(applyTrainingValues(root, distinct, new Set([wrappers.recognizedHours]))).toEqual([]);
    expect(bound).toEqual({});
  });

  it('preserves dates and long content when they would overwrite or truncate a draft', () => {
    const { root, bound, wrappers, controls } = setup();
    controls.begin.set_value('20310101');
    wrappers.content.querySelector('input')!.maxLength = 4;
    expect(applyTrainingValues(root, { begin: '20310203', end: '20310304', content: '가상실습교육' })).toEqual([]);
    expect(bound).toEqual({ begin: '20310101' });
  });

  it('rejects unknown writes and malformed scalar values at the MAIN world boundary', () => {
    for (const values of [
      { classification: '가상분류' }, { begin: '20310229' }, { recognizedMinutes: 60 }, { actualHours: '3' },
    ]) expect(decodeCommand(JSON.stringify({ kind: 'fill', values }))).toBeUndefined();
    expect(decodeCommand(JSON.stringify({ kind: 'fill', values: distinct }))).toEqual({ kind: 'fill', values: distinct });
  });

  it('requires a unique visible native file dialog, matching title and input signature', () => {
    const { window } = new JSDOM(`
      <div class="ui-dialog" role="dialog" aria-labelledby="title">
        <span id="title">파일관리</span><input id="files" type="file" name="files[]" multiple>
      </div>`);
    const { document } = window;
    const dialog = document.querySelector<HTMLElement>('.ui-dialog')!;
    dialog.getClientRects = () => [new window.DOMRect(0, 0, 100, 20)] as unknown as DOMRectList;
    expect(attachmentDialog(document)?.input).toBe(document.querySelector('#files'));
    document.getElementById('title')!.textContent = '가상 파일 창';
    expect(attachmentDialog(document)).toBeUndefined();
  });

  it('applies only allowed classification codes through the active form bridge and verifies native readback', () => {
    const { window, doc, root, frame } = activeFrame();
    const combos = {
      learningMethod: ['cbo_edcFomCode', 'NHRF0049N00020', 'NHRF0049N00030', 'NHRF0049N00040'],
      learningCategory: ['cbo_lrnKndCode', 'NHRF0048N00020', 'NHRF0048N00820'],
      institutionCategory: ['cbo_edctrSeCode', 'NHRF0025N00100', 'NHRF0025N00030', 'NHRF0025N00070'],
      workHoursCategory: ['cbo_edcTimeSeCode', 'NHRF0043N00010', 'NHRF0043N00020'],
      domesticForeign: ['cbo_hbrdSeCode', 'NFIA0051N00010', 'NFIA0051N00020'],
      internalExternal: ['cbo_schioSeCode', 'NARA0027N00010', 'NARA0027N00020'],
      jobRelevance: ['cbo_dtyRelateAt', '1', '2'],
    } as const;
    const controls = Object.entries(combos).map(([field, [suffix, ...codes]]) => {
      const wrapper = doc.createElement('div');
      let value = codes[1] as string;
      const set = vi.fn((code: string) => { value = code; });
      Object.assign(wrapper, {
        id: `${root.id}_div_url_${suffix}`,
        getClientRects: root.getClientRects,
        _linked_element: { linkedcontrol: { get_value: () => value, getInnerDataset: () => ({}), set_value: set } },
      });
      root.append(wrapper);
      return { field, codes, set, getValue: () => value };
    });
    startTrainingMain(frame);
    const reply = vi.fn((event: Event) => JSON.parse((event as CustomEvent<string>).detail));
    root.addEventListener(responseEvent, reply);
    const send = (field: string, value: string) => root.dispatchEvent(new window.CustomEvent(requestEvent, {
      bubbles: true, detail: JSON.stringify({ kind: 'select', field, value }),
    }));
    for (const { field, codes, set, getValue } of controls) {
      for (const code of codes) {
        send(field, code);
        expect(reply).toHaveLastReturnedWith({ kind: 'select', field, value: code, applied: true });
        expect(getValue()).toBe(code);
      }
      expect(set.mock.calls).toEqual(codes.map(code => [code]));
    }
    reply.mockClear();
    send('learningMethod', combos.domesticForeign[1]);
    send('jobRelevance', 'Y');
    send('constructor', combos.domesticForeign[1]);
    expect(reply).not.toHaveBeenCalled();

    const [method] = controls;
    method.set.mockImplementationOnce(() => {});
    send(method.field, method.codes[0]);
    expect(reply).toHaveLastReturnedWith({ kind: 'select', field: method.field, value: method.codes[0], applied: false });

    root.append(Object.assign(doc.createElement('div'), {
      id: 'synthetic_NHRHFA005_01_form', getClientRects: root.getClientRects,
    }));
    send(method.field, method.codes[0]);
    expect(reply).toHaveLastReturnedWith({ kind: 'select', field: method.field, value: method.codes[0], applied: false });
    expect(method.set).toHaveBeenCalledTimes(4);
  });

  it('reports only successful uploads for the current training file dialog', () => {
    const { window, doc, root, frame } = activeFrame();
    const popup = Object.assign(doc.createElement('div'), { className: 'ui-dialog', getClientRects: root.getClientRects });
    popup.setAttribute('role', 'dialog');
    popup.innerHTML = '<span class="ui-dialog-title">파일관리</span><input id="files" type="file" name="files[]" multiple>';
    doc.body.append(popup);
    type Handler = (event: object, request: object, settings: { url: string; type: string; data: FormData }, result?: object) => void;
    const hooks = new Map<string, Handler>();
    Object.assign(frame, { jQuery: () => ({ on: (type: string, handler: Handler) => hooks.set(type, handler) }) });
    const listeners = vi.spyOn(doc, 'addEventListener');
    startTrainingMain(frame);
    const capture = listeners.mock.calls.find(([type]) => type === 'change')?.[1] as EventListener;
    capture({ target: popup.querySelector('input'), isTrusted: true } as unknown as Event);
    listeners.mockRestore();
    const report = vi.fn((event: Event) => JSON.parse((event as CustomEvent<string>).detail));
    root.addEventListener(uploadCompleteEvent, report);
    const file = new window.File(['PDF fixture'], 'certificate.pdf');
    const data = new window.FormData();
    data.append('files[]', file);
    const settings = { url: '/cm/c/cm/FileCtr/uploadFiles.do', type: 'POST', data };
    const started = hooks.get('ajaxSend.korusTrainingUpload')!;
    const completed = hooks.get('ajaxSuccess.korusTrainingUpload')!;
    const success = { rows: { attfgNo: 'fixture' } };
    const other = {};
    started({}, other, { ...settings, url: 'https://example.invalid/cm/c/cm/FileCtr/uploadFiles.do' });
    completed({}, other, settings, success);
    const failed = {};
    started({}, failed, settings);
    completed({}, failed, settings, { ...success, success: false });
    const accepted = {};
    started({}, accepted, settings);
    expect(report).not.toHaveBeenCalled();
    completed({}, accepted, settings, success);
    completed({}, accepted, settings, success);
    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveLastReturnedWith([uploadFileKey(file)]);
    const closed = {};
    started({}, closed, settings);
    popup.remove();
    completed({}, closed, settings, success);
    expect(report).toHaveBeenCalledTimes(1);
  });

  it.each([true, false])('enters a course directly without search (generic row preselected: %s)', async preselected => {
    const { window, doc, root, frame } = activeFrame();
    const popup = Object.assign(doc.createElement('div'), {
      id: 'synthetic_NHRHFA005_01_form', getClientRects: root.getClientRects,
    });
    function bind(parent: HTMLElement, suffix: string, control: object) {
      const wrapper = Object.assign(doc.createElement('div'), {
        id: `${parent.id}_div_url_${suffix}`, _linked_element: { linkedcontrol: control },
      });
      parent.append(wrapper);
      return wrapper;
    }
    let saved = '';
    bind(root, 'edt_crsecNm', { get_value: () => saved });
    bind(root, 'btn_crsecNm', { click: () => doc.body.append(popup) });
    const search = vi.fn();
    const query = vi.fn();
    bind(popup, 'View_VM00024466_btn_0', { click: search });
    bind(popup, 'edt_crsecNm', { set_value: query });
    const direct = doc.createElement('input');
    direct.disabled = !preselected;
    const set = vi.fn((value: string) => { direct.value = value; });
    bind(popup, 'edt_inputCrsecNm', { get_value: () => direct.value, set_value: set }).append(direct);
    const confirm = vi.fn(() => { saved = direct.value; popup.remove(); });
    bind(popup, 'View_VM00024467_btn_0', { click: confirm });
    const generic = Object.assign(doc.createElement('div'), {
      id: `${popup.id}_div_url_grd_list_body_gridrow_0_1GridCellTextContainerElement`,
      textContent: '기타교육과정',
      getClientRects: root.getClientRects,
      getBoundingClientRect: () => new window.DOMRect(0, 0, 100, 20),
    });
    const select = vi.fn(() => { direct.disabled = false; });
    generic.addEventListener('click', select);
    popup.append(generic);

    expect(await applyTrainingLookup(frame, root, 'course', '가상 과정명', new AbortController())).toBe(true);
    expect(select).toHaveBeenCalledTimes(preselected ? 0 : 1);
    expect(set).toHaveBeenCalledExactlyOnceWith('가상 과정명');
    expect(confirm).toHaveBeenCalledOnce();
    expect(search).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
    expect(saved).toBe('가상 과정명');
  });
});
