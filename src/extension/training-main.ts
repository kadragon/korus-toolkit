import { observeTrainingUpload } from './training-upload';
import {
  attachmentDialog, classifications, decodeCommand, fieldSuffix, formControl, getTrainingRoot, hasTrainingDialog,
  isTrainingFrame, isVisible, lookupSuffix, requestEvent, responseEvent,
  type ClassificationField, type FormField, type FormValues, type LookupField,
} from './training-form';

interface LookupDataset {
  addEventHandler(event: 'onload', handler: LoadHandler, scope: LinkedControl): void;
  removeEventHandler(event: 'onload', handler: LoadHandler, scope: LinkedControl): void;
  getRowCount?(): number;
  getColumn?(row: number, column: string): unknown;
}
type LoadHandler = (source: unknown, event: { reason?: number; errorcode?: number }) => void;

interface LinkedControl {
  value?: unknown;
  text?: unknown;
  enable?: boolean;
  set_value?(value: string | number): void;
  get_value?(): unknown;
  click?(): void;
  getBindDataset?(): LookupDataset | undefined;
  getInnerDataset?(): unknown;
}

function linkedControl(wrapper: HTMLElement | null): LinkedControl | undefined {
  return (wrapper as (HTMLElement & {
    _linked_element?: { linkedcontrol?: LinkedControl };
  }) | null)?._linked_element?.linkedcontrol;
}

function modelValue(control: LinkedControl): unknown {
  return typeof control.get_value === 'function' ? control.get_value() : control.value;
}

function empty(value: unknown): boolean {
  return value == null || value === '';
}

