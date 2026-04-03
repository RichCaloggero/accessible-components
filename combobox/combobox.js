import { AcBase } from '../shared/base.js';
import { not } from '../shared/not.js';

const BASE = new URL('.', import.meta.url);

let idCounter = 0;

function uniqueId(prefix) {
  return `${prefix}-${++idCounter}`;
} // uniqueId

function optionMatches(text, query) {
  return text.toLowerCase().startsWith(query.toLowerCase());
} // optionMatches

function nextEnabled(items, from, direction) {
  const len = items.length;
  if (not(len)) return null;
  let i = from + direction;
  while (i >= 0 && i < len) {
    if (items[i].getAttribute('aria-disabled') !== 'true') return items[i];
    i += direction;
  } // while
  return null;
} // nextEnabled

function warnMissingLabel(tag) {
  console.warn(`<${tag}>: No accessible label provided. Use label, label-id, or aria-label.`);
} // warnMissingLabel

export class AcCombobox extends AcBase {
  static formAssociated = true;

  static observedAttributes = [
    'autocomplete', 'open', 'value', 'disabled', 'readonly',
    'label', 'label-position', 'label-id', 'aria-label',
  ];

  #internals;
  #input;
  #listbox;
  #toggle;
  #labelEl;
  #activeDescendant = null;
  #ready;

  constructor() {
    super();
    this.#internals = this.attachInternals();
    this.#ready = this.#init();
  } // constructor

  async #init() {
    const shadow = await this._initShadow(BASE, 'combobox.html', 'combobox.css');
    this.#input = shadow.getElementById('input');
    this.#listbox = shadow.getElementById('listbox');
    this.#toggle = shadow.getElementById('toggle');
    this.#labelEl = shadow.getElementById('label');

    this.#input.addEventListener('keydown', e => this.#onKeydown(e));
    this.#input.addEventListener('input', () => this.#onInput());
    this.#input.addEventListener('focus', () => this.#onInputFocus());
    this.#input.addEventListener('blur', e => this.#onInputBlur(e));
    this.#toggle.addEventListener('click', () => this.#togglePopup());
    this.#toggle.addEventListener('mousedown', e => e.preventDefault());
    this.#listbox.addEventListener('mousedown', e => e.preventDefault());
    this.#listbox.addEventListener('click', e => this.#onListboxClick(e));

    shadow.querySelector('slot').addEventListener('slotchange', () => this.#syncOptions());

    this.#syncOptions();
    this.#syncLabel();
    this.#syncReadonly();
    this.#syncDisabled();
    this.#syncAutocomplete();
  } // #init

  connectedCallback() {
    this.#ready.then(() => this.#syncLabel());
  } // connectedCallback

  attributeChangedCallback(name) {
    if (not(this.#input)) return;
    switch (name) {
      case 'open': this.#syncOpen(); break;
      case 'disabled': this.#syncDisabled(); break;
      case 'readonly': this.#syncReadonly(); break;
      case 'autocomplete': this.#syncAutocomplete(); break;
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

  get open() { return this.hasAttribute('open'); }
  set open(v) { this._reflectBoolAttr('open', v); }

  get disabled() { return this.hasAttribute('disabled'); }
  set disabled(v) { this._reflectBoolAttr('disabled', v); }

  get readonly() { return this.hasAttribute('readonly'); }
  set readonly(v) { this._reflectBoolAttr('readonly', v); }

  // --- Option mirroring ---
  // Light DOM <option> elements are data; shadow DOM divs are the rendered options.

  get #sourceOptions() {
    return [...this.querySelectorAll('option')];
  } // get #sourceOptions

  get #renderedOptions() {
    return [...this.#listbox.querySelectorAll('[role="option"]')];
  } // get #renderedOptions

  get #visibleOptions() {
    return this.#renderedOptions.filter(o => not(o.hidden));
  } // get #visibleOptions

  #syncOptions() {
    this.#listbox.innerHTML = '';
    for (const src of this.#sourceOptions) {
      const div = document.createElement('div');
      div.className = 'option';
      div.id = uniqueId('ac-opt');
      div.setAttribute('role', 'option');
      div.textContent = src.textContent;
      div.dataset.value = src.value;
      if (src.disabled) div.setAttribute('aria-disabled', 'true');
      if (src.selected) div.setAttribute('aria-selected', 'true');
      this.#listbox.appendChild(div);
    } // for
  } // #syncOptions

  // --- Popup ---

  #syncOpen() {
    const isOpen = this.open;
    this.#listbox.hidden = not(isOpen);
    this.#input.setAttribute('aria-expanded', String(isOpen));
    this.#toggle.setAttribute('aria-expanded', String(isOpen));

    if (isOpen) {
      this.#filterOptions();
      this.#emit('ac-open');
    } else {
      this.#clearActiveDescendant();
      this.#emit('ac-close');
    } // if
  } // #syncOpen

