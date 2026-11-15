import { getDocument, GlobalWorkerOptions } from './vendor/pdf.mjs';

GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.min.mjs', import.meta.url).href;

const { PDFDocument } = window.PDFLib;
const fileInput = document.querySelector('#fileInput');
const chooseButtons = ['#chooseFiles', '#addFilesTop', '#addMore'].map((selector) => document.querySelector(selector));
const dropZone = document.querySelector('#dropZone');
const workspace = document.querySelector('#workspace');
const savePanel = document.querySelector('#savePanel');
const pageGrid = document.querySelector('#pageGrid');
const summaryPill = document.querySelector('#summaryPill');
const statusMessage = document.querySelector('#statusMessage');
const outputName = document.querySelector('#outputName');
const saveButton = document.querySelector('#saveButton');
const saveForm = document.querySelector('#saveForm');
const splitPanel = document.querySelector('#splitPanel');
const splitRanges = document.querySelector('#splitRanges');
const splitName = document.querySelector('#splitName');
const splitButton = document.querySelector('#splitButton');
const extractPanel = document.querySelector('#extractPanel');
const extractRanges = document.querySelector('#extractRanges');
const extractName = document.querySelector('#extractName');
const extractButton = document.querySelector('#extractButton');
const cropDialog = document.querySelector('#cropDialog');
const cropForm = document.querySelector('#cropForm');
const cropError = document.querySelector('#cropError');
const modePanel = document.querySelector('#modePanel');
const toolPanels = {
  Edit: document.querySelector('#editTools'),
  Stamp: document.querySelector('#stampTools'),
  Convert: document.querySelector('#convertTools'),
  Finish: document.querySelector('#finishTools'),
};
const pageTitle = document.querySelector('#pageTitle');
const pageEyebrow = document.querySelector('#pageEyebrow');
const pageSubtitle = document.querySelector('#pageSubtitle');
const editPage = document.querySelector('#editPage');
const editType = document.querySelector('#editType');
const editShape = document.querySelector('#editShape');
const editText = document.querySelector('#editText');
const editImage = document.querySelector('#editImage');
const formFields = document.querySelector('#formFields');
const formFieldList = document.querySelector('#formFieldList');
const compareInput = document.querySelector('#compareInput');
const imageInput = document.querySelector('#imageInput');

const documents = [];
let pages = [];
let busy = false;
let draggedPageId = null;
let croppingPageId = null;
let currentMode = 'Organise';
let stamps = { watermark: '', header: '', footer: '', pageNumbers: false, date: false };
let metadata = { title: '', author: '', subject: '', remove: false };
let compareBytes = null;

chooseButtons.forEach((button) => button.addEventListener('click', () => fileInput.click()));
document.querySelectorAll('.nav-item[data-mode]').forEach((button) => button.addEventListener('click', () => setMode(button.dataset.mode)));
editType.addEventListener('change', updateEditControls);
document.querySelector('#applyEdit').addEventListener('click', applyEditToSelectedPage);
document.querySelector('#clearPageEdits').addEventListener('click', clearSelectedPageEdits);
document.querySelector('#applyStamps').addEventListener('click', () => {
  stamps = {
    watermark: document.querySelector('#watermarkText').value.trim(),
    header: document.querySelector('#headerText').value.trim(),
    footer: document.querySelector('#footerText').value.trim(),
    pageNumbers: document.querySelector('#pageNumbers').checked,
    date: document.querySelector('#dateStamp').checked,
  };
  announce('Stamps will be applied to the saved PDF.');
});
document.querySelector('#clearStamps').addEventListener('click', () => {
  stamps = { watermark: '', header: '', footer: '', pageNumbers: false, date: false };
  document.querySelector('#watermarkText').value = '';
  document.querySelector('#headerText').value = '';
  document.querySelector('#footerText').value = '';
  document.querySelector('#pageNumbers').checked = false;
  document.querySelector('#dateStamp').checked = false;
  announce('Stamps cleared.');
});
document.querySelector('#imagesToPdf').addEventListener('click', imagesToPdf);
document.querySelector('#pdfToImages').addEventListener('click', pdfToImages);
document.querySelector('#pdfToText').addEventListener('click', pdfToText);
document.querySelector('#saveMetadata').addEventListener('click', () => {
  metadata = {
    title: document.querySelector('#metaTitle').value.trim(),
    author: document.querySelector('#metaAuthor').value.trim(),
    subject: document.querySelector('#metaSubject').value.trim(),
    remove: false,
  };
  announce('PDF details will be updated when you save.');
});
document.querySelector('#removeMetadata').addEventListener('click', () => {
  metadata = { title: '', author: '', subject: '', remove: true };
  document.querySelector('#metaTitle').value = '';
  document.querySelector('#metaAuthor').value = '';
  document.querySelector('#metaSubject').value = '';
  announce('Original document details will be removed from the saved PDF.');
});
document.querySelector('#compressPdf').addEventListener('click', compressAndSavePdf);
compareInput.addEventListener('change', async () => {
  compareBytes = compareInput.files[0] ? new Uint8Array(await compareInput.files[0].arrayBuffer()) : null;
});
document.querySelector('#comparePdfs').addEventListener('click', comparePdfs);
document.querySelector('#toggleSplitPanel').addEventListener('click', () => {
  splitPanel.classList.toggle('hidden');
  if (!splitPanel.classList.contains('hidden')) splitRanges.focus();
});
document.querySelector('#toggleExtractPanel').addEventListener('click', () => {
  extractPanel.classList.toggle('hidden');
  if (!extractPanel.classList.contains('hidden')) extractRanges.focus();
});
document.querySelector('#insertBlankEnd').addEventListener('click', () => insertBlankPage(pages.length));
fileInput.addEventListener('change', async () => {
  await addFiles([...fileInput.files]);
  fileInput.value = '';
});

for (const eventName of ['dragenter', 'dragover']) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add('drag-active');
  });
}
for (const eventName of ['dragleave', 'drop']) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    if (eventName === 'drop') addFiles([...event.dataTransfer.files]);
    dropZone.classList.remove('drag-active');
  });
}

document.addEventListener('dragover', (event) => event.preventDefault());
document.addEventListener('drop', (event) => {
  if (!dropZone.contains(event.target)) event.preventDefault();
});

document.querySelector('#clearAll').addEventListener('click', () => {
  documents.length = 0;
  pages = [];
  fileInput.value = '';
  updateView();
  announce('All selected PDFs were cleared from this workspace.');
});

