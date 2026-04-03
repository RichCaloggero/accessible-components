# Accessible Components Library — Research

## Goals

Build a set of accessible, easily-styled web components with:

- No build steps — vanilla JS, CSS, and HTML only
- Declarative HTML wherever practical
- Small, understandable, modifiable code
- Each component in its own folder: `.js` (behavior), `.css` (style), `.html` (one `<template>` element)

Starting components: **Combobox** and **Tree View**.

---

## Part 1: WAI-ARIA Patterns

### Combobox (APG Pattern)

A combobox is an input widget with an associated popup that helps users set a value. The popup can be a listbox, grid, tree, or dialog.

#### Variants

| Variant | Description |
|---|---|
| **Select-only** | No text input. User picks from popup only. |
| **No autocomplete** | Text input, but popup doesn't filter. |
| **List autocomplete** | Popup filters to match typed text. User selects manually. |
| **List + auto-select** | Popup filters and first match is auto-highlighted. |
| **Inline autocomplete** | Auto-highlighted match is also completed inline in the input. |

#### Required ARIA

- `role="combobox"` on the input element
- `aria-expanded="true|false"` — popup visibility
- `aria-controls` — references the popup element's `id`
- `aria-haspopup` — `listbox` (default), `grid`, `tree`, or `dialog`
- `aria-activedescendant` — references the currently focused option in the popup (virtual focus)
- `aria-autocomplete` — `none`, `list`, or `both`
- `aria-selected="true"` on the visually highlighted option in the popup
- `aria-label` or `aria-labelledby` for accessible name

#### Keyboard

| Key | Behavior |
|---|---|
| Down Arrow | Open popup, move to first/next option |
| Up Arrow | Open popup, move to last/previous option |
| Escape | Close popup (optionally clear input) |
| Enter | Accept highlighted option, close popup |
| Alt+Down | Open popup without moving focus |
| Home / End | Move cursor to start/end of input |
| Printable chars | Type into input (editable variants) |

#### Focus Model

Comboboxes use **`aria-activedescendant`** (virtual focus). DOM focus stays on the input element at all times. The popup option is visually highlighted and referenced by `aria-activedescendant`. This is critical because:

- The user can keep typing while "focusing" an option
- Screen readers announce the active descendant as if it were focused
- No actual DOM focus movement is needed

### Tree View (APG Pattern)

A tree view presents a hierarchical list. Parent nodes expand/collapse to show/hide children.

#### Required ARIA

- `role="tree"` on the container
- `role="treeitem"` on each node
- `role="group"` wrapping child nodes of a parent
- `aria-expanded="true|false"` on parent nodes (omit on leaf nodes)
- `aria-selected` or `aria-checked` on nodes (never both)
- `aria-multiselectable="true"` on the tree container for multi-select
- `aria-label` or `aria-labelledby` on the tree container
- `aria-level`, `aria-setsize`, `aria-posinset` for dynamically loaded trees

#### Keyboard

| Key | Behavior |
|---|---|
| Down Arrow | Next visible node |
| Up Arrow | Previous visible node |
| Right Arrow | Expand closed node; or move to first child |
| Left Arrow | Collapse open node; or move to parent |
| Home | First node |
| End | Last visible node |
| Enter | Activate node |
| Space | Toggle selection (multi-select) |
| `*` (asterisk) | Expand all siblings at same level |
| Type-ahead | Jump to node starting with typed character(s) |

#### Focus Model

Trees typically use **roving tabindex** — the focused node gets `tabindex="0"` and all others get `tabindex="-1"`. When the tree loses and regains focus, the last-focused node is restored. This is more appropriate than `aria-activedescendant` here because there is no persistent input element holding focus.

#### Single vs Multi-select

- **Single-select**: Selection can optionally follow focus. Simpler keyboard model.
- **Multi-select**: Space toggles selection. Shift+Arrow extends selection. Ctrl+A selects all. Visual distinction between focused and selected nodes is critical.

---

## Part 2: Existing Libraries & Implementations

### React-based (for reference, not to adopt)

