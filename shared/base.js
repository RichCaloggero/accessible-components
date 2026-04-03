const docCache = new Map();
const sheetCache = new Map();

async function fetchDoc(baseURL, htmlFile) {
  const key = new URL(htmlFile, baseURL).href;
  if (docCache.has(key)) return docCache.get(key);

  const html = await fetch(new URL(htmlFile, baseURL)).then(r => r.text());
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
  const key = new URL(cssFile, baseURL).href;
  if (sheetCache.has(key)) return sheetCache.get(key);

  const css = await fetch(new URL(cssFile, baseURL)).then(r => r.text());
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  sheetCache.set(key, sheet);
  return sheet;
} // fetchSheet

export class AcBase extends HTMLElement {
  async _initShadow(baseURL, htmlFile, cssFile, templateId) {
    const [template, sheet] = await Promise.all([
      fetchTemplate(baseURL, htmlFile, templateId),
      fetchSheet(baseURL, cssFile),
    ]);
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