pageGrid.addEventListener('click', (event) => {
  const actionButton = event.target.closest('[data-action]');
  if (actionButton) {
    const pageId = actionButton.closest('.page-card')?.dataset.pageId;
    if (actionButton.dataset.action === 'rotate-left') rotatePage(pageId, -90);
    if (actionButton.dataset.action === 'rotate-right') rotatePage(pageId, 90);
    if (actionButton.dataset.action === 'duplicate') duplicatePage(pageId);
    if (actionButton.dataset.action === 'delete') deletePage(pageId);
    if (actionButton.dataset.action === 'insert-before') insertBlankPage(pages.findIndex((page) => page.id === pageId));
    if (actionButton.dataset.action === 'crop') openCropDialog(pageId);
    return;
  }
  const button = event.target.closest('[data-move]');
  if (!button) return;
  const id = button.closest('.page-card')?.dataset.pageId;
  const index = pages.findIndex((page) => page.id === id);
  const nextIndex = index + Number(button.dataset.move);
  if (index < 0 || nextIndex < 0 || nextIndex >= pages.length) return;
  [pages[index], pages[nextIndex]] = [pages[nextIndex], pages[index]];
  renderPageCards();
  announce(`Page moved to position ${nextIndex + 1}.`);
});

pageGrid.addEventListener('dragstart', (event) => {
  const card = event.target.closest('.page-card');
  if (!card) return;
  draggedPageId = card.dataset.pageId;
  card.classList.add('dragging');
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', draggedPageId);
});

pageGrid.addEventListener('dragend', () => {
  draggedPageId = null;
  pageGrid.querySelectorAll('.page-card').forEach((card) => card.classList.remove('dragging', 'drag-target'));
});

pageGrid.addEventListener('dragover', (event) => {
  const target = event.target.closest('.page-card');
  if (!target || target.dataset.pageId === draggedPageId) return;
  event.preventDefault();
  pageGrid.querySelectorAll('.drag-target').forEach((card) => card.classList.remove('drag-target'));
  target.classList.add('drag-target');
  event.dataTransfer.dropEffect = 'move';
});

pageGrid.addEventListener('drop', (event) => {
  const target = event.target.closest('.page-card');
  if (!target || !draggedPageId || target.dataset.pageId === draggedPageId) return;
  event.preventDefault();
  const from = pages.findIndex((page) => page.id === draggedPageId);
  const to = pages.findIndex((page) => page.id === target.dataset.pageId);
  if (from < 0 || to < 0) return;
  const [page] = pages.splice(from, 1);
  pages.splice(to, 0, page);
  renderPageCards();
  announce(`Page moved to position ${to + 1}.`);
});

saveForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (busy || pages.length === 0) return;
  const requestedName = outputName.value.trim().replace(/[\\/:*?"<>|]/g, '-').replace(/\.pdf$/i, '');
  if (!requestedName) {
    outputName.focus();
    announce('Enter a filename before saving.', true);
    return;
  }
  await saveMergedPdf(`${requestedName}.pdf`);
});

splitPanel.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (busy || pages.length === 0) return;
  const requestedName = splitName.value.trim().replace(/[\\/:*?"<>|]/g, '-').replace(/\.zip$/i, '');
  if (!requestedName) {
    splitName.focus();
    announce('Enter a ZIP filename before splitting.', true);
    return;
  }
  const ranges = parsePageRanges(splitRanges.value, pages.length);
  if (ranges.error) {
    splitRanges.focus();
    announce(ranges.error, true);
    return;
  }
  await splitIntoRanges(ranges.value, `${requestedName}.zip`);
});

extractPanel.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (busy || pages.length === 0) return;
  const requestedName = extractName.value.trim().replace(/[\\/:*?"<>|]/g, '-').replace(/\.pdf$/i, '');
  if (!requestedName) {
    extractName.focus();
    announce('Enter a filename before extracting pages.', true);
    return;
  }
  const ranges = parsePageRanges(extractRanges.value, pages.length);
  if (ranges.error) {
    extractRanges.focus();
    announce(ranges.error, true);
    return;
  }
  await extractSelectedPages(ranges.value, `${requestedName}.pdf`);
});

document.querySelector('#closeCrop').addEventListener('click', () => cropDialog.close());
document.querySelector('#resetCrop').addEventListener('click', async () => {
  const page = pages.find((item) => item.id === croppingPageId);
  if (page) {
    page.crop = null;
    await refreshPageThumbnail(page);
    renderPageCards();
    announce('Crop reset.');
  }
  cropDialog.close();
});
cropForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const values = ['Top', 'Right', 'Bottom', 'Left'].map((edge) => Number(document.querySelector(`#crop${edge}`).value));
  if (values.some((value) => !Number.isFinite(value) || value < 0 || value > 45)) {
    cropError.textContent = 'Enter a value from 0 to 45 for each edge.';
    return;
  }
  if (values[1] + values[3] >= 95 || values[0] + values[2] >= 95) {
    cropError.textContent = 'The selected crop would leave too little of the page.';
    return;
  }
  const page = pages.find((item) => item.id === croppingPageId);
  if (!page) return cropDialog.close();
  page.crop = { top: values[0], right: values[1], bottom: values[2], left: values[3] };
  await refreshPageThumbnail(page);
  renderPageCards();
  cropDialog.close();
  announce('Crop applied to this page.');
});

