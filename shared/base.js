const docCache = new Map();
const sheetCache = new Map();

async function fetchDoc(baseURL, htmlFile) {
  const url = new URL(htmlFile, baseURL);
  const key = url.href;
  if (docCache.has(key)) return docCache.get(key);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch template ${key}: ${res.status} ${res.statusText}`);
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  docCache.set(key, doc);
  return doc;
} // fetchDoc

async function fetchTemplate(baseURL, htmlFile, templateId) {
  const doc = await fetchDoc(baseURL, htmlFile);
  const selector = templateId ? `template#${templateId}` : 'template';
  return doc.querySelector(selector);
} // fetchTemplate

async function fetchSheet(baseURL, cssFile) {
  const url = new URL(cssFile, baseURL);
  const key = url.href;
  if (sheetCache.has(key)) return sheetCache.get(key);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch stylesheet ${key}: ${res.status} ${res.statusText}`);
  const css = await res.text();
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  sheetCache.set(key, sheet);
  return sheet;
} // fetchSheet

export function not (x) {return !x;}

export class AcBase extends HTMLElement {
  async _initShadow(baseURL, htmlFile, cssFile, templateId) {
    const [template, sheet] = await Promise.all([
      fetchTemplate(baseURL, htmlFile, templateId),
      fetchSheet(baseURL, cssFile),
    ]);
    if (!template) throw new Error(`Template ${templateId ?? '(default)'} not found in ${htmlFile}`);
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [sheet];
    shadow.appendChild(template.content.cloneNode(true));
    return shadow;
  } // _initShadow

  _reflectBoolAttr(name, value) {
    if (value) this.setAttribute(name, '');
    else this.removeAttribute(name);
  } // _reflectBoolAttr

  _reflectStrAttr(name, value) {
    if (value == null) this.removeAttribute(name);
    else this.setAttribute(name, value);
  } // _reflectStrAttr
} // AcBase
