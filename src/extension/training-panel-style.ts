export const trainingPanelStyle = `
  .korus-training-panel {
    position: fixed;
    inset: 12px 12px auto auto;
    z-index: 2147483646;
    width: min(394px, calc(100vw - 24px));
    max-height: calc(100vh - 24px);
    overflow: auto;
    box-sizing: border-box;
    color: #16243a;
    background: #fff;
    border: 1px solid #ced9e8;
    border-radius: 14px;
    box-shadow: 0 12px 36px #132f512e;
    font: 13px/1.5 system-ui, "Malgun Gothic", sans-serif;
    text-align: left;
    overflow-wrap: anywhere;
    user-select: text;
  }
  .korus-training-panel *, .korus-training-panel *::before { box-sizing: border-box; }
  .korus-training-panel [hidden] { display: none !important; }
  .korus-training-panel .kt-header {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 7px 12px;
    color: #fff;
    background: #173452;
  }
  .korus-training-panel .kt-title { margin: 0; font: 700 16px/1.4 system-ui, sans-serif; }
  .korus-training-panel .kt-body { display: grid; gap: 8px; padding: 8px 12px 10px; }
  .korus-training-panel .kt-summary {
    display: grid;
    gap: 2px;
    padding: 6px 8px;
    background: #f0f5fb;
    border: 1px solid #dee7f2;
    border-radius: 9px;
  }
  .korus-training-panel .kt-summary-status { font-weight: 700; color: #244f7d; }
  .korus-training-panel .kt-details { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px 8px; color: #455873; }
  .korus-training-panel .kt-details:empty { display: none; }
  .korus-training-panel .kt-details > :not(.kt-duration) { grid-column: 1 / -1; }
  .korus-training-panel .kt-details summary { cursor: pointer; }
  .korus-training-panel .kt-section { display: grid; gap: 5px; min-width: 0; }
  .korus-training-panel .kt-section-title { margin: 0; color: #2c4868; font: 700 13px/1.5 system-ui, sans-serif; }
  .korus-training-panel .kt-lookups { display: grid; gap: 4px; }
  .korus-training-panel .kt-lookup {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 3px 8px;
    padding: 5px 8px;
    border: 1px solid #e0e7f0;
    border-radius: 8px;
  }
  .korus-training-panel .kt-value { display: grid; gap: 1px; }
  .korus-training-panel .kt-extracted {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
  }
  .korus-training-panel .kt-label { color: #526580; font-weight: 650; }
  .korus-training-panel .kt-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
  .korus-training-panel .kt-lookup-status, .korus-training-panel .kt-choice-status {
    grid-column: 1 / -1;
    font-size: 12px;
    color: #445775;
  }
  .korus-training-panel .kt-lookup-status:empty, .korus-training-panel .kt-choice-status:empty { display: none; }
  .korus-training-panel .kt-choice-status:not(:empty) { color: #9b3832; }
  .korus-training-panel .kt-group {
    display: grid;
    grid-template-columns: 82px minmax(0, 1fr);
    align-items: center;
    gap: 2px 6px;
  }
  .korus-training-panel .kt-choices { display: flex; flex-wrap: wrap; gap: 4px; }
  .korus-training-panel .kt-choice-status { grid-column: 1 / -1; }
  .korus-training-panel button.kt-button {
    appearance: none;
    min-width: 32px;
    min-height: 27px;
    margin: 0;
    padding: 2px 7px;
    border: 1px solid #cbd8e8;
    border-radius: 6px;
    color: #243e5f;
    background: #fff;
    font: inherit;
    font-weight: 600;
    white-space: normal;
    cursor: pointer;
  }
  .korus-training-panel button.kt-button:not(:disabled):hover { background: #eaf2fc; border-color: #86a8ce; }
  .korus-training-panel button.kt-button:focus-visible { outline: 2px solid #3e83c5; outline-offset: 2px; }
  .korus-training-panel button.kt-primary, .korus-training-panel button[aria-pressed="true"] {
    color: #fff;
    background: #285f98;
    border-color: #285f98;
  }
  .korus-training-panel button.kt-primary:not(:disabled):hover, .korus-training-panel button[aria-pressed="true"]:not(:disabled):hover {
    color: #fff;
    background: #1d4e82;
    border-color: #1d4e82;
  }
  .korus-training-panel button.kt-close { color: #fff; border-color: #97b2ce; background: transparent; font-size: 12px; }
  .korus-training-panel button.kt-close:not(:disabled):hover { color: #fff; background: #284d74; }
  .korus-training-panel button.kt-button:disabled { color: #627489; background: #edf1f6; cursor: default; opacity: .8; }
  .korus-training-panel .kt-hint { margin: 0; padding: 8px 10px; border-radius: 7px; color: #654610; background: #fff4da; }
  @media (max-height: 620px) {
    .korus-training-panel .kt-header { padding-block: 5px; }
    .korus-training-panel .kt-body { gap: 5px; padding-block: 5px 7px; }
    .korus-training-panel .kt-summary { padding-block: 4px; }
    .korus-training-panel .kt-section { gap: 3px; }
    .korus-training-panel .kt-lookup { padding-block: 3px; }
    .korus-training-panel button.kt-button { min-height: 25px; }
  }
  @media (max-width: 360px) {
    .korus-training-panel .kt-header, .korus-training-panel .kt-body { padding-inline: 8px; }
    .korus-training-panel .kt-lookup, .korus-training-panel .kt-wide-group { grid-template-columns: 1fr; }
  }
`;