async function addFiles(files) {
  const pdfs = files.filter((file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
  if (!pdfs.length) {
    announce('Choose PDF files to add.', true);
    return;
  }
  setBusy(true, 'Reading your PDFs…');
  try {
    for (const file of pdfs) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const source = await PDFDocument.load(bytes, { updateMetadata: false });
      const previewDocument = await getDocument({ data: bytes.slice() }).promise;
      const documentIndex = documents.length;
      const entry = { id: `doc-${documentIndex}-${Date.now()}`, file, bytes, source, previewDocument };
      documents.push(entry);
      inspectFormFields(entry, documentIndex);
      for (let pageIndex = 0; pageIndex < source.getPageCount(); pageIndex += 1) {
        pages.push({
          id: `${entry.id}-page-${pageIndex}`,
          documentIndex,
          pageIndex,
          pageLabel: pageIndex + 1,
          fileName: file.name,
          canvas: await renderThumbnail(previewDocument, pageIndex + 1),
          rotation: 0,
          crop: null,
          blank: false,
          edits: [],
        });
        if (pages.length % 8 === 0) await nextFrame();
      }
    }
    updateView();
    const count = pdfs.length;
    announce(`${count} PDF${count === 1 ? '' : 's'} added. Arrange the pages, then save your merged file.`);
  } catch (error) {
    console.error(error);
    announce('A PDF could not be opened. It may be damaged or password-protected. Remove it and try another file.', true);
  } finally {
    setBusy(false);
  }
}

async function renderThumbnail(pdf, pageNumber, rotation = 0, crop = null) {
  const page = await pdf.getPage(pageNumber);
  const totalRotation = normalizeRotation(page.rotate + rotation);
  const base = page.getViewport({ scale: 1, rotation: totalRotation });
  const scale = Math.min(0.33, 126 / base.width, 145 / base.height);
  const viewport = page.getViewport({ scale, rotation: totalRotation });
  const rendered = document.createElement('canvas');
  const context = rendered.getContext('2d', { alpha: false });
  rendered.width = Math.ceil(viewport.width);
  rendered.height = Math.ceil(viewport.height);
  await page.render({ canvasContext: context, viewport, background: '#ffffff' }).promise;
  if (!crop) return rendered.toDataURL('image/jpeg', 0.72);
  const x = Math.floor(rendered.width * crop.left / 100);
  const y = Math.floor(rendered.height * crop.top / 100);
  const width = Math.max(1, Math.ceil(rendered.width * (100 - crop.left - crop.right) / 100));
  const height = Math.max(1, Math.ceil(rendered.height * (100 - crop.top - crop.bottom) / 100));
  const cropped = document.createElement('canvas');
  cropped.width = width;
  cropped.height = height;
  cropped.getContext('2d', { alpha: false }).drawImage(rendered, x, y, width, height, 0, 0, width, height);
  return cropped.toDataURL('image/jpeg', 0.72);
}

function setMode(mode) {
  currentMode = mode;
  document.querySelectorAll('.nav-item[data-mode]').forEach((button) => button.classList.toggle('active', button.dataset.mode === mode));
  const headings = {
    Organise: ['ORGANISE YOUR PAGES', 'Merge PDFs', 'Bring files together, arrange every page, and save a fresh PDF.'],
    Edit: ['EDIT YOUR PDF', 'Edit pages', 'Add text, images, annotations, and form values to selected pages.'],
    Stamp: ['STAMP YOUR PDF', 'Apply page stamps', 'Add watermarks, page numbers, headers, footers, or today’s date.'],
    Convert: ['CONVERT FILES', 'Convert PDFs and images', 'Convert locally without uploading your files.'],
    Finish: ['FINAL CHECKS', 'Finish your PDF', 'Adjust details, compare files, and check the output size.'],
  };
  const [eyebrow, title, subtitle] = headings[mode] || headings.Organise;
  pageEyebrow.textContent = eyebrow;
  pageTitle.textContent = title;
  pageSubtitle.textContent = subtitle;
  modePanel.classList.toggle('hidden', mode === 'Organise');
  for (const [panelMode, panel] of Object.entries(toolPanels)) panel.classList.toggle('hidden', panelMode !== mode);
  workspace.classList.toggle('organise-view', mode === 'Organise');
  updateEditorPageOptions();
  updateView();
}

function updateEditorPageOptions() {
  if (!editPage) return;
  const current = editPage.value;
  editPage.replaceChildren();
  pages.forEach((page, index) => {
    const option = document.createElement('option');
    option.value = page.id;
    option.textContent = `${index + 1}. ${page.blank ? 'Blank page' : `${page.fileName} — page ${page.pageLabel}`}`;
    editPage.append(option);
  });
  if (pages.some((page) => page.id === current)) editPage.value = current;
}

function updateEditControls() {
  const type = editType.value;
  document.querySelector('.edit-text-field').classList.toggle('hidden', !['text', 'signature'].includes(type));
  document.querySelector('.edit-image-field').classList.toggle('hidden', type !== 'image');
  document.querySelector('.edit-shape-field').classList.toggle('hidden', type !== 'shape');
}

function inspectFormFields(entry) {
  try {
    entry.form = entry.source.getForm();
  } catch {
    entry.form = null;
  }
  renderFormFieldList();
}

function renderFormFieldList() {
  formFieldList.replaceChildren();
  let count = 0;
  documents.forEach((entry, documentIndex) => {
    if (!entry.form) return;
    let fields = [];
    try { fields = entry.form.getFields(); } catch { return; }
    fields.forEach((field) => {
      count += 1;
      const row = document.createElement('div');
      row.className = 'form-field-row';
      const label = document.createElement('label');
      label.textContent = `${entry.file.name}: ${field.getName()}`;
      label.title = label.textContent;
      let control;
      const className = field.constructor.name;
      if (className.includes('CheckBox')) {
        control = document.createElement('input');
        control.type = 'checkbox';
        try { control.checked = field.isChecked(); } catch {}
        control.addEventListener('change', () => setFormValue(documentIndex, field.getName(), control.checked));
      } else if (className.includes('Dropdown') || className.includes('RadioGroup')) {
        control = document.createElement('select');
        const options = typeof field.getOptions === 'function' ? field.getOptions() : [];
        options.forEach((value) => {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = value;
          control.append(option);
        });
        try {
          const selected = field.getSelected();
          control.value = Array.isArray(selected) ? selected[0] : selected;
        } catch {}
        control.addEventListener('change', () => setFormValue(documentIndex, field.getName(), control.value));
      } else if (className.includes('TextField')) {
        control = document.createElement('input');
        control.type = 'text';
        try { control.value = field.getText() || ''; } catch {}
        control.addEventListener('change', () => setFormValue(documentIndex, field.getName(), control.value));
      } else {
        control = document.createElement('span');
        control.textContent = 'Unsupported form field';
      }
      row.append(label, control);
      formFieldList.append(row);
    });
  });
  formFields.classList.toggle('hidden', count === 0);
}

function setFormValue(documentIndex, name, value) {
  const entry = documents[documentIndex];
  if (!entry?.form) return;
  try {
    const field = entry.form.getField(name);
    const className = field.constructor.name;
    if (className.includes('CheckBox')) value ? field.check() : field.uncheck();
    else if (className.includes('Dropdown') || className.includes('RadioGroup')) field.select(value);
    else if (className.includes('TextField')) field.setText(String(value));
    announce(`Form field “${name}” updated. It will be included when you save.`);
  } catch {
    announce(`Could not update “${name}”. Check the field value.`, true);
  }
}

async function applyEditToSelectedPage() {
  const page = pages.find((item) => item.id === editPage.value);
  if (!page) return announce('Add a PDF and choose a page first.', true);
  const edit = {
    type: editType.value,
    text: editText.value,
    shape: editShape.value,
    size: Number(document.querySelector('#editFontSize').value) || 18,
    color: document.querySelector('#editColor').value,
    x: Number(document.querySelector('#editX').value),
    y: Number(document.querySelector('#editY').value),
    width: Number(document.querySelector('#editWidth').value),
    height: Number(document.querySelector('#editHeight').value),
  };
  if ([edit.x, edit.y, edit.width, edit.height].some((value) => !Number.isFinite(value) || value < 0) || edit.x + edit.width > 100 || edit.y + edit.height > 100) {
    return announce('Keep the position and size inside the page edges.', true);
  }
  if (['text', 'signature'].includes(edit.type) && !edit.text.trim()) return announce('Enter text before applying this tool.', true);
  if (edit.type === 'image') {
    const file = editImage.files[0];
    if (!file) return announce('Choose a PNG or JPEG image first.', true);
    edit.dataUrl = await fileToDataUrl(file);
    edit.imageType = file.type;
  }
  page.edits ||= [];
  page.edits.push(edit);
  await refreshPageThumbnail(page);
  renderPageCards();
  announce(`${edit.type === 'redact' ? 'Redaction' : 'Edit'} added to page ${pages.indexOf(page) + 1}. It will be applied when you save.`);
}

async function clearSelectedPageEdits() {
  const page = pages.find((item) => item.id === editPage.value);
  if (!page) return;
  page.edits = [];
  await refreshPageThumbnail(page);
  renderPageCards();
  announce('Edits cleared from this page.');
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function updateView() {
  const hasPages = pages.length > 0;
  dropZone.classList.toggle('hidden', hasPages);
  workspace.classList.toggle('hidden', !hasPages);
  savePanel.classList.toggle('hidden', !hasPages);
  workspace.classList.toggle('organise-view', currentMode === 'Organise');
  modePanel.classList.toggle('hidden', currentMode === 'Organise');
  for (const [mode, panel] of Object.entries(toolPanels)) panel.classList.toggle('hidden', mode !== currentMode);
  summaryPill.textContent = `${pages.length} page${pages.length === 1 ? '' : 's'} · ${documents.length} PDF${documents.length === 1 ? '' : 's'}`;
  updateEditorPageOptions();
  renderPageCards();
}

function renderPageCards() {
  pageGrid.replaceChildren();
  pages.forEach((page, index) => {
    const card = document.createElement('article');
    card.className = 'page-card';
    card.draggable = true;
    card.dataset.pageId = page.id;
    const preview = document.createElement('div');
    preview.className = 'page-preview';
    const image = document.createElement('img');
    image.src = page.canvas;
    image.alt = `Preview of page ${page.pageLabel} from ${page.fileName}`;
    image.draggable = false;
    preview.append(image);

    const meta = document.createElement('div');
    meta.className = 'page-meta';
    const number = document.createElement('span');
    number.className = 'page-number';
    number.textContent = String(index + 1);
    const file = document.createElement('div');
    file.className = 'page-file';
    const name = document.createElement('strong');
    name.title = page.fileName;
    name.textContent = page.fileName;
    const detail = document.createElement('span');
    detail.textContent = page.blank ? 'Blank page' : `Original page ${page.pageLabel}${page.rotation ? ` · ${page.rotation}°` : ''}`;
    file.append(name, detail);
    meta.append(number, file);

    const actions = document.createElement('div');
    actions.className = 'page-actions';
    actions.setAttribute('aria-label', `Reorder page ${index + 1}`);
    actions.append(makeMoveButton('↑', -1, index === 0, `Move page ${index + 1} up`));
    actions.append(makeMoveButton('↓', 1, index === pages.length - 1, `Move page ${index + 1} down`));
    actions.append(makeActionButton('↶', 'rotate-left', `Rotate page ${index + 1} left`));
    actions.append(makeActionButton('↷', 'rotate-right', `Rotate page ${index + 1} right`));
    actions.append(makeActionButton('⧉', 'duplicate', `Duplicate page ${index + 1}`));
    actions.append(makeActionButton('+', 'insert-before', `Insert a blank page before page ${index + 1}`));
    actions.append(makeActionButton('Crop', 'crop', `Crop page ${index + 1}`));
    actions.append(makeActionButton('×', 'delete', `Delete page ${index + 1}`, true));
    card.append(preview, meta, actions);
    pageGrid.append(card);
  });
}

function makeMoveButton(label, delta, disabled, accessibleLabel) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.move = String(delta);
  button.dataset.boundary = String(disabled);
  button.disabled = disabled;
  button.setAttribute('aria-label', accessibleLabel);
  button.title = accessibleLabel;
  button.textContent = label;
  return button;
}

function makeActionButton(label, action, accessibleLabel, danger = false) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.action = action;
  button.setAttribute('aria-label', accessibleLabel);
  button.title = accessibleLabel;
  button.textContent = label;
  if (danger) button.classList.add('danger-action');
  return button;
}