const editableInputs = (wrapper: HTMLElement) =>
  [...wrapper.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input:not([type="hidden"]), textarea')];
const isDate = (field?: FormField) => field === 'begin' || field === 'end';

function isBlank(wrapper: HTMLElement, control: LinkedControl, field?: FormField): boolean {
  const zero = (value: unknown) => value === 0 || value === '0';
  const blankDisplay = (value: unknown) => empty(value) ||
    (isDate(field) && typeof value === 'string' && /^[-./_\s]*$/u.test(value)) ||
    (field !== undefined && (field.endsWith('Hours') || field.endsWith('Minutes')) && zero(value));
  const current = modelValue(control);
  if ((!('value' in control) && typeof control.get_value !== 'function') ||
    control.enable === false || !(isDate(field) ? empty(current) : blankDisplay(current)) ||
    !blankDisplay(control.text) ||
    wrapper.contains(wrapper.ownerDocument.activeElement)) return false;
  return editableInputs(wrapper).every(input => blankDisplay(input.value));
}

function hasValue(wrapper: HTMLElement, control: LinkedControl, field: FormField, value: string | number): boolean {
  if (wrapper.contains(wrapper.ownerDocument.activeElement)) return false;
  const current = modelValue(control);
  if (empty(current)) return false;
  if (!isDate(field)) return String(current) === String(value);
  const expected = String(value);
  const display = String(control.text ?? '').replace(/[-./\s]/gu, '');
  return String(current) === expected || display === expected;
}

const actualFields = ['actualHours', 'actualMinutes'] as const;
const recognizedFields = ['recognizedHours', 'recognizedMinutes'] as const;

interface FieldWrite {
  field: FormField;
  wrapper: HTMLElement;
  control: LinkedControl;
  value: string | number;
  vacant: boolean;
}

export function applyTrainingValues(
  root: HTMLElement, values: FormValues, edited: ReadonlySet<HTMLElement> = new Set(),
): FormField[] {
  const applied: FormField[] = [];
  function plan(fields: readonly FormField[], candidates = values): FieldWrite[] | undefined {
    const writes: FieldWrite[] = [];
    for (const field of fields) {
      const value = candidates[field];
      if (value === undefined) continue;
      const wrapper = formControl(root, fieldSuffix[field]);
      const control = linkedControl(wrapper);
      if (!wrapper || !isVisible(wrapper) || !control || typeof control.set_value !== 'function') return undefined;
      const vacant = !edited.has(wrapper) && isBlank(wrapper, control, field);
      if (!vacant && !hasValue(wrapper, control, field, value)) return undefined;
      if (field === 'content') {
        const input = wrapper.querySelector<HTMLInputElement | HTMLTextAreaElement>('input:not([type="hidden"]), textarea');
        if (input && input.maxLength >= 0 && String(value).length > input.maxLength) return undefined;
      }
      writes.push({ field, wrapper, control, value, vacant });
    }
    return writes;
  }

  function write(fields: FieldWrite[] | undefined, mirrored: FormValues = {}) {
    if (!fields?.length) return;
    try {
      for (const { field, wrapper, control, value, vacant } of fields) {
        if (!vacant) continue;
        const mirror = mirrored[field];
        if (!root.contains(wrapper) || linkedControl(wrapper) !== control || edited.has(wrapper) ||
          (!isBlank(wrapper, control, field) && (mirror === undefined || !hasValue(wrapper, control, field, mirror)))) break;
        if (!hasValue(wrapper, control, field, value)) {
          control.set_value!(value);
        }
        if (!hasValue(wrapper, control, field, value)) break;
        applied.push(field);
      }
    } catch {
      // A removed or no longer compatible control is reported as pending.
    }
  }

  const paired = (pair: readonly FormField[]) => pair.every(field => values[field] !== undefined) ? plan(pair) : undefined;
  const actual = paired(actualFields);
  const recognized = paired(recognizedFields);
  let mirrored: FormValues = {};
  if (actual?.some(field => field.vacant)) {
    // KORUS mirrors actual setters into recognition. Guard the original pair before
    // any write, then allow only those mirror values to be replaced by explicit recognition.
    const candidate: FormValues = {
      recognizedHours: values.actualHours,
      recognizedMinutes: values.actualMinutes,
    };
    const recognitionBeforeMirror = plan(recognizedFields, candidate);
    const preservesPair = recognitionBeforeMirror?.every(({ wrapper, control, field, value }) =>
      hasValue(wrapper, control, field, value)) ||
      (recognitionBeforeMirror?.every(field => field.vacant) && recognized?.every(field => field.vacant));
    if (preservesPair) {
      write(actual);
      mirrored = candidate;
    }
  }
  write(recognized, mirrored);
  write(plan(['begin', 'end']));
  write(plan(['content']));
  return applied;
}

const lookups = {
  course: { field: 'edt_crsecNm', button: 'btn_crsecNm', col: 1 },
  institution: { field: 'edt_edcInsttNm', button: 'btn_edcInsttNm', search: 'View_VM00023948_btn_0', col: 2, codeCol: 1 },
} as const;
const otherCourse = '기타교육과정';
const gridRowSuffix = '_div_url_grd_list_body_gridrow_';

function visibleLookup(document: Document, suffix: string): HTMLElement | undefined {
  const roots = [...document.querySelectorAll<HTMLElement>(`[id$="${suffix}"]`)].filter(isVisible);
  return roots.length === 1 ? roots[0] : undefined;
}

const pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

async function waitFor<T>(read: () => T | undefined, active: () => boolean, timeout = 2500): Promise<T | undefined> {
  const deadline = Date.now() + timeout;
  while (active() && Date.now() < deadline) {
    const result = read();
    if (result !== undefined) return result;
    await pause(40);
  }
  return undefined;
}

async function search(
  popup: HTMLElement, term: string, signal: AbortSignal,
): Promise<LookupDataset | undefined> {
  const config = lookups.institution;
  const query = linkedControl(formControl(popup, config.field));
  const button = linkedControl(formControl(popup, config.search));
  const grid = linkedControl(formControl(popup, 'grd_list'));
  const dataset = grid?.getBindDataset?.();
  if (!query?.set_value || !button?.click || !grid || !dataset ||
    typeof dataset.addEventHandler !== 'function' || typeof dataset.removeEventHandler !== 'function' ||
    signal.aborted) return undefined;
  return new Promise(resolve => {
    let finished = false;
    const timeout = setTimeout(() => finish(false), 8000);
    const abort = () => finish(false);
    const onLoad: LoadHandler = (_source, event) => {
      if (event.reason === 0) finish(!signal.aborted && (event.errorcode ?? 0) >= 0);
    };
    function finish(ok: boolean): void {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
      try {
        dataset!.removeEventHandler('onload', onLoad, grid!);
        resolve(ok ? dataset : undefined);
      } catch {
        resolve(undefined);
      }
    }
    try {
      dataset.addEventHandler('onload', onLoad, grid);
      signal.addEventListener('abort', abort, { once: true });
      query.set_value!(term);
      if (modelValue(query) !== term || signal.aborted) finish(false);
      else button.click!();
    } catch {
      finish(false);
    }
  });
}

const normalizeName = (value: string) => value.normalize('NFC').trim().replace(/\s+/gu, ' ');

function resultCells(popup: HTMLElement, field: LookupField): HTMLElement[] {
  const prefix = popup.id + gridRowSuffix;
  const suffix = `_${lookups[field].col}GridCellTextContainerElement`;
  return [...popup.querySelectorAll<HTMLElement>(`[id^="${prefix}"][id$="${suffix}"]`)].filter(isVisible);
}

interface InstitutionRow {
  count: number;
  index: number;
  code: string;
}

function findInstitutionRow(dataset: LookupDataset, name: string): InstitutionRow | undefined {
  if (typeof dataset.getRowCount !== 'function' || typeof dataset.getColumn !== 'function') return undefined;
  const count = dataset.getRowCount();
  if (!Number.isSafeInteger(count) || count < 1) return undefined;
  let index = -1;
  for (let row = 0; row < count; row++) {
    const value = dataset.getColumn(row, 'edcInsttNm');
    if (typeof value !== 'string' || normalizeName(value) !== name) continue;
    if (index !== -1) return undefined;
    index = row;
  }
  if (index === -1) return undefined;
  const value = dataset.getColumn(index, 'edcInsttCode');
  const code = typeof value === 'string' || (typeof value === 'number' && Number.isSafeInteger(value))
    ? String(value).trim() : '';
  return code ? { count, index, code } : undefined;
}

function institutionResultCell(
  popup: HTMLElement, name: string, { count, index, code }: InstitutionRow,
): HTMLElement | undefined {
  const cells = resultCells(popup, 'institution');
  if (cells.length !== count) return undefined;
  const matches = cells.filter(cell => normalizeName(cell.textContent ?? '') === name);
  const rowId = `${popup.id}${gridRowSuffix}${index}_cell_${index}`;
  const { col, codeCol } = lookups.institution;
  if (matches.length !== 1 || matches[0].id !== `${rowId}_${col}GridCellTextContainerElement`) return undefined;
  const codeCells = popup.querySelectorAll<HTMLElement>(`[id="${rowId}_${codeCol}GridCellTextContainerElement"]`);
  if (codeCells.length !== 1 || !isVisible(codeCells[0]) || codeCells[0].textContent?.trim() !== code) return undefined;
  return matches[0];
}

function readyInstitutionLookup(popup: HTMLElement): boolean {
  const config = lookups.institution;
  const query = linkedControl(formControl(popup, config.field));
  const search = linkedControl(formControl(popup, config.search));
  const grid = linkedControl(formControl(popup, 'grd_list'));
  return !!query?.set_value && !!search?.click && !!grid?.getBindDataset?.();
}

function selectRow(cell: HTMLElement, double: boolean): void {
  const target = cell.firstElementChild ?? cell;
  const view = cell.ownerDocument.defaultView!;
  const rect = target.getBoundingClientRect();
  const clientX = rect.left + rect.width / 2;
  const clientY = rect.top + rect.height / 2;
  if (!rect.width || !rect.height) return;
  const base = { bubbles: true, cancelable: true, view, clientX, clientY, button: 0 };
  for (let detail = 1; detail <= (double ? 2 : 1) && target.isConnected; detail++) {
    const down = { ...base, detail, buttons: 1 };
    const up = { ...base, detail, buttons: 0 };
    target.dispatchEvent(new view.PointerEvent('pointerdown', { ...down, pointerType: 'mouse', pointerId: 1 }));
    target.dispatchEvent(new view.MouseEvent('mousedown', down));
    target.dispatchEvent(new view.PointerEvent('pointerup', { ...up, pointerType: 'mouse', pointerId: 1 }));
    target.dispatchEvent(new view.MouseEvent('mouseup', up));
    target.dispatchEvent(new view.MouseEvent('click', up));
  }
  if (double && target.isConnected) target.dispatchEvent(new view.MouseEvent('dblclick', { ...base, detail: 2 }));
}

async function enterCourse(popup: HTMLElement, value: string, active: () => boolean): Promise<boolean> {
  function directInput() {
    const wrapper = formControl(popup, 'edt_inputCrsecNm');
    const input = wrapper?.querySelector('input');
    return input ? { input, control: linkedControl(wrapper) } : undefined;
  }
  const generic = await waitFor(() => {
    if (!directInput()) return undefined;
    const matches = resultCells(popup, 'course').filter(cell => normalizeName(cell.textContent ?? '') === otherCourse);
    return matches.length === 1 ? matches[0] : undefined;
  }, active, 6000);
  if (!generic || !active()) return false;

  const direct = directInput();
  if (!direct) return false;
  if (direct.input.disabled || direct.input.readOnly || direct.control?.enable === false) selectRow(generic, false);

  const ready = await waitFor(() => {
    const direct = directInput();
    const confirm = linkedControl(formControl(popup, 'View_VM00024467_btn_0'));
    if (!direct || direct.input.disabled || direct.input.readOnly || direct.control?.enable === false ||
      !direct.control?.set_value || !confirm?.click) return undefined;
    return { input: direct.input, control: direct.control, confirm };
  }, active);
  if (!ready || !active() || !empty(ready.input.value) || !empty(modelValue(ready.control))) return false;
  ready.control.set_value!(value);
  if (modelValue(ready.control) !== value || !active()) return false;
  ready.confirm.click!();
  return true;
}

export async function applyTrainingLookup(
  frame: Window, root: HTMLElement, field: LookupField, value: string, controller: AbortController,
): Promise<boolean> {
  const doc = root.ownerDocument;
  const config = lookups[field];
  const suffix = lookupSuffix[field];
  const wrapper = formControl(root, config.field);
  const parent = linkedControl(wrapper);
  const trigger = linkedControl(formControl(root, config.button));
  const active = () => !controller.signal.aborted && getTrainingRoot(frame) === root;
  const safe = () => active() && !!wrapper && !!parent && isBlank(wrapper, parent) && !attachmentDialog(doc);
  if (!safe() || !trigger?.click || hasTrainingDialog(doc)) return false;

  let popup: HTMLElement | undefined;
  const manualInteraction = (event: Event) => {
    const target = event.target as Node | null;
    if (event.isTrusted && target && (popup?.contains(target) || root.contains(target))) controller.abort();
  };
  const manualEvents = ['pointerdown', 'keydown', 'input'];
  for (const event of manualEvents) doc.addEventListener(event, manualInteraction, true);
  try {
    trigger.click();
    popup = await waitFor(() => visibleLookup(doc, suffix), safe);
    if (!popup) return false;
    const popupActive = () => safe() && visibleLookup(doc, suffix) === popup;
    if (field === 'course') {
      if (!await enterCourse(popup, value, popupActive)) return false;
    } else {
      const institutionPopup = popup;
      if (!await waitFor(() => readyInstitutionLookup(institutionPopup) ? true : undefined, popupActive, 6000)) return false;
      const dataset = await search(institutionPopup, value, controller.signal);
      if (!dataset || !popupActive()) return false;
      const name = normalizeName(value);
      const expected = findInstitutionRow(dataset, name);
      if (!expected) return false;
      const resultActive = () => {
        if (!popupActive()) return false;
        const query = linkedControl(formControl(institutionPopup, config.field));
        const grid = linkedControl(formControl(institutionPopup, 'grd_list'));
        return !!query && modelValue(query) === value && grid?.getBindDataset?.() === dataset;
      };
      // The bound dataset loads before Nexacro paints its result cells.
      const readCell = () => institutionResultCell(institutionPopup, name, expected);
      const cell = await waitFor(readCell, resultActive);
      if (!cell || !resultActive()) return false;
      const current = findInstitutionRow(dataset, name);
      if (current?.index !== expected.index || current.count !== expected.count || current.code !== expected.code ||
        readCell() !== cell) return false;
      selectRow(cell, true);
    }
    return (await waitFor(() => {
      const current = modelValue(parent!);
      return !visibleLookup(doc, suffix) && typeof current === 'string' &&
        normalizeName(current) === normalizeName(value) ? true : undefined;
    }, active)) === true;
  } finally {
    for (const event of manualEvents) doc.removeEventListener(event, manualInteraction, true);
  }
}

function selectClassification(root: HTMLElement, field: ClassificationField, value: string): boolean {
  const wrapper = formControl(root, classifications[field].suffix);
  const control = linkedControl(wrapper);
  if (!wrapper || !isVisible(wrapper) || !control?.set_value || control.enable === false) return false;
  try {
    if (!control.getInnerDataset?.()) return false;
    control.set_value(value);
    return modelValue(control) === value;
  } catch {
    return false;
  }
}

export function startTrainingMain(frame: Window): void {
  if (!isTrainingFrame(frame)) return;
  observeTrainingUpload(frame);
  let ongoing: AbortController | undefined;
  const doc = frame.document;
  const edited = new WeakMap<HTMLElement, Set<HTMLElement>>();
  const markEdited = (event: Event) => {
    if (!event.isTrusted) return;
    if (event.type === 'keydown' && !/^(?:[0-9]|Backspace|Delete|ArrowUp|ArrowDown)$/u.test((event as KeyboardEvent).key)) return;
    const root = getTrainingRoot(frame);
    const target = event.target as Node | null;
    if (!root || !target || !root.contains(target)) return;
    for (const suffix of Object.values(fieldSuffix)) {
      const wrapper = formControl(root, suffix);
      if (wrapper?.contains(target)) {
        const fields = edited.get(root) ?? new Set<HTMLElement>();
        fields.add(wrapper);
        edited.set(root, fields);
      }
    }
  };
  for (const event of ['input', 'change', 'keydown']) doc.addEventListener(event, markEdited, true);
  doc.addEventListener(requestEvent, event => {
    const root = getTrainingRoot(frame);
    if (!root || event.target !== root) return;
    const command = decodeCommand((event as CustomEvent<unknown>).detail);
    if (!command) return;
    if (command.kind === 'cancel') {
      ongoing?.abort();
      return;
    }
    const reply = (data: object) => root.dispatchEvent(new doc.defaultView!.CustomEvent(responseEvent, {
      detail: JSON.stringify(data),
    }));
    if (command.kind === 'fill') {
      reply({ kind: 'fill', applied: applyTrainingValues(root, command.values, edited.get(root)) });
    } else if (command.kind === 'select') {
      const { field, value } = command;
      const applied = !ongoing && !hasTrainingDialog(doc) && selectClassification(root, field, value);
      reply({ kind: 'select', field, value, applied });
    } else if (ongoing) {
      reply({ kind: 'lookup', field: command.field, applied: false });
    } else {
      const controller = new AbortController();
      ongoing = controller;
      const { field, value } = command;
      void applyTrainingLookup(frame, root, field, value, controller).catch(() => false).then(applied => {
        ongoing = undefined;
        if (!controller.signal.aborted) reply({ kind: 'lookup', field, applied });
        else reply({ kind: 'lookup', field, applied: false, cancelled: true });
      });
    }
  }, true);
}

if (typeof window !== 'undefined') startTrainingMain(window);
