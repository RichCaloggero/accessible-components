import { AcBase, not } from '../shared/base.js';

const BASE = new URL('.', import.meta.url);

function warnMissingLabel(tag) {
  console.warn(`<${tag}>: No accessible label provided. Use label, label-id, or aria-label.`);
} // warnMissingLabel

export class AcCombobox extends AcBase {
  static formAssociated = true;

  static observedAttributes = [
    'value', 'disabled',
    'label', 'label-position', 'label-id', 'aria-label',
    'status-timeout',
  ];

  #internals;
  #input;
  #datalist;
  #labelEl;
  #statusEl;
  #statusTimer = null;
  #ready;

  constructor() {
    super();
    this.#internals = this.attachInternals();
    this.#ready = this.#init();
  } // constructor

  async #init() {
    const shadow = await this._initShadow(BASE, 'combobox.html', 'combobox.css');
    this.#input = shadow.getElementById('input');
    this.#datalist = shadow.getElementById('listbox');
    this.#labelEl = shadow.getElementById('label');
    this.#statusEl = shadow.getElementById('status');

    this.#input.addEventListener('input', () => this.#onInput());

    shadow.querySelector('slot').addEventListener('slotchange', () => this.#syncOptions());

    this.#syncOptions();
    this.#syncLabel();
    this.#syncDisabled();
  } // #init

  connectedCallback() {
    this.#ready.then(() => this.#syncLabel());
  } // connectedCallback

  attributeChangedCallback(name) {
    if (not(this.#input)) return;
    switch (name) {
      case 'disabled': this.#syncDisabled(); break;
      case 'value': this.#syncValue(); break;
      case 'label':
      case 'label-position':
      case 'label-id':
      case 'aria-label': this.#syncLabel(); break;
    } // switch
  } // attributeChangedCallback

  // --- Public properties ---

  get value() { return this.getAttribute('value') ?? ''; }
  set value(v) { this._reflectStrAttr('value', v); }

  get disabled() { return this.hasAttribute('disabled'); }
  set disabled(v) { this._reflectBoolAttr('disabled', v); }

  get statusTimeout() {
    const val = parseInt(this.getAttribute('status-timeout'));
    return isNaN(val) ? 7 : val;
  } // get statusTimeout

  // --- Option mirroring ---
  // Light DOM <option> elements are data; shadow <datalist> holds the rendered options.

  get #sourceOptions() {
    return [...this.querySelectorAll('option')];
  } // get #sourceOptions

  #syncOptions() {
    this.#datalist.innerHTML = '';
    for (const src of this.#sourceOptions) {
      const opt = document.createElement('option');
      opt.value = src.textContent;
      opt.dataset.value = src.value;
      if (src.disabled) opt.disabled = true;
      this.#datalist.appendChild(opt);
    } // for
  } // #syncOptions

  // --- Labeling ---

  #syncLabel() {
    if (not(this.#labelEl)) return;

    const labelId = this.getAttribute('label-id');
    const labelText = this.getAttribute('label');
    const ariaLabel = this.getAttribute('aria-label');

    if (labelId) {
      this.#labelEl.hidden = true;
      this.#input.setAttribute('aria-labelledby', labelId);
      this.#input.removeAttribute('aria-label');
      return;
    } // if labelId

    if (labelText) {
      this.#labelEl.textContent = labelText;
      this.#labelEl.hidden = false;
      this.#input.setAttribute('aria-labelledby', this.#labelEl.id);
      this.#input.removeAttribute('aria-label');
      return;
    } // if labelText

    if (ariaLabel) {
      this.#labelEl.hidden = true;
      this.#input.setAttribute('aria-label', ariaLabel);
      this.#input.removeAttribute('aria-labelledby');
      return;
    } // if ariaLabel

    this.#labelEl.hidden = true;
    warnMissingLabel('ac-combobox');
  } // #syncLabel

  // --- Sync helpers ---

  #syncDisabled() {
    this.#input.disabled = this.disabled;
  } // #syncDisabled

  #syncValue() {
    const v = this.value;
    if (this.#input.value !== v) this.#input.value = v;
    this.#internals.setFormValue(v);
  } // #syncValue

  // --- Event handlers ---

  #onInput() {
    this.#reportMatchCount();
    const value = this.#input.value;
    this.#internals.setFormValue(value);
    this.#emit('ac-input', { value });
  } // #onInput

  // --- Match count reporting ---

  #reportMatchCount() {
    const value = this.#input.value;
    const options = [...this.#datalist.querySelectorAll('option')];
    const matches = options.filter(opt =>
      opt.value.toLowerCase().includes(value.toLowerCase())
    );

    this.#statusEl.textContent = `${matches.length} items found.`;

    clearTimeout(this.#statusTimer);
    this.#statusTimer = setTimeout(() => {
      this.#statusEl.textContent = '';
    }, this.statusTimeout * 1000);
  } // #reportMatchCount

  // --- Events ---

  #emit(name, detail = {}) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
  } // #emit
} // AcCombobox

customElements.define('ac-combobox', AcCombobox);

// --- Standalone helpers for use outside the web component ---

export function reportMatchCount(e) {
  const $input = e.target;
  const $list = document.getElementById($input.getAttribute('list'));
  const $items = $list.querySelectorAll('option');
  const value = $input.value;
  const $status = document.querySelector("[role='status']");

  const matches = [...$items].filter(item =>
    item.textContent.toLowerCase().includes(value.toLowerCase())
  );

  $status.textContent = `${matches.length} items found.`;
  setTimeout(() => { $status.textContent = ''; }, 7000);
} // reportMatchCount

export function loadList(values, options = {}) {
  const { container: $container = 'ul', itemContainer = 'option', valueContainer = '', hidden = false } = options;

  for (const value of values) {
    const $item = document.createElement(itemContainer);
    const $value = valueContainer ? document.createElement(valueContainer) : $item;
    $value.className = 'value';
    $value.textContent = value;

    if ($value !== $item) $item.appendChild($value);
    $container.appendChild($item);
  } // for

  $container.hidden = hidden;
  return $container;
} // loadList