async function rotatePage(pageId, delta) {
  const page = pages.find((item) => item.id === pageId);
  if (!page) return;
  page.rotation = normalizeRotation((page.rotation || 0) + delta);
  await refreshPageThumbnail(page);
  renderPageCards();
  announce(`Page rotated ${delta < 0 ? 'left' : 'right'}.`);
}

function duplicatePage(pageId) {
  const index = pages.findIndex((item) => item.id === pageId);
  if (index < 0) return;
  const original = pages[index];
  const duplicate = { ...original, id: `${original.id}-copy-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` };
  pages.splice(index + 1, 0, duplicate);
  updateView();
  announce(`Page duplicated at position ${index + 2}.`);
}

function deletePage(pageId) {
  const index = pages.findIndex((item) => item.id === pageId);
  if (index < 0) return;
  pages.splice(index, 1);
  updateView();
  announce('Page removed from the output. Your original PDF is unchanged.');
}

function insertBlankPage(position) {
  const page = {
    id: `blank-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    documentIndex: null,
    pageIndex: null,
    pageLabel: 'Blank',
    fileName: 'Blank page',
    canvas: makeBlankThumbnail(),
    width: 612,
    height: 792,
    rotation: 0,
    crop: null,
    blank: true,
    edits: [],
  };
  pages.splice(Math.max(0, Math.min(position, pages.length)), 0, page);
  updateView();
  announce('Blank page inserted.');
}

function makeBlankThumbnail(rotation = 0, crop = null) {
  const turned = normalizeRotation(rotation) % 180 !== 0;
  const baseWidth = turned ? 170 : 126;
  const baseHeight = turned ? 126 : 170;
  const cropLeft = crop?.left || 0;
  const cropRight = crop?.right || 0;
  const cropTop = crop?.top || 0;
  const cropBottom = crop?.bottom || 0;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(16, Math.round(baseWidth * (100 - cropLeft - cropRight) / 100));
  canvas.height = Math.max(16, Math.round(baseHeight * (100 - cropTop - cropBottom) / 100));
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = '#e2e7e2';
  context.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
  context.fillStyle = '#a2aaa2';
  context.font = '10px Segoe UI, Arial, sans-serif';
  context.textAlign = 'center';
  context.fillText('Blank page', canvas.width / 2, canvas.height / 2);
  return canvas.toDataURL('image/jpeg', 0.72);
}

async function refreshPageThumbnail(page) {
  let base;
  if (page.blank) base = makeBlankThumbnail(page.rotation, page.crop);
  else {
    const preview = documents[page.documentIndex]?.previewDocument;
    if (!preview) return;
    base = await renderThumbnail(preview, page.pageIndex + 1, page.rotation, page.crop);
  }
  page.canvas = page.edits?.length ? await renderPreviewWithEdits(base, page.edits) : base;
}

async function renderPreviewWithEdits(baseData, edits) {
  const image = await loadImage(baseData);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0);
  for (const edit of edits) await paintEditOnCanvas(context, canvas.width, canvas.height, edit);
  return canvas.toDataURL('image/jpeg', 0.82);
}

async function paintEditOnCanvas(context, canvasWidth, canvasHeight, edit) {
  const x = canvasWidth * edit.x / 100;
  const y = canvasHeight * edit.y / 100;
  const width = Math.max(1, canvasWidth * edit.width / 100);
  const height = Math.max(1, canvasHeight * edit.height / 100);
  const color = edit.color || '#222222';
  if (edit.type === 'text' || edit.type === 'signature') {
    context.fillStyle = color;
    context.font = `${edit.type === 'signature' ? 'italic ' : ''}${Math.max(8, Number(edit.size) * canvasWidth / 612)}px Georgia, serif`;
    context.fillText(edit.text || '', x, y + Math.min(height, 24));
  } else if (edit.type === 'image' && edit.dataUrl) {
    const image = await loadImage(edit.dataUrl);
    context.drawImage(image, x, y, width, height);
  } else if (edit.type === 'highlight') {
    context.globalAlpha = 0.28;
    context.fillStyle = color;
    context.fillRect(x, y, width, height);
    context.globalAlpha = 1;
  } else if (edit.type === 'draw') {
    context.strokeStyle = color;
    context.lineWidth = Math.max(1, Number(edit.size) * canvasWidth / 612 / 4);
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + width, y + height);
    context.stroke();
  } else if (edit.type === 'shape') {
    context.strokeStyle = color;
    context.lineWidth = 2;
    if (edit.shape === 'ellipse') {
      context.beginPath();
      context.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
      context.stroke();
    } else context.strokeRect(x, y, width, height);
  } else if (edit.type === 'whiteout' || edit.type === 'redact') {
    context.fillStyle = edit.type === 'redact' ? '#000000' : '#ffffff';
    context.fillRect(x, y, width, height);
  }
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

function openCropDialog(pageId) {
  const page = pages.find((item) => item.id === pageId);
  if (!page) return;
  croppingPageId = pageId;
  for (const edge of ['Top', 'Right', 'Bottom', 'Left']) {
    document.querySelector(`#crop${edge}`).value = String(page.crop?.[edge.toLowerCase()] || 0);
  }
  cropError.textContent = '';
  cropDialog.showModal();
}