| Library | Approach | Notes |
|---|---|---|
| **Downshift** (Kent C. Dodds) | Headless hooks (`useCombobox`, `useSelect`) | Pure logic, no DOM opinions. Gold standard for combobox state management. Manages `aria-activedescendant`, keyboard, and selection. |
| **React Aria** (Adobe) | Headless hooks + behavior | Extremely thorough ARIA. Separates state, behavior, and rendering completely. Internationalization built-in. Heavy. |
| **Radix UI** | Unstyled primitives | Compound component pattern (`<Combobox.Root>`, `.Input`, `.Option`). Good DX. React-only. |
| **Headless UI** (Tailwind Labs) | Unstyled primitives | Combobox and Listbox. React and Vue. Clean API. |

### Web Component / Vanilla

| Library | Approach | Notes |
|---|---|---|
| **Lion Web Components** (ING Bank) | Lit-based, white-label | Extensive ARIA. `lion-combobox`, `lion-treeview` (limited). Requires Lit and npm. Heavy dependency tree. |
| **Shoelace / Web Awesome** | Lit-based, styled | Polished components. Build step required (Lit). Has `<sl-tree>` and `<sl-tree-item>`. No combobox currently. |
| **Generic Components** (Pascal Schilp) | Vanilla custom elements | Minimal. `generic-listbox`, `generic-disclosure`. No combobox or tree. Focuses on primitives. Very close to our philosophy. |
| **GitHub Catalyst** | Vanilla custom elements | GitHub's internal framework. Decorators for actions/targets. Minimal. No ARIA components per se. |
| **FAST** (Microsoft) | Custom elements + design system | Well-architected. `fast-combobox`, `fast-tree-view`. But requires `@microsoft/fast-element` and a build step in practice. |

### Key Takeaways from Existing Work

1. **Headless/unstyled is the winning pattern** — Downshift and React Aria proved that separating logic from rendering is powerful.
2. **Most web component libraries require build steps** — Lit, FAST, and Stencil all need compilation. Truly vanilla approaches are rare.
3. **Generic Components is closest to our philosophy** but has limited scope.
4. **Microsoft FAST** has the best web-component-native combobox and tree, but is too heavy.
5. **Nobody is doing the three-file split** (`.js`, `.css`, `.html` with a template) in a no-build way. This is a genuine gap.

---

## Part 3: Architecture — No Build Step Web Components

### How the Three Files Wire Together

The component's `.js` file is the entry point. It:

1. **Fetches the `.html` template** at registration time
2. **Adopts the `.css` styles** via Constructable Stylesheets or a `<link>` in Shadow DOM
3. **Defines the custom element** with `customElements.define()`

#### Option A: Fetch + Shadow DOM (Recommended)

```
// combobox/combobox.js
const base = new URL('.', import.meta.url);       // works with ES modules
const html = await fetch(new URL('combobox.html', base)).then(r => r.text());
const css  = await fetch(new URL('combobox.css', base)).then(r => r.text());

const parser = new DOMParser();
const doc = parser.parseFromString(html, 'text/html');
const template = doc.querySelector('template');

const sheet = new CSSStyleSheet();
sheet.replaceSync(css);

class AcCombobox extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [sheet];
    shadow.appendChild(template.content.cloneNode(true));
  }
}

customElements.define('ac-combobox', AcCombobox);
```

**Pros**: Clean separation. `import.meta.url` resolves paths relative to the JS file. Constructable Stylesheets are performant and shared across instances.

**Cons**: Two fetches per component on first load. Requires top-level `await` or wrapping in an async IIFE.

#### Option B: Light DOM (No Shadow DOM)

Skip Shadow DOM entirely. The template's content is stamped into the element's light DOM. CSS is loaded via a regular `<link>` tag or scoped with a class/attribute convention.

**Pros**: Maximum styling flexibility — any external CSS can style internals. Simpler mental model.

**Cons**: No style encapsulation. Component internals are part of the document's DOM. Name collisions possible.

#### Option C: Declarative Shadow DOM

The template in the `.html` file includes `<template shadowrootmode="open">`. The component's markup can be written directly in the page HTML with no JS needed for initial render.

**Pros**: Works before JS loads (progressive enhancement). Server-renderable.

