# Accessible Components — Build Plan

## Project Structure

```
accessible-components/
├── RESEARCH.md
├── PLAN.md
├── index.html              ← demo / test page (listbox combobox + tree)
├── shared/
│   ├── base.js             ← shared base class for fetching template + CSS
│   └── not.js              ← shared not() utility for readable boolean negation
├── combobox/
│   ├── combobox.html        ← single <template> with Shadow DOM markup (div role="listbox")
│   ├── combobox.css         ← component styles
│   └── combobox.js          ← AcCombobox class + registration (uses native <option> children)
├── datalist-combobox/
│   ├── combobox.html        ← single <template> using <datalist> instead of listbox
│   ├── combobox.css         ← component styles (includes visually-hidden for status)
│   ├── combobox.js          ← AcCombobox class — datalist variant + reportMatchCount
│   └── index.html           ← standalone demo page
├── tree/
│   ├── tree.html            ← single <template> with Shadow DOM markup
│   ├── tree.css             ← component styles
│   └── tree.js              ← AcTree + AcTreeItem classes + registration
```

---

## Phase 1: Shared Base

Create a tiny base class that handles the boilerplate every component shares:

1. Resolve paths relative to the component's `.js` file via `import.meta.url`
2. Fetch the `.html` and `.css` files once (cached per class)
3. Attach Shadow DOM and stamp the template
4. Adopt the Constructable Stylesheet
5. Provide helper for `attributeChangedCallback` → property reflection

The base class should be ~50 lines. No framework, no magic.

**File**: `shared/base.js`

---

## Phase 2: Combobox (`ac-combobox`)

### Markup (combobox.html)

A single `<template>` containing:
- A `<label>` element (shown/hidden based on labeling mode — see Labeling below)
- An `<input>` with `role="combobox"`
- A `<div>` for the popup with `role="listbox"`
- A `<slot>` (default) where native `<option>` children are projected
- A toggle button (for `readonly` / select-only mode)

Key `part` attributes: `label`, `input`, `listbox`, `toggle`

### Styles (combobox.css)

- Minimal layout: popup positioned below input, hidden by default
- CSS custom properties: `--ac-combobox-*` for colors, borders, spacing
- Focus/active-descendant highlight styles
- No visual opinions beyond function

### Behavior (combobox.js)

#### Attributes
- `autocomplete` — `none`, `list`, or `both` (default: `none`)
- `open` — boolean, reflects popup state
- `value` — the current value
- `disabled` — boolean
- `readonly` — boolean, makes input non-editable (select-only mode; acts as a styled `<select>` replacement)
- `name` — for form participation
- `label` — visible label text rendered internally by the component
- `label-position` — `above` (default), `below`, `left`, or `right`; controls where the built-in label renders
- `label-id` — ID of an external label element; internal input gets `aria-labelledby` referencing it
- `aria-label` — screen reader–only label (no visible text rendered)

#### Labeling

Three labeling tiers, resolved in priority order:

1. **`label-id="externalId"`** — references an external label element; internal input gets `aria-labelledby="externalId"`
2. **`label="text"` + `label-position`** — component renders a visible `<label>` internally. Position controls layout: `above`/`below` stack vertically, `left`/`right` render inline.
3. **`aria-label="text"`** — screen reader only, no visible label rendered

If none are provided, log a console warning about missing accessible name.

#### State
- `_activeDescendant` — the currently highlighted option
- `_options` — live list of `<option>` elements (from light DOM)
- `_filteredOptions` — subset matching input text

#### Keyboard Handling
- Down/Up Arrow: navigate options via `aria-activedescendant`
- Enter: select active option, close popup
- Escape: close popup
- Home/End: move cursor within input
- Printable characters: filter options (if `autocomplete` is `list` or `both`)

#### Events Emitted
- `ac-select` — when an option is selected (detail: `{ value, label }`)
- `ac-open` / `ac-close` — popup visibility changes
- `ac-input` — when user types (for async filtering use cases)

#### Form Participation
Use `ElementInternals` to participate in native forms (`formAssociated = true`).

### Option Elements

Use native `<option>` elements as children — no custom element needed. Built-in attributes (`value`, `disabled`, `selected`) work as-is. The parent `ac-combobox` queries its light DOM for `<option>` children and manages `role="option"` and `aria-selected` on them. A `MutationObserver` detects dynamically added/removed options.