function normalizeRotation(degrees) {
  return ((degrees % 360) + 360) % 360;
}

async function saveMergedPdf(filename) {
  setBusy(true, 'Building your merged PDF…');
  try {
    const { document: merged, bytes } = await buildOutputPdf();
    const blob = new Blob([bytes], { type: 'application/pdf' });
    downloadBlob(blob, filename);
    announce(`${filename} downloaded (${formatBytes(blob.size)}). Your original PDFs were not changed.`);
  } catch (error) {
    console.error(error);
    announce('The merged PDF could not be created. Please try smaller or unprotected PDFs.', true);
  } finally {
    setBusy(false);
  }
}

function parsePageRanges(text, pageCount) {
  const entries = text.split(',').map((part) => part.trim()).filter(Boolean);
  if (!entries.length) return { error: 'Enter one or more page ranges, such as 1-3, 4-6.' };
  const parsed = [];
  for (const entry of entries) {
    const match = entry.match(/^(\d+)\s*(?:-\s*(\d+))?$/);
    if (!match) return { error: `“${entry}” is not a page range. Use numbers like 2-5.` };
    const start = Number(match[1]);
    const end = Number(match[2] || match[1]);
    if (start < 1 || end < start) return { error: `Check the page range “${entry}”; its first page must be less than or equal to its last page.` };
    if (end > pageCount) return { error: `Page ${end} is outside the current document order of ${pageCount} pages.` };
    parsed.push({ start, end });
  }
  const usedPages = new Set();
  for (const range of parsed) {
    for (let page = range.start; page <= range.end; page += 1) {
      if (usedPages.has(page)) return { error: `Page ${page} appears in more than one range.` };
      usedPages.add(page);
    }
  }
  return { value: parsed };
}

async function splitIntoRanges(ranges, filename) {
  setBusy(true, 'Creating PDFs from the selected ranges…');
  try {
    const archive = new window.JSZip();
    const baseName = filename.replace(/\.zip$/i, '');
    const sources = await prepareOutputSources();
    for (const range of ranges) {
      const pageSubset = pages.slice(range.start - 1, range.end);
      const { bytes } = await buildOutputPdf(pageSubset, sources);
      const pagePart = range.start === range.end ? String(range.start) : `${range.start}-${range.end}`;
      archive.file(`${baseName}-pages-${pagePart}.pdf`, bytes);
    }
    const blob = await archive.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 5 } });
    downloadBlob(blob, filename);
    announce(`${ranges.length} PDF${ranges.length === 1 ? '' : 's'} created in ${filename} (${formatBytes(blob.size)}).`);
  } catch (error) {
    console.error(error);
    announce('The page ranges could not be split. Try again with unprotected PDFs.', true);
  } finally {
    setBusy(false);
  }
}

async function extractSelectedPages(ranges, filename) {
  setBusy(true, 'Extracting your selected pages…');
  try {
    const selectedPages = [];
    for (const range of ranges) {
      selectedPages.push(...pages.slice(range.start - 1, range.end));
    }
    const { document: output, bytes } = await buildOutputPdf(selectedPages);
    const blob = new Blob([bytes], { type: 'application/pdf' });
    downloadBlob(blob, filename);
    announce(`${output.getPageCount()} page${output.getPageCount() === 1 ? '' : 's'} extracted to ${filename} (${formatBytes(blob.size)}).`);
  } catch (error) {
    console.error(error);
    announce('The selected pages could not be extracted. Try again with unprotected PDFs.', true);
  } finally {
    setBusy(false);
  }
}