**Cons**: Styles must be inline in the template. Harder to share CSS across instances. Each instance carries its own Shadow DOM markup in the HTML source.

### Recommendation

**Option A (Fetch + Shadow DOM)** with `::part()` exports for styling flexibility. This gives us:

- Clean file separation
- Style encapsulation by default
- Explicit styling hooks via `part` attributes
- CSS custom properties that pierce the shadow boundary for theming
- No build step — just ES modules and `fetch()`

### Styling Strategy

For "easily styled" components:

1. **CSS Custom Properties** for theming (colors, spacing, fonts, borders). These inherit through Shadow DOM.
2. **`::part()` pseudo-element** for direct styling of internal elements. Each styleable internal element gets a `part="name"` attribute.
3. **`<slot>` elements** for user-provided content that retains its original styling context.
4. **Minimal default styles** — just enough for the component to function. No opinionated visual design.

Example consumer usage:
```css
ac-combobox::part(input) { border: 2px solid navy; }
ac-combobox::part(listbox) { max-height: 300px; }
ac-combobox { --ac-focus-color: blue; --ac-border-radius: 4px; }
```

### Declarative HTML

"Declarative" in this context means:

- **Attributes drive behavior**: `<ac-combobox autocomplete="list" required>` — not `combobox.setAutocomplete('list')`
- **Slotted content for data**: Options come from the HTML, not from JS arrays:
  ```html
  <ac-combobox>
    <ac-option value="apple">Apple</ac-option>
    <ac-option value="banana">Banana</ac-option>
  </ac-combobox>
  ```
- **Progressive enhancement where possible**: The component should be usable (or at least readable) before JS loads.

---

## Part 4: Design Decisions for Our Components

### Combobox Decisions

| Decision | Recommendation | Rationale |
|---|---|---|
| Popup type | Listbox only (for now) | Grid/tree/dialog popups are rare. Start simple. |
| Autocomplete | Support `none`, `list`, `both` via attribute | Covers all common use cases. |
| Focus model | `aria-activedescendant` | Required by ARIA pattern. DOM focus stays on input. |
| Filtering | Client-side by default, with a hook for async | Most use cases are client-side. Emit events for server-side. |
| Multi-select | Defer to v2 | Significantly more complex. Single-select first. |
| Option source | Slotted `<ac-option>` elements or `<option>` elements | Declarative, inspectable, SSR-friendly. |
| Select-only mode | Support via attribute (`editable="false"` or similar) | Common use case (custom `<select>` replacement). |

### Tree View Decisions

| Decision | Recommendation | Rationale |
|---|---|---|
| Focus model | Roving tabindex | Standard for tree views. One node is tabbable at a time. |
| Selection | Single-select initially, multi-select via attribute | Multi-select is important for trees but can be added incrementally. |
| Data source | Nested slotted `<ac-tree-item>` elements | Declarative. Mirrors the tree structure in markup. |
| Lazy loading | Defer to v2 | Emit events for expand; consumer can add children dynamically. |
| Drag and drop | Out of scope | Complex, orthogonal concern. |
| Type-ahead | Yes | Required by ARIA pattern when 7+ nodes. |

### Shared Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Shadow DOM | Yes, open mode | Encapsulation + `::part()` for styling. |
| Naming prefix | `ac-` (accessible components) | Short, unlikely to collide. |
| Template loading | Fetch `.html` at module load time | Clean separation. One-time cost. Cacheable. |
| CSS loading | Constructable Stylesheets | Performant, shared across instances. |
| Event pattern | Emit custom events (`ac-select`, `ac-expand`, etc.) | Standard DOM pattern. Composable. |
| Attribute reflection | Yes, for all ARIA-relevant state | `attributeChangedCallback` keeps DOM and state in sync. |

---

## Part 5: Prior Art Worth Studying

- **W3C APG Example Implementations**: https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/ and https://www.w3.org/WAI/ARIA/apg/patterns/treeview/examples/
- **Downshift source**: For combobox state machine logic
- **FAST tree-view source**: For web-component tree implementation patterns
- **Generic Components**: For minimal vanilla custom element patterns
- **Open UI Selectlist explainer**: For the future direction of native select/combobox