  #openPopup() {
    if (not(this.open)) this.open = true;
  } // #openPopup

  #closePopup() {
    if (this.open) this.open = false;
  } // #closePopup

  #togglePopup() {
    this.open = not(this.open);
  } // #togglePopup

  // --- Active descendant ---

  #setActiveDescendant(el) {
    if (this.#activeDescendant) {
      this.#activeDescendant.removeAttribute('aria-selected');
    } // if
    this.#activeDescendant = el;
    if (el) {
      el.setAttribute('aria-selected', 'true');
      this.#input.setAttribute('aria-activedescendant', el.id);
      el.scrollIntoView({ block: 'nearest' });
    } else {
      this.#input.removeAttribute('aria-activedescendant');
    } // if
  } // #setActiveDescendant

  #clearActiveDescendant() {
    this.#setActiveDescendant(null);
  } // #clearActiveDescendant

  #moveActiveDescendant(direction) {
    const opts = this.#visibleOptions;
    if (not(opts.length)) return;

    const currentIdx = this.#activeDescendant ? opts.indexOf(this.#activeDescendant) : -1;
    const next = nextEnabled(opts, currentIdx, direction);
    if (next) this.#setActiveDescendant(next);
  } // #moveActiveDescendant

  // --- Selection ---

  #selectRenderedOption(el) {
    if (not(el) || el.getAttribute('aria-disabled') === 'true') return;
    const label = el.textContent;
    const value = el.dataset.value;
    this.#input.value = label;
    this.value = value;
    this.#internals.setFormValue(value);
    this.#closePopup();
    this.#emit('ac-select', { value, label });
  } // #selectRenderedOption

  // --- Filtering ---

  #filterOptions() {
    const mode = this.getAttribute('autocomplete') ?? 'none';
    if (mode === 'none') {
      for (const o of this.#renderedOptions) o.hidden = false;
      return;
    } // if
    const query = this.#input.value;
    for (const el of this.#renderedOptions) {
      el.hidden = query ? not(optionMatches(el.textContent, query)) : false;
    } // for
  } // #filterOptions

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

  #syncReadonly() {
    const ro = this.readonly;
    this.#input.readOnly = ro;
    this.#toggle.hidden = not(ro);
  } // #syncReadonly

  #syncDisabled() {
    this.#input.disabled = this.disabled;
  } // #syncDisabled

  #syncAutocomplete() {
    const mode = this.getAttribute('autocomplete') ?? 'none';
    this.#input.setAttribute('aria-autocomplete', mode);
  } // #syncAutocomplete

  #syncValue() {
    const v = this.value;
    if (this.#input.value !== v) this.#input.value = v;
    this.#internals.setFormValue(v);
  } // #syncValue

  // --- Event handlers ---

  #onKeydown(e) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.#openPopup();
        this.#moveActiveDescendant(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.#openPopup();
        this.#moveActiveDescendant(-1);
        break;
      case 'Enter':
        if (this.open && this.#activeDescendant) {
          e.preventDefault();
          this.#selectRenderedOption(this.#activeDescendant);
        } // if
        break;
      case 'Escape':
        if (this.open) {
          e.preventDefault();
          this.#closePopup();
        } // if
        break;
      case 'Home':
        if (this.open) {
          e.preventDefault();
          const first = nextEnabled(this.#visibleOptions, -1, 1);
          if (first) this.#setActiveDescendant(first);
        } // if
        break;
      case 'End':
        if (this.open) {
          e.preventDefault();
          const opts = this.#visibleOptions;
          const last = nextEnabled(opts, opts.length, -1);
          if (last) this.#setActiveDescendant(last);
        } // if
        break;
    } // switch
  } // #onKeydown

  #onInput() {
    this.#openPopup();
    this.#filterOptions();
    this.#clearActiveDescendant();
    this.#emit('ac-input', { value: this.#input.value });
  } // #onInput

  #onInputFocus() {
    if (this.readonly) this.#openPopup();
  } // #onInputFocus

  #onInputBlur(e) {
    if (this.shadowRoot.contains(e.relatedTarget)) return;
    if (this.contains(e.relatedTarget)) return;
    this.#closePopup();
  } // #onInputBlur

  #onListboxClick(e) {
    const el = e.target.closest('[role="option"]');
    if (el) this.#selectRenderedOption(el);
  } // #onListboxClick

  // --- Events ---

  #emit(name, detail = {}) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
  } // #emit
} // AcCombobox

customElements.define('ac-combobox', AcCombobox);