async function prepareOutputSources() {
  const prepared = [];
  for (const entry of documents) {
    let bytes;
    try {
      if (entry.form) entry.form.updateFieldAppearances();
      bytes = await entry.source.save({ useObjectStreams: true });
    } catch {
      bytes = entry.bytes;
    }
    const copy = await PDFDocument.load(bytes);
    try {
      const form = copy.getForm();
      if (form.getFields().length) form.flatten();
    } catch {}
    prepared.push(copy);
  }
  return prepared;
}

async function buildOutputPdf(selectedPages = pages, sourceDocuments = null) {
  const sources = sourceDocuments || await prepareOutputSources();
  const output = await PDFDocument.create();
  if (metadata.remove) {
    output.setTitle('');
    output.setAuthor('');
    output.setSubject('');
    output.setKeywords([]);
    output.setCreator('');
    output.setProducer('');
  } else {
    if (metadata.title) output.setTitle(metadata.title);
    if (metadata.author) output.setAuthor(metadata.author);
    if (metadata.subject) output.setSubject(metadata.subject);
  }
  for (const page of selectedPages) await appendPageToDocument(output, page, sources);
  await applyStamps(output);
  const bytes = await output.save({ useObjectStreams: true });
  return { document: output, bytes };
}

async function appendPageToDocument(output, page, sourceDocuments) {
  let copy;
  let originalAngle = page.rotation || 0;
  let source;
  if (!page.blank) {
    source = sourceDocuments[page.documentIndex] || documents[page.documentIndex].source;
    const sourcePage = source.getPage(page.pageIndex);
    originalAngle = normalizeRotation(sourcePage.getRotation().angle + (page.rotation || 0));
  }
  if (page.edits?.some((edit) => edit.type === 'redact')) {
    await appendRedactedRaster(output, page, source, originalAngle);
    return;
  }
  if (page.blank) copy = output.addPage([page.width, page.height]);
  else {
    [copy] = await output.copyPages(source, [page.pageIndex]);
    output.addPage(copy);
  }
  if (page.crop) applyCropToPdfPage(copy, page.crop, originalAngle);
  if (page.edits?.length) await applyEditsToPdfPage(output, copy, page, originalAngle);
  copy.setRotation(window.PDFLib.degrees(normalizeRotation(originalAngle)));
}

async function applyEditsToPdfPage(output, pdfPage, page, rotation) {
  const { rgb, degrees, StandardFonts } = window.PDFLib;
  const font = await output.embedFont(StandardFonts.Helvetica);
  const box = pdfPage.getCropBox();
  for (const edit of page.edits || []) {
    const rect = mapEditRectToPdf(edit, box, rotation);
    const color = pdfColor(edit.color || '#222222');
    if (edit.type === 'text' || edit.type === 'signature') {
      const point = mapEditPointToPdf(edit.x / 100, edit.y / 100, box, rotation);
      pdfPage.drawText(edit.text || '', { x: point.x, y: point.y - Number(edit.size || 18), size: Number(edit.size || 18), font, color, rotate: degrees(normalizeRotation(-rotation)) });
    } else if (edit.type === 'image' && edit.dataUrl) {
      const data = dataUrlBytes(edit.dataUrl);
      const image = edit.imageType === 'image/png' ? await output.embedPng(data) : await output.embedJpg(data);
      pdfPage.drawImage(image, { x: rect.x, y: rect.y, width: rect.width, height: rect.height });
    } else if (edit.type === 'highlight') {
      pdfPage.drawRectangle({ ...rect, color, opacity: 0.3, borderWidth: 0 });
    } else if (edit.type === 'draw') {
      const start = mapEditPointToPdf(edit.x / 100, edit.y / 100, box, rotation);
      const end = mapEditPointToPdf((edit.x + edit.width) / 100, (edit.y + edit.height) / 100, box, rotation);
      pdfPage.drawLine({ start, end, color, thickness: Math.max(1, Number(edit.size || 18) / 4) });
    } else if (edit.type === 'shape' && edit.shape === 'ellipse') {
      pdfPage.drawEllipse({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, xScale: rect.width / 2, yScale: rect.height / 2, borderColor: color, borderWidth: 2 });
    } else if (edit.type === 'shape') {
      pdfPage.drawRectangle({ ...rect, borderColor: color, borderWidth: 2, color: rgb(1, 1, 1), opacity: 0, borderOpacity: 1 });
    } else if (edit.type === 'whiteout') {
      pdfPage.drawRectangle({ ...rect, color: rgb(1, 1, 1), opacity: 1, borderWidth: 0 });
    }
  }
}

function mapEditPointToPdf(x, y, box, rotation) {
  const angle = normalizeRotation(rotation);
  if (angle === 90) return { x: box.x + (1 - y) * box.width, y: box.y + x * box.height };
  if (angle === 180) return { x: box.x + (1 - x) * box.width, y: box.y + y * box.height };
  if (angle === 270) return { x: box.x + y * box.width, y: box.y + (1 - x) * box.height };
  return { x: box.x + x * box.width, y: box.y + (1 - y) * box.height };
}

function mapEditRectToPdf(edit, box, rotation) {
  const first = mapEditPointToPdf(edit.x / 100, edit.y / 100, box, rotation);
  const second = mapEditPointToPdf((edit.x + edit.width) / 100, (edit.y + edit.height) / 100, box, rotation);
  return { x: Math.min(first.x, second.x), y: Math.min(first.y, second.y), width: Math.abs(second.x - first.x), height: Math.abs(second.y - first.y) };
}

function pdfColor(hex) {
  const clean = String(hex || '#222222').replace('#', '');
  const normalized = clean.length === 3 ? clean.split('').map((char) => char + char).join('') : clean.padEnd(6, '0').slice(0, 6);
  return window.PDFLib.rgb(parseInt(normalized.slice(0, 2), 16) / 255, parseInt(normalized.slice(2, 4), 16) / 255, parseInt(normalized.slice(4, 6), 16) / 255);
}

