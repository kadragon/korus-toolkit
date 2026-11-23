import { attachmentDialog, getTrainingRoot, uploadCompleteEvent, uploadFileKey } from './training-form';

type UploadResult = { success?: boolean; rows?: { attfgNo?: string } };
type UploadSettings = { url?: string; type?: string; data?: unknown };
type AjaxSuccessHandler = (
  event: unknown, request: { responseJSON?: UploadResult },
  settings: UploadSettings, result?: UploadResult,
) => void;

// The widget replaces its file input when queuing a file. Observe its completed
// jQuery request so the listener does not depend on either input element surviving.
export function observeTrainingUpload(frame: Window): void {
  const doc = frame.document;
  const view = doc.defaultView!;
  let active: { root: HTMLElement; dialog: HTMLElement } | undefined;
  const requests = new WeakMap<object, { root: HTMLElement; dialog: HTMLElement; keys: string[] }>();
  let subscribed = false;

  const started: AjaxSuccessHandler = (_event, request, settings) => {
    const { url, type, data } = settings;
    if (!active || active.root !== getTrainingRoot(frame) || attachmentDialog(doc)?.dialog !== active.dialog ||
      !url || type?.toUpperCase() !== 'POST' || !(data instanceof view.FormData)) return;
    let endpoint: URL;
    try {
      endpoint = new URL(url, frame.location.href);
    } catch {
      return;
    }
    if (endpoint.origin !== frame.location.origin || endpoint.pathname !== '/cm/c/cm/FileCtr/uploadFiles.do') return;
    const keys: string[] = [];
    data.forEach(file => {
      if (file instanceof view.File) keys.push(uploadFileKey(file));
    });
    if (keys.length) requests.set(request, { ...active, keys });
  };
  const completed: AjaxSuccessHandler = (_event, request, _settings, result = request.responseJSON) => {
    const accepted = requests.get(request);
    requests.delete(request);
    if (!accepted || accepted.root !== getTrainingRoot(frame) || attachmentDialog(doc)?.dialog !== accepted.dialog ||
      result?.success === false || typeof result?.rows?.attfgNo !== 'string' || !result.rows.attfgNo.trim()) return;
    accepted.root.dispatchEvent(new view.CustomEvent(uploadCompleteEvent, { detail: JSON.stringify(accepted.keys) }));
  };

  doc.addEventListener('change', event => {
    if (!event.isTrusted) return;
    const root = getTrainingRoot(frame);
    const popup = attachmentDialog(doc);
    if (!root || !popup || event.target !== popup.input) return;
    const jquery = (frame as Window & {
      jQuery?: (document: Document) => { on(type: string, handler: AjaxSuccessHandler): void };
    }).jQuery;
    if (!subscribed) {
      if (typeof jquery !== 'function') return;
      const events = jquery(doc);
      events.on('ajaxSend.korusTrainingUpload', started);
      events.on('ajaxSuccess.korusTrainingUpload', completed);
      subscribed = true;
    }
    active = { root, dialog: popup.dialog };
  }, true);
}