```html
<ac-combobox label="Fruit">
  <option value="apple">Apple</option>
  <option value="banana">Banana</option>
  <option value="cherry" disabled>Cherry</option>
</ac-combobox>
```

---

## Phase 2b: Datalist Combobox (`datalist-combobox/`)

A second implementation of the combobox pattern that uses the native `<datalist>` element instead of a custom `div[role="listbox"]`. This delegates keyboard control, focus management, and filtering to the browser.

### Advantages over the Listbox Combobox

- **Keyboard control built in** — the browser handles arrow keys, Enter, Escape natively
- **Focus handled by `list` attribute** — no `aria-activedescendant` mechanism needed
- **Filtering built in** — typing into the input filters the datalist automatically

### What the Browser Doesn't Provide

The browser does not expose a count of visible (matching) options while filtering. The component adds `reportMatchCount()` to fill this gap, writing the count to a visually-hidden `role="status"` live region for screen readers.

### Markup (combobox.html)

A single `<template>` containing:
- A `<label>` element (shown/hidden based on labeling mode)
- An `<input>` with `list="listbox"` connecting to the datalist
- A `<datalist id="listbox">` — browser renders the dropdown natively
- A `<div role="status" class="visually-hidden">` for match count announcements
- A `<slot>` where native `<option>` children are projected (data source only)

### Styles (combobox.css)

Same layout and label-position styles as the listbox combobox, plus:
- `.visually-hidden` class — hides the status div visually while keeping it accessible to screen readers

No `.option` styles needed — the browser handles datalist option rendering.

### Behavior (combobox.js)

#### Attributes
- `value` — the current value
- `disabled` — boolean
- `label` — visible label text
- `label-position` — `above` (default), `below`, `left`, or `right`
- `label-id` — ID of an external label element
- `aria-label` — screen reader–only label
- `status-timeout` — seconds before the match count message clears (default: `7`)

#### Match Count Reporting

On every `input` event, `#reportMatchCount()` counts how many `<option>` values in the datalist contain the current input text (case-insensitive), writes `"N items found."` to the `#status` live region, and clears it after `status-timeout` seconds.

#### Events Emitted
- `ac-input` — when user types (detail: `{ value }`)

#### Exported Standalone Helpers

- `reportMatchCount(e)` — standalone function for use with plain `<input list="...">` outside the web component
- `loadList(values, options)` — utility to populate a list/datalist programmatically

### Consumer Usage

```html
<script type="module" src="datalist-combobox/combobox.js"></script>

<ac-combobox label="Favorite fruit" status-timeout="5">
  <option value="apple">Apple</option>
  <option value="banana">Banana</option>
  <option value="cherry">Cherry</option>
</ac-combobox>
```

**Note**: Because both implementations register as `ac-combobox`, only one can be used per page. Import either `combobox/combobox.js` or `datalist-combobox/combobox.js`, not both.

---

## Phase 3: Tree View (`ac-tree`, `ac-tree-item`)

### Markup (tree.html)

A single `<template>` containing:
- A `<div role="tree">` wrapper
- A default `<slot>` for `<ac-tree-item>` children

### Styles (tree.css)

- Indentation via CSS (custom property `--ac-tree-indent` multiplied by level)
- Expand/collapse indicator (CSS triangle or `::before` content)
- Focus and selection highlight
- CSS custom properties: `--ac-tree-*`

### Behavior — `ac-tree` (tree.js)

#### Attributes
- `multiselectable` — boolean
- `auto-open` — boolean; when set, Right Arrow on a closed node expands it AND moves focus to its first child in one keystroke (menu-like navigation). Default (omitted): standard APG two-step behavior.
- `label` — visible label/heading text rendered internally by the component
- `label-id` — ID of an external heading element; tree container gets `aria-labelledby` referencing it
- `aria-label` — screen reader–only label (no visible text rendered)

#### Labeling

Three labeling tiers, same pattern as combobox:

1. **`label-id="externalId"`** — references an external heading; tree container gets `aria-labelledby="externalId"`
2. **`label="text"`** — component renders a visible heading internally
3. **`aria-label="text"`** — screen reader only

If none are provided, log a console warning about missing accessible name.

#### Responsibilities
- Manage roving tabindex across all `ac-tree-item` descendants
- Track which item is focused, which are selected
- Handle keyboard navigation (the tree owns this, not individual items)
- Type-ahead search across visible items

