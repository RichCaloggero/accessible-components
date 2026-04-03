import { AcBase, not } from '../shared/base.js';

const BASE = new URL('.', import.meta.url);

// --- Module-level helpers (not instance-specific) ---

function visibleItems(tree) {
  const items = [];
  collect(tree.children, items);
  return items;
} // visibleItems

function collect(children, out) {
  for (const child of children) {
    if (not(child instanceof AcTreeItem)) continue;
    if (child.disabled) continue;
    out.push(child);
    if (child.expanded) collect(child.children, out);
  } // for
} // collect

function itemLevel(item) {
  let level = 0;
  let el = item.parentElement;
  while (el) {
    if (el instanceof AcTreeItem) level++;
    if (el instanceof AcTree) break;
    el = el.parentElement;
  } // while
  return level;
} // itemLevel

function parentItem(item) {
  let el = item.parentElement;
  while (el) {
    if (el instanceof AcTreeItem) return el;
    if (el instanceof AcTree) return null;
    el = el.parentElement;
  } // while
  return null;
} // parentItem

function firstChildItem(item) {
  for (const child of item.children) {
    if (child instanceof AcTreeItem && not(child.disabled)) return child;
  } // for
  return null;
} // firstChildItem

function siblings(item) {
  const parent = item.parentElement;
  if (not(parent)) return [];
  return [...parent.children].filter(c => c instanceof AcTreeItem);
} // siblings

function allItems(root) {
  const items = [];
  collectAll(root.children, items);
  return items;
} // allItems

function collectAll(children, out) {
  for (const child of children) {
    if (not(child instanceof AcTreeItem)) continue;
    out.push(child);
    collectAll(child.children, out);
  } // for
} // collectAll

function selectedItems(root) {
  return allItems(root).filter(item => item.selected);
} // selectedItems

function itemMatchesChar(item, char) {
  return item.label?.toLowerCase().startsWith(char.toLowerCase());
} // itemMatchesChar

function warnMissingLabel(tag) {
  console.warn(`<${tag}>: No accessible label provided. Use label, label-id, or aria-label.`);
} // warnMissingLabel

// === AcTree ===

export class AcTree extends AcBase {
  static observedAttributes = [
    'multiselectable', 'auto-open',
    'label', 'label-id', 'aria-label',
  ];

  #treeEl;
  #labelEl;
  #focusedItem = null;
  #typeBuffer = '';
  #typeTimer = null;
  #ready;

  constructor() {
    super();
    this.#ready = this.#init();
  } // constructor

  async #init() {
    const shadow = await this._initShadow(BASE, 'tree.html', 'tree.css', 'ac-tree');
    this.#treeEl = shadow.getElementById('tree');
    this.#labelEl = shadow.getElementById('label');