function dataUrlBytes(dataUrl) {
  const base64 = dataUrl.split(',')[1] || '';
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

async function appendRedactedRaster(output, page, source, rotation) {
  const scale = 2;
  let canvas;
  if (page.blank) {
    const turned = normalizeRotation(rotation) % 180 !== 0;
    canvas = document.createElement('canvas');
    canvas.width = (turned ? page.height : page.width) * scale;
    canvas.height = (turned ? page.width : page.height) * scale;
    canvas.getContext('2d').fillStyle = '#ffffff';
    canvas.getContext('2d').fillRect(0, 0, canvas.width, canvas.height);
  } else {
    const preview = documents[page.documentIndex].previewDocument;
    const pdfPage = await preview.getPage(page.pageIndex + 1);
    const viewport = pdfPage.getViewport({ scale, rotation: normalizeRotation(pdfPage.rotate + (page.rotation || 0)) });
    canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await pdfPage.render({ canvasContext: canvas.getContext('2d', { alpha: false }), viewport, background: '#ffffff' }).promise;
  }
  if (page.crop) canvas = cropCanvas(canvas, page.crop);
  const context = canvas.getContext('2d');
  for (const edit of page.edits || []) await paintEditOnCanvas(context, canvas.width, canvas.height, edit);
  const png = dataUrlBytes(canvas.toDataURL('image/png'));
  const image = await output.embedPng(png);
  const rasterPage = output.addPage([canvas.width / scale, canvas.height / scale]);
  rasterPage.drawImage(image, { x: 0, y: 0, width: canvas.width / scale, height: canvas.height / scale });
}

function cropCanvas(source, crop) {
  const x = Math.floor(source.width * crop.left / 100);
  const y = Math.floor(source.height * crop.top / 100);
  const width = Math.max(1, Math.ceil(source.width * (100 - crop.left - crop.right) / 100));
  const height = Math.max(1, Math.ceil(source.height * (100 - crop.top - crop.bottom) / 100));
  const cropped = document.createElement('canvas');
  cropped.width = width;
  cropped.height = height;
  cropped.getContext('2d').drawImage(source, x, y, width, height, 0, 0, width, height);
  return cropped;
}

async function applyStamps(output) {
  if (!stamps.watermark && !stamps.header && !stamps.footer && !stamps.pageNumbers && !stamps.date) return;
  const font = await output.embedFont(window.PDFLib.StandardFonts.Helvetica);
  const today = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date());
  output.getPages().forEach((page, index) => {
    const box = page.getCropBox();
    const centerX = box.x + box.width / 2;
    if (stamps.watermark) {
      const size = Math.min(44, Math.max(24, box.width / 14));
      const textWidth = font.widthOfTextAtSize(stamps.watermark, size);
      page.drawText(stamps.watermark, { x: centerX - textWidth / 2, y: box.y + box.height / 2, size, font, color: window.PDFLib.rgb(0.55, 0.58, 0.55), opacity: 0.24, rotate: window.PDFLib.degrees(330) });
    }
    if (stamps.header) page.drawText(stamps.header, { x: box.x + 24, y: box.y + box.height - 20, size: 9, font, color: window.PDFLib.rgb(0.2, 0.24, 0.21) });
    if (stamps.footer) page.drawText(stamps.footer, { x: box.x + 24, y: box.y + 16, size: 9, font, color: window.PDFLib.rgb(0.2, 0.24, 0.21) });
    if (stamps.pageNumbers) {
      const label = String(index + 1);
      const width = font.widthOfTextAtSize(label, 9);
      page.drawText(label, { x: box.x + box.width - width - 24, y: box.y + 16, size: 9, font, color: window.PDFLib.rgb(0.2, 0.24, 0.21) });
    }
    if (stamps.date) page.drawText(today, { x: box.x + box.width - font.widthOfTextAtSize(today, 9) - 24, y: box.y + box.height - 20, size: 9, font, color: window.PDFLib.rgb(0.2, 0.24, 0.21) });
  });
}

function applyCropToPdfPage(page, crop, rotation) {
  const box = page.getCropBox();
  let left = crop.left / 100 * box.width;
  let right = crop.right / 100 * box.width;
  let top = crop.top / 100 * box.height;
  let bottom = crop.bottom / 100 * box.height;
  if (rotation === 90) {
    [left, right, top, bottom] = [crop.top / 100 * box.width, crop.bottom / 100 * box.width, crop.right / 100 * box.height, crop.left / 100 * box.height];
  } else if (rotation === 180) {
    [left, right, top, bottom] = [crop.right / 100 * box.width, crop.left / 100 * box.width, crop.bottom / 100 * box.height, crop.top / 100 * box.height];
  } else if (rotation === 270) {
    [left, right, top, bottom] = [crop.bottom / 100 * box.width, crop.top / 100 * box.width, crop.left / 100 * box.height, crop.right / 100 * box.height];
  }
  page.setCropBox(box.x + left, box.y + bottom, Math.max(1, box.width - left - right), Math.max(1, box.height - top - bottom));
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function setBusy(value, message = '') {
  busy = value;
  saveButton.disabled = value;
  splitButton.disabled = value;
  extractButton.disabled = value;
  document.querySelectorAll('.workspace button, .workspace input').forEach((control) => { control.disabled = value; });
  saveButton.innerHTML = value ? '<span class="spinner" aria-hidden="true"></span> Working…' : '<span aria-hidden="true">↓</span> Save PDF';
  document.querySelectorAll('.page-actions button').forEach((button) => { button.disabled = value || button.dataset.boundary === 'true'; });
  if (message) announce(message);
}

function announce(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle('error', isError);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function safeBaseName(value, fallback) {
  const cleaned = String(value || '').trim().replace(/[\\/:*?"<>|]/g, '-').replace(/\.(pdf|zip|txt)$/i, '');
  return cleaned || fallback;
}

async function imagesToPdf() {
  const images = [...(imageInput?.files || [])];
  if (!images.length) return announce('Choose one or more PNG or JPEG images first.', true);
  setBusy(true, 'Creating a PDF from your images…');
  try {
    const output = await PDFDocument.create();
    for (const file of images) {
      const data = new Uint8Array(await file.arrayBuffer());
      const image = /\.png$/i.test(file.name) || file.type === 'image/png'
        ? await output.embedPng(data)
        : await output.embedJpg(data);
      const page = output.addPage([image.width, image.height]);
      page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
    }
    const bytes = await output.save({ useObjectStreams: true });
    const name = safeBaseName(outputName.value, 'images-to-pdf');
    downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `${name}.pdf`);
    announce(`${images.length} image${images.length === 1 ? '' : 's'} saved as ${name}.pdf.`);
  } catch (error) {
    console.error(error);
    announce('The images could not be added. Choose valid PNG or JPEG files.', true);
  } finally { setBusy(false); }
}

async function pdfToImages() {
  if (!pages.length) return announce('Add a PDF before exporting page images.', true);
  setBusy(true, 'Rendering the current PDF pages…');
  try {
    const { bytes } = await buildOutputPdf();
    const pdf = await getDocument({ data: bytes.slice() }).promise;
    const archive = new window.JSZip();
    for (let number = 1; number <= pdf.numPages; number += 1) {
      const page = await pdf.getPage(number);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvasContext: canvas.getContext('2d', { alpha: false }), viewport, background: '#ffffff' }).promise;
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      archive.file(`page-${String(number).padStart(3, '0')}.png`, blob);
      if (number % 4 === 0) await nextFrame();
    }
    const blob = await archive.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 4 } });
    downloadBlob(blob, `${safeBaseName(outputName.value, 'pdf-pages')}-images.zip`);
    announce(`${pdf.numPages} page images saved in a ZIP file (${formatBytes(blob.size)}).`);
  } catch (error) {
    console.error(error);
    announce('The PDF pages could not be exported as images.', true);
  } finally { setBusy(false); }
}