#### Keyboard Handling (managed at tree level)
- Up/Down Arrow: previous/next visible item
- Right Arrow: expand or move to first child (with `auto-open`: expand and move to first child in one step)
- Left Arrow: collapse or move to parent
- Home/End: first/last visible item
- Space: toggle selection (multi-select)
- Enter: activate item
- `*`: expand all siblings
- Type-ahead: jump to matching item

#### Events Emitted
- `ac-select` — selection changes (detail: `{ item, selected }`)
- `ac-activate` — item activated via Enter
- `ac-expand` / `ac-collapse` — item toggled

### Sub-element: `ac-tree-item`

#### Attributes
- `expanded` — boolean (only meaningful if it has children)
- `selected` — boolean
- `disabled` — boolean
- `label` — visible text rendered automatically as the item's label (v1)

#### Responsibilities
- Render its `label` text content as visible label (v1). Future: allow slotted content for richer labels (icons, badges, formatted text).
- Host a `<slot>` for nested `<ac-tree-item>` children (wrapped in `role="group"`)
- Report its state to the parent tree
- Set `aria-expanded` based on whether it has children and is open
- Does NOT own keyboard handling (tree does)

### Consumer Usage

```html
<ac-tree label="File browser">
  <ac-tree-item label="src/" expanded>
    <ac-tree-item label="index.js"></ac-tree-item>
    <ac-tree-item label="components/" expanded>
      <ac-tree-item label="header.js"></ac-tree-item>
      <ac-tree-item label="footer.js"></ac-tree-item>
    </ac-tree-item>
  </ac-tree-item>
  <ac-tree-item label="README.md"></ac-tree-item>
</ac-tree>
```

---

## Phase 4: Demo Page

A single `index.html` that:
- Imports both components via `<script type="module">`
- Shows a combobox with various configurations (autocomplete modes, `readonly` select-only, labeling modes)
- Shows a tree view with nested items
- Includes some custom styling to demonstrate `::part()` and custom properties
- Can be opened directly in a browser — no server required (though fetch needs a local server or data URIs)

---

## Build & Serve

No build step. For development:
- `npx serve .` or `python -m http.server` to serve files locally (needed because `fetch()` and ES modules require HTTP, not `file://`)
- That's it. No npm install required for the library itself.

### Deployment / Integrity

Templates and stylesheets are fetched at runtime via `fetch()` relative to each component's `.js` file. Scripts inside `<template>` do not execute, but attributes such as `onmouseover` on cloned nodes *would* run if the fetched HTML were tampered with in transit. For that reason:

- **Serve the library over HTTPS in any non-local environment.** Plain HTTP leaves the template fetch open to MITM attribute injection.
- If hosting on a third-party CDN, prefer one that enforces HTTPS and consider pinning a specific version path so template contents can't be swapped under you.
- The demo pages ship a CSP meta tag (`default-src 'self'`) as defense-in-depth; retain or tighten it when embedding.

---

## Order of Work

1. `shared/base.js` — shared plumbing
2. `combobox/` — all three files, starting with `.html`, then `.css`, then `.js` (native `<option>` children, no sub-element needed)
3. `tree/` — all three files, same order (includes `ac-tree-item` class)
4. `index.html` — demo page
5. Manual testing with keyboard and screen reader (NVDA or VoiceOver)

---

## Testing Strategy

- **Manual keyboard testing**: Tab into component, navigate with arrow keys, select with Enter, close with Escape
- **Screen reader testing**: NVDA on Windows, VoiceOver on macOS. Verify announcements for role, state, and name.
- **Automated**: Consider adding a simple test page with assertions (no test framework needed — just `console.assert` or a tiny harness). Future phase.

---

## Resolved Questions

1. ~~Should `ac-option` be a full custom element or plain `<option>`?~~ **Resolved: native `<option>` elements.** No custom element needed — `<option>` provides `value`, `disabled`, `selected` natively. The parent combobox manages ARIA attributes on them.
2. ~~Should `ac-tree-item` manage its own Shadow DOM?~~ **Resolved: yes, Shadow DOM.** v1 uses a `label` attribute for visible text. v2 will add slotted content for richer labels.
3. ~~Should we provide a `no-shadow` mode?~~ **Deferred.** Not needed for v1.