    // Listen on the host element so events from slotted tree items
    // are properly received (shadow DOM retargets e.target to the tree-item).
    this.addEventListener('keydown', e => this.#onKeydown(e));
    this.addEventListener('click', e => this.#onClick(e));

    this.#syncLabel();
    this.#syncMultiselectable();
  } // #init

  connectedCallback() {
    this.#ready.then(() => {
      this.#syncLabel();
      this.#waitForItemsThenInit();
    });
  } // connectedCallback

  attributeChangedCallback(name) {
    if (not(this.#treeEl)) return;
    switch (name) {
      case 'label':
      case 'label-id':
      case 'aria-label': this.#syncLabel(); break;
      case 'multiselectable': this.#syncMultiselectable(); break;
    } // switch
  } // attributeChangedCallback

  get autoOpen() { return this.hasAttribute('auto-open'); }
  set autoOpen(v) { this._reflectBoolAttr('auto-open', v); }

  get multiselectable() { return this.hasAttribute('multiselectable'); }
  set multiselectable(v) { this._reflectBoolAttr('multiselectable', v); }

  get value() {
    const selected = selectedItems(this);
    if (this.multiselectable) {
      return selected.map(item => item.value);
    } // if
    return selected.length ? selected[0].value : null;
  } // get value

  // --- Labeling ---

  #syncLabel() {
    const labelId = this.getAttribute('label-id');
    const labelText = this.getAttribute('label');
    const ariaLabel = this.getAttribute('aria-label');

    if (labelId) {
      this.#labelEl.hidden = true;
      this.#treeEl.setAttribute('aria-labelledby', labelId);
      this.#treeEl.removeAttribute('aria-label');
      return;
    } // if labelId

    if (labelText) {
      this.#labelEl.textContent = labelText;
      this.#labelEl.hidden = false;
      this.#treeEl.setAttribute('aria-labelledby', this.#labelEl.id);
      this.#treeEl.removeAttribute('aria-label');
      return;
    } // if labelText

    if (ariaLabel) {
      this.#labelEl.hidden = true;
      this.#treeEl.setAttribute('aria-label', ariaLabel);
      this.#treeEl.removeAttribute('aria-labelledby');
      return;
    } // if ariaLabel

    this.#labelEl.hidden = true;
    warnMissingLabel('ac-tree');
  } // #syncLabel

  #syncMultiselectable() {
    this.#treeEl.setAttribute('aria-multiselectable', String(this.multiselectable));
  } // #syncMultiselectable

  // --- Roving tabindex ---

  #waitForItemsThenInit() {
    const items = allItems(this);
    if (not(items.length)) return;
    Promise.all(items.map(item => item._ready)).then(() => this.#initRovingTabindex());
  } // #waitForItemsThenInit

  #initRovingTabindex() {
    const items = visibleItems(this);
    if (not(items.length)) return;

    for (const item of items) item._setTabindex(-1);
    items[0]._setTabindex(0);
    this.#focusedItem = items[0];
  } // #initRovingTabindex

  #focusItem(item) {
    if (this.#focusedItem) this.#focusedItem._setTabindex(-1);
    item._setTabindex(0);
    item._focus();
    this.#focusedItem = item;
  } // #focusItem

  // --- Keyboard ---

  #onKeydown(e) {
    const items = visibleItems(this);
    if (not(items.length)) return;

    const idx = items.indexOf(this.#focusedItem);
    if (idx === -1) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.#moveFocus(items, idx, 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.#moveFocus(items, idx, -1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        this.#handleRight(items, this.#focusedItem);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        this.#handleLeft(this.#focusedItem);
        break;
      case 'Home':
        e.preventDefault();
        this.#focusItem(items[0]);
        break;
      case 'End':
        e.preventDefault();
        this.#focusItem(items[items.length - 1]);
        break;
      case 'Enter':
        e.preventDefault();
        this.#commitSelection(this.#focusedItem);
        break;
      case ' ':
        e.preventDefault();
        this.#toggleSelection(this.#focusedItem);
        break;
      case '*':
        e.preventDefault();
        this.#expandSiblings(this.#focusedItem);
        break;
      default:
        if (e.key.length === 1 && not(e.ctrlKey) && not(e.altKey) && not(e.metaKey)) {
          this.#typeAhead(e.key, items);
        } // if
    } // switch
  } // #onKeydown

  #moveFocus(items, currentIdx, direction) {
    const next = currentIdx + direction;
    if (next >= 0 && next < items.length) {
      this.#focusItem(items[next]);
    } // if
  } // #moveFocus

  #handleRight(items, item) {
    if (not(item.hasChildren)) return;

    if (not(item.expanded)) {
      item.expanded = true;
      this.#emit('ac-expand', { item });
      if (this.autoOpen) {
        const child = firstChildItem(item);
        if (child) this.#focusItem(child);
      } // if autoOpen
    } else {
      const child = firstChildItem(item);
      if (child) this.#focusItem(child);
    } // if
  } // #handleRight

  #handleLeft(item) {
    if (item.expanded && item.hasChildren) {
      item.expanded = false;
      this.#emit('ac-collapse', { item });
    } else {
      const parent = parentItem(item);
      if (parent) this.#focusItem(parent);
    } // if
  } // #handleLeft

  // --- Selection ---

  #toggleSelection(item) {
    if (this.multiselectable) {
      item.selected = not(item.selected);
      this.#syncValueAttr();
      this.#emit('ac-select', { item, selected: item.selected });
    } else {
      this.#clearSelection();
      item.selected = true;
      this.#syncValueAttr();
      this.#emit('ac-select', { item, selected: true });
    } // if
  } // #toggleSelection

  #commitSelection(item) {
    if (not(this.multiselectable)) {
      this.#clearSelection();
      item.selected = true;
    } // if
    this.#syncValueAttr();
    this.dispatchEvent(new Event('change', { bubbles: true }));
  } // #commitSelection

  #clearSelection() {
    for (const item of selectedItems(this)) {
      item.selected = false;
    } // for
  } // #clearSelection

  #syncValueAttr() {
    const val = this.value;
    if (this.multiselectable) {
      this.setAttribute('value', JSON.stringify(val));
    } else {
      if (val != null) this.setAttribute('value', val);
      else this.removeAttribute('value');
    } // if
  } // #syncValueAttr

  #expandSiblings(item) {
    for (const sib of siblings(item)) {
      if (sib.hasChildren && not(sib.expanded)) {
        sib.expanded = true;
        this.#emit('ac-expand', { item: sib });
      } // if
    } // for
  } // #expandSiblings

  // --- Type-ahead ---

  #typeAhead(char, items) {
    clearTimeout(this.#typeTimer);
    this.#typeBuffer += char;
    this.#typeTimer = setTimeout(() => { this.#typeBuffer = ''; }, 500);

    const startIdx = items.indexOf(this.#focusedItem) + 1;
    const match = this.#findTypeMatch(items, startIdx);
    if (match) this.#focusItem(match);
  } // #typeAhead

  #findTypeMatch(items, startIdx) {
    for (let i = 0; i < items.length; i++) {
      const idx = (startIdx + i) % items.length;
      if (itemMatchesChar(items[idx], this.#typeBuffer)) return items[idx];
    } // for
    return null;
  } // #findTypeMatch

  // --- Click ---

  #onClick(e) {
    const item = e.target.closest?.('ac-tree-item');
    if (not(item) || not(this.contains(item))) return;
    this.#focusItem(item);
    this.#toggleSelection(item);
  } // #onClick

  // --- Events ---

  #emit(name, detail = {}) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
  } // #emit
} // AcTree