async function pdfToText() {
  if (!pages.length) return announce('Add a PDF before exporting its text.', true);
  setBusy(true, 'Extracting text from the current PDF pages…');
  try {
    const { bytes } = await buildOutputPdf();
    const pdf = await getDocument({ data: bytes.slice() }).promise;
    const textPages = [];
    for (let number = 1; number <= pdf.numPages; number += 1) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      textPages.push(content.items.map((item) => item.str).join(' '));
    }
    const blob = new Blob([textPages.map((text, index) => `--- Page ${index + 1} ---\n${text}`).join('\n\n')], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, `${safeBaseName(outputName.value, 'pdf-text')}.txt`);
    announce(`Text from ${pdf.numPages} pages saved. Scanned pages without selectable text need OCR.`);
  } catch (error) {
    console.error(error);
    announce('Text could not be extracted from this PDF.', true);
  } finally { setBusy(false); }
}

async function compressAndSavePdf() {
  if (!pages.length) return announce('Add a PDF before compressing it.', true);
  setBusy(true, 'Compressing the current PDF locally…');
  try {
    const originalBytes = documents.reduce((sum, entry) => sum + entry.bytes.byteLength, 0);
    const { document: current, bytes: currentBytes } = await buildOutputPdf();
    const compressed = await PDFDocument.create();
    const source = await getDocument({ data: currentBytes.slice() }).promise;
    for (let index = 0; index < current.getPageCount(); index += 1) {
      const page = current.getPage(index);
      const box = page.getSize();
      const renderedPage = await source.getPage(index + 1);
      const viewport = renderedPage.getViewport({ scale: 1.15, rotation: normalizeRotation(page.getRotation().angle) });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await renderedPage.render({ canvasContext: canvas.getContext('2d', { alpha: false }), viewport, background: '#ffffff' }).promise;
      const jpeg = dataUrlBytes(canvas.toDataURL('image/jpeg', 0.72));
      const image = await compressed.embedJpg(jpeg);
      const outputPage = compressed.addPage([viewport.width / 1.15, viewport.height / 1.15]);
      outputPage.drawImage(image, { x: 0, y: 0, width: outputPage.getWidth(), height: outputPage.getHeight() });
      if (index % 4 === 0) await nextFrame();
    }
    if (metadata.remove) {
      compressed.setTitle(''); compressed.setAuthor(''); compressed.setSubject('');
      compressed.setKeywords([]); compressed.setCreator(''); compressed.setProducer('');
    } else {
      if (metadata.title) compressed.setTitle(metadata.title);
      if (metadata.author) compressed.setAuthor(metadata.author);
      if (metadata.subject) compressed.setSubject(metadata.subject);
    }
    const rasterBytes = await compressed.save({ useObjectStreams: true });
    const outputBytes = rasterBytes.byteLength < currentBytes.byteLength ? rasterBytes : currentBytes;
    const before = currentBytes.byteLength || originalBytes;
    const after = outputBytes.byteLength;
    const filename = `${safeBaseName(outputName.value, 'compressed')}-compressed.pdf`;
    downloadBlob(new Blob([outputBytes], { type: 'application/pdf' }), filename);
    const results = document.querySelector('#compressionResults');
    results.classList.remove('hidden');
    results.textContent = `File size before: ${formatBytes(before)} · after: ${formatBytes(after)}${after < before ? ` · reduced by ${formatBytes(before - after)}` : ' · no size reduction was possible without increasing compression'}.`;
    announce(`${filename} saved. File size before: ${formatBytes(before)}; after: ${formatBytes(after)}.`);
  } catch (error) {
    console.error(error);
    announce('This PDF could not be compressed. Try a smaller or unprotected PDF.', true);
  } finally { setBusy(false); }
}

async function getExtractedText(bytes) {
  const pdf = await getDocument({ data: bytes.slice() }).promise;
  const result = [];
  for (let number = 1; number <= pdf.numPages; number += 1) {
    const page = await pdf.getPage(number);
    const content = await page.getTextContent();
    result.push(content.items.map((item) => item.str).join(' ').replace(/\s+/g, ' ').trim());
  }
  return { pageCount: pdf.numPages, pages: result };
}

async function comparePdfs() {
  if (!pages.length) return announce('Add a PDF before comparing files.', true);
  if (!compareBytes) return announce('Choose a second PDF to compare.', true);
  setBusy(true, 'Comparing page count and selectable text locally…');
  try {
    const { bytes } = await buildOutputPdf();
    const [left, right] = await Promise.all([getExtractedText(bytes), getExtractedText(compareBytes)]);
    const sameCount = left.pageCount === right.pageCount;
    const maxPages = Math.max(left.pageCount, right.pageCount);
    const differences = [];
    for (let index = 0; index < maxPages; index += 1) {
      const a = left.pages[index] || '';
      const b = right.pages[index] || '';
      if (a !== b) differences.push(index + 1);
    }
    const results = document.querySelector('#compareResults');
    results.classList.remove('hidden');
    results.textContent = `Current PDF: ${left.pageCount} pages. Second PDF: ${right.pageCount} pages. ${sameCount ? 'Page counts match.' : 'Page counts differ.'} ${differences.length ? `Selectable text differs on page${differences.length === 1 ? '' : 's'} ${differences.join(', ')}.` : 'Selectable text matches on all pages.'} Visual-only differences and scanned images are not detected by text comparison.`;
    announce('PDF comparison complete.');
  } catch (error) {
    console.error(error);
    announce('The PDFs could not be compared. Choose readable, unprotected files.', true);
  } finally { setBusy(false); }
}

setMode('Organise');