// === AcTreeItem ===

export class AcTreeItem extends AcBase {
  static observedAttributes = ['expanded', 'selected', 'disabled', 'label', 'value'];

  #row;
  #group;
  #labelEl;
  #pendingTabindex = -1;

  // Public promise so AcTree can wait for all items to be ready.
  _ready;

  constructor() {
    super();
    this._ready = this.#init();
  } // constructor

  async #init() {
    const shadow = await this._initShadow(BASE, 'tree.html', 'tree.css', 'ac-tree-item');
    this.#row = shadow.querySelector('.row');
    this.#group = shadow.querySelector('.group');
    this.#labelEl = shadow.getElementById('item-label');

    shadow.querySelector('slot').addEventListener('slotchange', () => this.#syncChildren());

    // Apply any tabindex that was set before shadow DOM was ready.
    this.#row.setAttribute('tabindex', String(this.#pendingTabindex));

    this.#syncLabel();
    this.#syncExpanded();
    this.#syncSelected();
    this.#syncLevel();
    this.#syncChildren();
  } // #init

  connectedCallback() {
    this._ready.then(() => {
      this.#syncLevel();
      this.#syncChildren();
    });
  } // connectedCallback

  attributeChangedCallback(name) {
    if (not(this.#row)) return;
    switch (name) {
      case 'expanded': this.#syncExpanded(); break;
      case 'selected': this.#syncSelected(); break;
      case 'label': this.#syncLabel(); break;
      case 'disabled': break; // handled by CSS :host([disabled])
    } // switch
  } // attributeChangedCallback

  // --- Public properties ---

  get label() { return this.getAttribute('label') ?? ''; }
  set label(v) { this._reflectStrAttr('label', v); }

  get value() { return this.getAttribute('value') ?? this.label; }
  set value(v) { this._reflectStrAttr('value', v); }

  get expanded() { return this.hasAttribute('expanded'); }
  set expanded(v) { this._reflectBoolAttr('expanded', v); }

  get selected() { return this.hasAttribute('selected'); }
  set selected(v) { this._reflectBoolAttr('selected', v); }

  get disabled() { return this.hasAttribute('disabled'); }
  set disabled(v) { this._reflectBoolAttr('disabled', v); }

  get hasChildren() { return this.hasAttribute('data-has-children'); }

  // --- Internal API used by AcTree ---

  _setTabindex(value) {
    this.#pendingTabindex = value;
    if (this.#row) this.#row.setAttribute('tabindex', String(value));
  } // _setTabindex

  _focus() {
    this.#row?.focus();
  } // _focus

  // --- Sync helpers ---

  #syncLabel() {
    if (this.#labelEl) this.#labelEl.textContent = this.label;
    if (this.#row) this.#row.setAttribute('aria-label', this.label);
  } // #syncLabel

  #syncExpanded() {
    if (this.hasChildren) {
      this.#row.setAttribute('aria-expanded', String(this.expanded));
      this.#group.hidden = not(this.expanded);
    } else {
      this.#row.removeAttribute('aria-expanded');
      this.#group.hidden = true;
    } // if
  } // #syncExpanded

  #syncSelected() {
    this.#row.setAttribute('aria-selected', String(this.selected));
  } // #syncSelected

  #syncLevel() {
    const level = itemLevel(this);
    this.style.setProperty('--ac-tree-level', String(level));
  } // #syncLevel

  #syncChildren() {
    const hasKids = [...this.children].some(c => c instanceof AcTreeItem);
    if (hasKids) this.setAttribute('data-has-children', '');
    else this.removeAttribute('data-has-children');
    this.#syncExpanded();
  } // #syncChildren
} // AcTreeItem

customElements.define('ac-tree', AcTree);
customElements.define('ac-tree-item', AcTreeItem);
