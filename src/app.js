// ========================================================
// Corel Tools Suite - Frontend Application Logic
// Clean, Modular, Anti-Slop, 100% Functional
// ========================================================

document.addEventListener('DOMContentLoaded', () => {
  // State
  let activeView = 'beranda';
  let conversionFiles = [];
  let excelMergerData = null;
  let isAlwaysOnTop = false;

  // Cache DOM Elements
  const navItems = document.querySelectorAll('.nav-item');
  const viewPages = document.querySelectorAll('.view-page');
  const searchInput = document.getElementById('searchToolsInput');
  const toolsCards = document.querySelectorAll('.tool-card');

  // Titlebar controls
  const btnPin = document.getElementById('btnPin');
  const btnMinimize = document.getElementById('btnMinimize');
  const btnMaximize = document.getElementById('btnMaximize');
  const btnClose = document.getElementById('btnClose');

  // Status elements
  const corelDotStatus = document.getElementById('corelDotStatus');
  const lblCorelConnected = document.getElementById('lblCorelConnected');
  const lblActiveDocName = document.getElementById('lblActiveDocName');
  const footerCorelDot = document.getElementById('footerCorelDot');
  const footerCorelStatus = document.getElementById('footerCorelStatus');
  const footerDocInfo = document.getElementById('footerDocInfo');
  const footerActionStatus = document.getElementById('footerActionStatus');
  const recentFilesContainer = document.getElementById('recentFilesContainer');
  const btnRefreshFiles = document.getElementById('btnRefreshFiles');

  // Toast
  const toastNotice = document.getElementById('toastNotice');
  const toastMessage = document.getElementById('toastMessage');
  let toastTimer = null;

  function showToast(msg, isSuccess = true) {
    if (!toastNotice) return;
    toastMessage.innerText = msg;
    toastNotice.style.borderColor = isSuccess ? '#10b981' : '#ef4444';
    toastNotice.style.display = 'flex';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastNotice.style.display = 'none';
    }, 4000);
  }

  // ==========================================
  // 1. Navigation & Page Router
  // ==========================================
  function switchView(viewName) {
    if (!viewName) return;
    activeView = viewName;

    // Update nav active
    navItems.forEach(item => {
      if (item.getAttribute('data-view') === viewName) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Update page active
    viewPages.forEach(page => {
      if (page.id === `view-${viewName}`) {
        page.classList.add('active');
      } else {
        page.classList.remove('active');
      }
    });

    footerActionStatus.innerText = `Mode: ${viewName.toUpperCase()}`;
  }

  // Sidebar clicks
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const view = item.getAttribute('data-view');
      switchView(view);
    });
  });

  // Card clicks on Beranda
  toolsCards.forEach(card => {
    card.addEventListener('click', () => {
      const view = card.getAttribute('data-open');
      switchView(view);
    });
  });

  // Quick Action Buttons
  document.querySelectorAll('.btn-quick-action').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.getAttribute('data-open');
      switchView(view);
    });
  });

  // Back to Beranda Buttons
  document.querySelectorAll('.btn-back').forEach(btn => {
    btn.addEventListener('click', () => {
      switchView('beranda');
    });
  });

  // Search Filter on Beranda
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      toolsCards.forEach(card => {
        const text = (card.getAttribute('data-keywords') || '') + ' ' + card.innerText.toLowerCase();
        if (!q || text.includes(q)) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
    });
  }

  // ==========================================
  // 2. Window Controls
  // ==========================================
  if (btnMinimize) {
    btnMinimize.addEventListener('click', () => {
      if (window.corelAPI?.minimizeWindow) window.corelAPI.minimizeWindow();
    });
  }

  if (btnMaximize) {
    btnMaximize.addEventListener('click', async () => {
      if (window.corelAPI?.isMaximized) {
        const max = await window.corelAPI.isMaximized();
        if (max) window.corelAPI.unmaximizeWindow();
        else window.corelAPI.maximizeWindow();
      }
    });
  }

  if (btnClose) {
    btnClose.addEventListener('click', () => {
      if (window.corelAPI?.closeWindow) window.corelAPI.closeWindow();
    });
  }

  if (btnPin) {
    btnPin.addEventListener('click', async () => {
      if (window.corelAPI?.toggleAlwaysOnTop) {
        const res = await window.corelAPI.toggleAlwaysOnTop();
        isAlwaysOnTop = res.isAlwaysOnTop;
        btnPin.style.color = isAlwaysOnTop ? '#38bdf8' : '#94a3b8';
        showToast(isAlwaysOnTop ? 'Jendela selalu di atas diaktifkan' : 'Jendela selalu di atas dimatikan');
      }
    });
  }

  // ==========================================
  // 3. CorelDRAW Connection & File Status
  // ==========================================
  async function updateCorelStatus() {
    try {
      if (window.corelAPI?.checkStatus) {
        const res = await window.corelAPI.checkStatus();
        if (res.connected) {
          if (corelDotStatus) corelDotStatus.className = 'status-dot-indicator online';
          if (footerCorelDot) footerCorelDot.className = 'status-dot-indicator online';
          const verText = res.version || 'CorelDRAW Terhubung';
          if (lblCorelConnected) lblCorelConnected.innerText = verText;
          if (footerCorelStatus) footerCorelStatus.innerText = `Corel: ${verText}`;

          const docName = res.activeDoc ? res.activeDoc : 'Tidak ada dokumen terbuka';
          const docInfo = res.activeDoc ? `Dokumen: ${res.activeDoc} (${res.pageCount || 1} Hal, ${res.selectionCount || 0} Seleksi)` : 'Dokumen: -';
          if (lblActiveDocName) lblActiveDocName.innerText = `Dokumen: ${docName}`;
          if (footerDocInfo) footerDocInfo.innerText = docInfo;
        } else {
          if (corelDotStatus) corelDotStatus.className = 'status-dot-indicator';
          if (footerCorelDot) footerCorelDot.className = 'status-dot-indicator';
          if (lblCorelConnected) lblCorelConnected.innerText = 'CorelDRAW belum dibuka';
          if (footerCorelStatus) footerCorelStatus.innerText = 'CorelDRAW: Belum Terbuka';
          if (lblActiveDocName) lblActiveDocName.innerText = 'Buka CorelDRAW untuk menggunakan tools';
          if (footerDocInfo) footerDocInfo.innerText = 'Dokumen: -';
        }
      }
    } catch {}
  }

  async function loadRecentFiles() {
    try {
      if (window.corelAPI?.getRecentFiles) {
        const res = await window.corelAPI.getRecentFiles();
        if (res.success && res.files && recentFilesContainer) {
          recentFilesContainer.innerHTML = '';
          res.files.forEach(f => {
            const item = document.createElement('div');
            item.className = 'recent-file-item';
            item.innerHTML = `
              <span class="recent-icon-badge" style="${f.isOpen ? 'background: #0284c7; color: #fff;' : ''}">CDR</span>
              <div class="recent-file-meta">
                <span class="recent-file-name">${f.name}</span>
                <span class="recent-file-path">${f.path || 'Buka di Corel'}</span>
              </div>
            `;
            item.addEventListener('click', () => {
              if (f.path && f.path.endsWith('.cdr') && window.corelAPI?.openDocument) {
                window.corelAPI.openDocument(f.path);
                showToast(`Membuka ${f.name} di CorelDRAW...`);
              }
            });
            recentFilesContainer.appendChild(item);
          });
        }
      }
    } catch {}
  }

  if (btnRefreshFiles) {
    btnRefreshFiles.addEventListener('click', () => {
      loadRecentFiles();
      updateCorelStatus();
      showToast('Memperbarui status CorelDRAW...');
    });
  }

  // Initial & Periodic Poll
  updateCorelStatus();
  loadRecentFiles();
  setInterval(updateCorelStatus, 5000);

  // ==========================================
  // 4. Tool: Enumerator / Penomoran Logic
  // ==========================================
  const enumFormat = document.getElementById('enumFormat');
  const enumStart = document.getElementById('enumStart');
  const enumEnd = document.getElementById('enumEnd');
  const enumStep = document.getElementById('enumStep');
  const enumPrefix = document.getElementById('enumPrefix');
  const enumSuffix = document.getElementById('enumSuffix');
  const enumMode = document.getElementById('enumMode');
  const enumGridSettings = document.getElementById('enumGridSettings');
  const enumGridCols = document.getElementById('enumGridCols');
  const enumGridRows = document.getElementById('enumGridRows');
  const enumSpacingX = document.getElementById('enumSpacingX');
  const enumSpacingY = document.getElementById('enumSpacingY');
  const enumGridOrder = document.getElementById('enumGridOrder');
  const enumAutoCurves = document.getElementById('enumAutoCurves');
  const enumPreviewList = document.getElementById('enumPreviewList');
  const enumTotalCount = document.getElementById('enumTotalCount');
  const btnEnumGenerate = document.getElementById('btnEnumGenerate');
  const btnEnumReset = document.getElementById('btnEnumReset');
  const btnEnumCopyPreview = document.getElementById('btnEnumCopyPreview');

  function updateEnumPreview() {
    const s = parseInt(enumStart?.value, 10) || 1;
    const e = parseInt(enumEnd?.value, 10) || 100;
    const step = parseInt(enumStep?.value, 10) || 1;
    const digits = parseInt(enumFormat?.value, 10) || 0;
    const pfx = enumPrefix?.value || '';
    const sfx = enumSuffix?.value || '';

    const list = [];
    for (let n = s; n <= e; n += step) {
      let numStr = String(n);
      if (digits > 0) numStr = numStr.padStart(digits, '0');
      list.push(`${pfx}${numStr}${sfx}`);
    }

    if (enumTotalCount) enumTotalCount.innerText = list.length;
    if (enumPreviewList) {
      if (list.length === 0) {
        enumPreviewList.innerText = '(Rentang nomor tidak valid)';
      } else {
        const displayLimit = Math.min(list.length, 50);
        let previewHtml = list.slice(0, displayLimit).join('<br>');
        if (list.length > displayLimit) {
          previewHtml += `<br><span style="color: var(--text-dim); font-style: italic;">...dan ${list.length - displayLimit} nomor lainnya</span>`;
        }
        enumPreviewList.innerHTML = previewHtml;
      }
    }
  }

  [enumFormat, enumStart, enumEnd, enumStep, enumPrefix, enumSuffix].forEach(el => {
    if (el) el.addEventListener('input', updateEnumPreview);
  });

  if (enumMode) {
    enumMode.addEventListener('change', () => {
      if (enumMode.value === 'grid') {
        enumGridSettings.style.display = 'flex';
      } else {
        enumGridSettings.style.display = 'none';
      }
    });
  }

  if (btnEnumReset) {
    btnEnumReset.addEventListener('click', () => {
      if (enumStart) enumStart.value = 1;
      if (enumEnd) enumEnd.value = 100;
      if (enumStep) enumStep.value = 1;
      if (enumPrefix) enumPrefix.value = 'INV-';
      if (enumSuffix) enumSuffix.value = '';
      if (enumFormat) enumFormat.value = '4';
      updateEnumPreview();
      showToast('Form enumerator direset.');
    });
  }

  if (btnEnumCopyPreview) {
    btnEnumCopyPreview.addEventListener('click', () => {
      const s = parseInt(enumStart?.value, 10) || 1;
      const e = parseInt(enumEnd?.value, 10) || 100;
      const step = parseInt(enumStep?.value, 10) || 1;
      const digits = parseInt(enumFormat?.value, 10) || 0;
      const pfx = enumPrefix?.value || '';
      const sfx = enumSuffix?.value || '';
      const list = [];
      for (let n = s; n <= e; n += step) {
        let numStr = String(n);
        if (digits > 0) numStr = numStr.padStart(digits, '0');
        list.push(`${pfx}${numStr}${sfx}`);
      }
      navigator.clipboard.writeText(list.join('\n'));
      showToast(`Berhasil menyalin ${list.length} nomor ke clipboard!`);
    });
  }

  if (btnEnumGenerate) {
    btnEnumGenerate.addEventListener('click', async () => {
      const s = parseInt(enumStart?.value, 10) || 1;
      const e = parseInt(enumEnd?.value, 10) || 100;
      const step = parseInt(enumStep?.value, 10) || 1;
      const digits = parseInt(enumFormat?.value, 10) || 0;
      const pfx = enumPrefix?.value || '';
      const sfx = enumSuffix?.value || '';
      const mode = enumMode?.value || 'page';
      const cols = parseInt(enumGridCols?.value, 10) || 2;
      const rows = parseInt(enumGridRows?.value, 10) || 5;
      const spacingX = parseFloat(enumSpacingX?.value) || 0.5;
      const spacingY = parseFloat(enumSpacingY?.value) || 0.5;
      const gridOrder = enumGridOrder?.value || 'cut_stack';
      const autoCurves = enumAutoCurves ? enumAutoCurves.checked : true;

      btnEnumGenerate.disabled = true;
      btnEnumGenerate.innerText = 'Memproses di CorelDRAW...';
      footerActionStatus.innerText = 'Sedang membuat penomoran di CorelDRAW...';

      try {
        if (window.corelAPI?.executeNumerator) {
          const res = await window.corelAPI.executeNumerator({
            start: s,
            end: e,
            step,
            digits,
            prefix: pfx,
            suffix: sfx,
            mode,
            cols,
            rows,
            spacingX,
            spacingY,
            gridOrder,
            autoCurves
          });

          if (res.success) {
            showToast(`Sukses: ${res.message || 'Nomorator berhasil dibuat!'}`, true);
            updateCorelStatus();
          } else {
            showToast(`Gagal: ${res.message}`, false);
            alert(`Gagal membuat nomorator:\n\n${res.message}`);
          }
        }
      } catch (err) {
        showToast(`Error: ${err.message}`, false);
      } finally {
        btnEnumGenerate.disabled = false;
        btnEnumGenerate.innerText = '⚡ Generate di CorelDRAW';
        footerActionStatus.innerText = 'Siap';
      }
    });
  }

  updateEnumPreview();

  // ==========================================
  // 5. Tool: Konversi File Logic
  // ==========================================
  const btnAddFiles = document.getElementById('btnAddFiles');
  const btnAddFolder = document.getElementById('btnAddFolder');
  const btnClearFiles = document.getElementById('btnClearFiles');
  const tbodyConversionFiles = document.getElementById('tbodyConversionFiles');
  const lblConversionFileCount = document.getElementById('lblConversionFileCount');
  const selConvertOutputFormat = document.getElementById('selConvertOutputFormat');
  const selConvertDPI = document.getElementById('selConvertDPI');
  const txtConvertOutputFolder = document.getElementById('txtConvertOutputFolder');
  const btnBrowseOutputFolder = document.getElementById('btnBrowseOutputFolder');
  const chkOpenFolderAfter = document.getElementById('chkOpenFolderAfter');
  const chkOverwriteFiles = document.getElementById('chkOverwriteFiles');
  const btnStartConversion = document.getElementById('btnStartConversion');

  function renderConversionFiles() {
    if (!tbodyConversionFiles) return;
    if (conversionFiles.length === 0) {
      tbodyConversionFiles.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-dim); padding: 30px;">Belum ada file. Klik "+ Tambah File" atau drag & drop file ke sini.</td></tr>`;
      if (lblConversionFileCount) lblConversionFileCount.innerText = '0 File Terpilih';
      return;
    }

    if (lblConversionFileCount) lblConversionFileCount.innerText = `${conversionFiles.length} File Terpilih`;
    tbodyConversionFiles.innerHTML = '';

    conversionFiles.forEach((f, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="checkbox" checked /></td>
        <td style="font-weight: 600;">${f.name}</td>
        <td><span class="recent-icon-badge">${f.format}</span></td>
        <td>${f.size}</td>
        <td style="color: var(--accent-green); font-weight: 700;">Siap</td>
        <td><button class="btn-danger" style="height: 20px; font-size: 9px; padding: 0 4px;" data-remove="${idx}">✕</button></td>
      `;
      tr.querySelector('[data-remove]').addEventListener('click', () => {
        conversionFiles.splice(idx, 1);
        renderConversionFiles();
      });
      tbodyConversionFiles.appendChild(tr);
    });
  }

  if (btnAddFiles) {
    btnAddFiles.addEventListener('click', async () => {
      if (window.corelAPI?.openFiles) {
        const res = await window.corelAPI.openFiles();
        if (res.success && res.files) {
          conversionFiles = [...conversionFiles, ...res.files];
          renderConversionFiles();
        }
      }
    });
  }

  if (btnBrowseOutputFolder) {
    btnBrowseOutputFolder.addEventListener('click', async () => {
      if (window.corelAPI?.openDirectory) {
        const res = await window.corelAPI.openDirectory();
        if (res.success && res.path) {
          txtConvertOutputFolder.value = res.path;
        }
      }
    });
  }

  if (btnClearFiles) {
    btnClearFiles.addEventListener('click', () => {
      conversionFiles = [];
      renderConversionFiles();
      showToast('Daftar file dikosongkan.');
    });
  }

  if (btnStartConversion) {
    btnStartConversion.addEventListener('click', async () => {
      if (conversionFiles.length === 0) {
        alert('Tambahkan minimal 1 file untuk dikonversi.');
        return;
      }
      if (!txtConvertOutputFolder.value) {
        alert('Pilih folder output tujuan terlebih dahulu.');
        return;
      }

      btnStartConversion.disabled = true;
      btnStartConversion.innerText = 'Mengonversi File...';
      footerActionStatus.innerText = `Mengonversi ${conversionFiles.length} file...`;

      try {
        if (window.corelAPI?.executeConversion) {
          const res = await window.corelAPI.executeConversion({
            files: conversionFiles,
            outputFormat: selConvertOutputFormat.value,
            outputFolder: txtConvertOutputFolder.value,
            dpi: parseInt(selConvertDPI.value, 10) || 300,
            openFolderAfter: chkOpenFolderAfter.checked,
            overwrite: chkOverwriteFiles.checked
          });

          if (res.success) {
            showToast(`Sukses: ${res.message || 'Konversi selesai!'}`, true);
            alert(`🎉 Sukses!\n\n${res.message}`);
          } else {
            showToast(`Gagal: ${res.message}`, false);
            alert(`Gagal konversi:\n\n${res.message}`);
          }
        }
      } catch (err) {
        showToast(`Error: ${err.message}`, false);
      } finally {
        btnStartConversion.disabled = false;
        btnStartConversion.innerText = '🚀 Mulai Konversi';
        footerActionStatus.innerText = 'Siap';
      }
    });
  }

  // ==========================================
  // 6. Tool: Penggantian Warna Logic
  // ==========================================
  const pickerSourceColor = document.getElementById('pickerSourceColor');
  const txtSourceColorHex = document.getElementById('txtSourceColorHex');
  const pickerTargetColor = document.getElementById('pickerTargetColor');
  const txtTargetColorHex = document.getElementById('txtTargetColorHex');
  const swatchSource = document.getElementById('swatchSource');
  const swatchTarget = document.getElementById('swatchTarget');
  const lblSourceHex = document.getElementById('lblSourceHex');
  const lblTargetHex = document.getElementById('lblTargetHex');
  const btnColorReset = document.getElementById('btnColorReset');
  const btnColorApply = document.getElementById('btnColorApply');
  const btnExtractActiveColors = document.getElementById('btnExtractActiveColors');
  const paletteSwatchesList = document.getElementById('paletteSwatchesList');

  function updateColorPreviews() {
    if (pickerSourceColor && swatchSource) swatchSource.style.backgroundColor = pickerSourceColor.value;
    if (txtSourceColorHex && pickerSourceColor) txtSourceColorHex.value = pickerSourceColor.value.toUpperCase();
    if (lblSourceHex && pickerSourceColor) lblSourceHex.innerText = pickerSourceColor.value.toUpperCase();

    if (pickerTargetColor && swatchTarget) swatchTarget.style.backgroundColor = pickerTargetColor.value;
    if (txtTargetColorHex && pickerTargetColor) txtTargetColorHex.value = pickerTargetColor.value.toUpperCase();
    if (lblTargetHex && pickerTargetColor) lblTargetHex.innerText = pickerTargetColor.value.toUpperCase();
  }

  if (pickerSourceColor) pickerSourceColor.addEventListener('input', updateColorPreviews);
  if (pickerTargetColor) pickerTargetColor.addEventListener('input', updateColorPreviews);

  if (txtSourceColorHex) {
    txtSourceColorHex.addEventListener('input', (e) => {
      if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
        pickerSourceColor.value = e.target.value;
        updateColorPreviews();
      }
    });
  }

  if (txtTargetColorHex) {
    txtTargetColorHex.addEventListener('input', (e) => {
      if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
        pickerTargetColor.value = e.target.value;
        updateColorPreviews();
      }
    });
  }

  if (btnExtractActiveColors) {
    btnExtractActiveColors.addEventListener('click', async () => {
      btnExtractActiveColors.disabled = true;
      btnExtractActiveColors.innerText = 'Mengekstrak warna dari CorelDRAW...';
      try {
        if (window.corelAPI?.executeExtractColors) {
          const res = await window.corelAPI.executeExtractColors();
          if (res.success && res.colors && paletteSwatchesList) {
            paletteSwatchesList.innerHTML = '';
            res.colors.forEach(hex => {
              const el = document.createElement('div');
              el.style.width = '28px';
              el.style.height = '28px';
              el.style.borderRadius = '3px';
              el.style.backgroundColor = hex;
              el.style.cursor = 'pointer';
              el.style.border = '1px solid #ffffff';
              el.title = `Pilih warna ${hex}`;
              el.addEventListener('click', () => {
                pickerSourceColor.value = hex;
                updateColorPreviews();
                showToast(`Warna asal diatur ke: ${hex}`);
              });
              paletteSwatchesList.appendChild(el);
            });
            showToast(`Berhasil mengekstrak ${res.colors.length} warna dari CorelDRAW!`);
          }
        }
      } catch (err) {
        showToast(`Gagal ekstrak: ${err.message}`, false);
      } finally {
        btnExtractActiveColors.disabled = false;
        btnExtractActiveColors.innerText = '🔍 Ambil Warna Otomatis dari Desain CorelDRAW';
      }
    });
  }

  if (btnColorReset) {
    btnColorReset.addEventListener('click', () => {
      pickerSourceColor.value = '#FF0000';
      pickerTargetColor.value = '#0000FF';
      updateColorPreviews();
      showToast('Warna direset ke default.');
    });
  }

  if (btnColorApply) {
    btnColorApply.addEventListener('click', async () => {
      btnColorApply.disabled = true;
      btnColorApply.innerText = 'Menerapkan di CorelDRAW...';
      try {
        if (window.corelAPI?.executeColorReplace) {
          const res = await window.corelAPI.executeColorReplace({
            sourceHex: pickerSourceColor.value,
            targetHex: pickerTargetColor.value,
            replaceFill: document.getElementById('chkReplaceFill')?.checked ?? true,
            replaceOutline: document.getElementById('chkReplaceOutline')?.checked ?? true,
            includeGroups: document.getElementById('chkIncludeGroups')?.checked ?? true
          });

          if (res.success) {
            showToast(`Sukses: ${res.message || 'Warna berhasil diganti!'}`, true);
            alert(`🎉 Sukses!\n\n${res.message}`);
          } else {
            showToast(`Gagal: ${res.message}`, false);
            alert(`Gagal mengganti warna:\n\n${res.message}`);
          }
        }
      } catch (err) {
        showToast(`Error: ${err.message}`, false);
      } finally {
        btnColorApply.disabled = false;
        btnColorApply.innerText = 'Terapkan ke CorelDRAW';
      }
    });
  }

  // ==========================================
  // 7. Tool: Merger (Variable Data & Certificate)
  // ==========================================
  const btnTabMergerExcel = document.getElementById('btnTabMergerExcel');
  const btnTabMergerManual = document.getElementById('btnTabMergerManual');
  const mergerExcelSection = document.getElementById('mergerExcelSection');
  const mergerManualSection = document.getElementById('mergerManualSection');
  const btnPickExcelFile = document.getElementById('btnPickExcelFile');
  const lblExcelLoadedName = document.getElementById('lblExcelLoadedName');
  const mergerMappingList = document.getElementById('mergerMappingList');
  const selMergerOutputMode = document.getElementById('selMergerOutputMode');
  const boxMergerGridSettings = document.getElementById('boxMergerGridSettings');
  const tbodyMergerPreview = document.getElementById('tbodyMergerPreview');
  const lblMergerSummaryCount = document.getElementById('lblMergerSummaryCount');
  const btnExecuteMerger = document.getElementById('btnExecuteMerger');

  let mergerActiveSource = 'excel'; // 'excel' or 'manual'

  if (btnTabMergerExcel) {
    btnTabMergerExcel.addEventListener('click', () => {
      mergerActiveSource = 'excel';
      btnTabMergerExcel.classList.add('active');
      btnTabMergerManual.classList.remove('active');
      mergerExcelSection.style.display = 'flex';
      mergerManualSection.style.display = 'none';
      updateMergerPreview();
    });
  }

  if (btnTabMergerManual) {
    btnTabMergerManual.addEventListener('click', () => {
      mergerActiveSource = 'manual';
      btnTabMergerManual.classList.add('active');
      btnTabMergerExcel.classList.remove('active');
      mergerManualSection.style.display = 'flex';
      mergerExcelSection.style.display = 'none';
      updateMergerPreview();
    });
  }

  if (selMergerOutputMode) {
    selMergerOutputMode.addEventListener('change', () => {
      if (selMergerOutputMode.value === 'grid') {
        boxMergerGridSettings.style.display = 'flex';
      } else {
        boxMergerGridSettings.style.display = 'none';
      }
    });
  }

  function updateMergerPreview() {
    let rows = [];
    if (mergerActiveSource === 'excel') {
      rows = excelMergerData?.rows || [];
    } else {
      const a1Lines = (document.getElementById('txtManualA1')?.value || '').split(/\r?\n/).filter(l => l.trim());
      const a2Lines = (document.getElementById('txtManualA2')?.value || '').split(/\r?\n/).filter(l => l.trim());
      const maxL = Math.max(a1Lines.length, a2Lines.length);
      for (let i = 0; i < maxL; i++) {
        rows.push({
          A1: a1Lines[i] || '',
          A2: a2Lines[i] || ''
        });
      }
    }

    if (lblMergerSummaryCount) lblMergerSummaryCount.innerText = `(${rows.length} Data Siap)`;
    if (tbodyMergerPreview) {
      if (rows.length === 0) {
        tbodyMergerPreview.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-dim); padding: 20px;">Belum ada data. Silakan pilih file Excel atau ketik teks manual.</td></tr>`;
      } else {
        tbodyMergerPreview.innerHTML = '';
        const limit = Math.min(rows.length, 30);
        for (let r = 0; r < limit; r++) {
          const tr = document.createElement('tr');
          const keys = Object.keys(rows[r]);
          const col1 = rows[r][keys[0]] || '';
          const col2 = rows[r][keys[1]] || '';
          tr.innerHTML = `<td>${r + 1}</td><td>${col1}</td><td>${col2}</td>`;
          tbodyMergerPreview.appendChild(tr);
        }
      }
    }
  }

  if (btnPickExcelFile) {
    btnPickExcelFile.addEventListener('click', async () => {
      if (window.corelAPI?.selectExcelFile) {
        const res = await window.corelAPI.selectExcelFile();
        if (res.success && res.filePath) {
          const parseRes = await window.corelAPI.parseExcelFile(res.filePath);
          if (parseRes.success) {
            excelMergerData = parseRes;
            lblExcelLoadedName.innerText = `✓ ${parseRes.filePath.split(/[/\\]/).pop()} (${parseRes.totalRows} baris)`;

            // Render mapping rows
            if (mergerMappingList) {
              mergerMappingList.innerHTML = '';
              const defMappings = [
                { placeholder: 'A1', col: 'B' },
                { placeholder: 'A2', col: 'C' },
                { placeholder: 'A3', col: 'D' }
              ];
              defMappings.forEach((m, idx) => {
                const row = document.createElement('div');
                row.style.display = 'flex';
                row.style.gap = '6px';
                row.style.alignItems = 'center';
                row.innerHTML = `
                  <input type="text" class="input-text" value="${m.placeholder}" style="width: 70px;" />
                  <span style="color: var(--text-dim);">➔</span>
                  <select class="select-native" style="flex: 1;">
                    ${parseRes.headers.map(h => `<option value="${h.letter}" ${h.letter === m.col ? 'selected' : ''}>${h.label}</option>`).join('')}
                  </select>
                `;
                mergerMappingList.appendChild(row);
              });
            }

            updateMergerPreview();
            showToast(`Berhasil membaca file Excel (${parseRes.totalRows} baris).`);
          } else {
            alert(`Gagal membaca Excel: ${parseRes.message}`);
          }
        }
      }
    });
  }

  ['txtManualA1', 'txtManualA2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateMergerPreview);
  });

  if (btnExecuteMerger) {
    btnExecuteMerger.addEventListener('click', async () => {
      let finalRows = [];
      let finalMappings = [];

      if (mergerActiveSource === 'excel') {
        if (!excelMergerData || !excelMergerData.rows || !excelMergerData.rows.length) {
          alert('Pilih file Excel terlebih dahulu.');
          return;
        }
        finalRows = excelMergerData.rows;
        const mappingRows = mergerMappingList.querySelectorAll('div');
        mappingRows.forEach(mr => {
          const ph = mr.querySelector('input')?.value.trim();
          const col = mr.querySelector('select')?.value;
          if (ph && col) finalMappings.push({ placeholder: ph, column: col });
        });
      } else {
        const a1Lines = (document.getElementById('txtManualA1')?.value || '').split(/\r?\n/).filter(l => l.trim());
        const a2Lines = (document.getElementById('txtManualA2')?.value || '').split(/\r?\n/).filter(l => l.trim());
        const maxL = Math.max(a1Lines.length, a2Lines.length);
        if (maxL === 0) {
          alert('Ketik minimal 1 baris data teks.');
          return;
        }
        for (let i = 0; i < maxL; i++) {
          finalRows.push({ A1: a1Lines[i] || '', A2: a2Lines[i] || '' });
        }
        finalMappings = [
          { placeholder: 'A1', column: 'A1' },
          { placeholder: 'A2', column: 'A2' }
        ];
      }

      const mode = selMergerOutputMode.value;
      const cols = parseInt(document.getElementById('numMergerGridCols')?.value, 10) || 2;
      const gridRows = parseInt(document.getElementById('numMergerGridRows')?.value, 10) || 5;
      const spacingX = parseFloat(document.getElementById('numMergerSpacingX')?.value) || 0.5;
      const spacingY = parseFloat(document.getElementById('numMergerSpacingY')?.value) || 0.5;
      const autoCurves = document.getElementById('chkMergerAutoCurves')?.checked ?? true;

      btnExecuteMerger.disabled = true;
      btnExecuteMerger.innerText = 'Memproses di CorelDRAW...';

      try {
        if (window.corelAPI?.executeMerger) {
          const res = await window.corelAPI.executeMerger({
            rows: finalRows,
            mappings: finalMappings,
            mode,
            cols,
            gridRows,
            spacingX,
            spacingY,
            gridOrder: 'left_right',
            autoCurves
          });

          if (res.success) {
            showToast(`Sukses: ${res.message || 'Data berhasil digabungkan!'}`, true);
            alert(`🎉 Sukses!\n\n${res.message}`);
          } else {
            showToast(`Gagal: ${res.message}`, false);
            alert(`Gagal merger:\n\n${res.message}`);
          }
        }
      } catch (err) {
        showToast(`Error: ${err.message}`, false);
      } finally {
        btnExecuteMerger.disabled = false;
        btnExecuteMerger.innerText = '🚀 Gas Proses di CorelDRAW';
      }
    });
  }

  // ==========================================
  // 8. Tool: Ukuran & Layout Logic
  // ==========================================
  const btnApplyResizeLayout = document.getElementById('btnApplyResizeLayout');
  if (btnApplyResizeLayout) {
    btnApplyResizeLayout.addEventListener('click', async () => {
      const w = parseFloat(document.getElementById('numResizeWidth')?.value) || 10;
      const h = parseFloat(document.getElementById('numResizeHeight')?.value) || 10;
      const center = document.getElementById('chkCenterToPage')?.checked ?? true;

      btnApplyResizeLayout.disabled = true;
      try {
        if (window.corelAPI?.executeResizeLayout) {
          const res = await window.corelAPI.executeResizeLayout({ widthCm: w, heightCm: h, centerPage: center });
          if (res.success) {
            showToast(res.message || 'Ukuran berhasil diubah.');
          } else {
            alert(res.message);
          }
        }
      } catch (err) {
        showToast(err.message, false);
      } finally {
        btnApplyResizeLayout.disabled = false;
      }
    });
  }

  // ==========================================
  // 9. Tool: Split Logic
  // ==========================================
  const btnBrowseSplitFolder = document.getElementById('btnBrowseSplitFolder');
  const txtSplitFolder = document.getElementById('txtSplitFolder');
  const btnExecuteSplit = document.getElementById('btnExecuteSplit');

  if (btnBrowseSplitFolder) {
    btnBrowseSplitFolder.addEventListener('click', async () => {
      if (window.corelAPI?.openDirectory) {
        const res = await window.corelAPI.openDirectory();
        if (res.success && res.path) {
          txtSplitFolder.value = res.path;
        }
      }
    });
  }

  if (btnExecuteSplit) {
    btnExecuteSplit.addEventListener('click', async () => {
      if (!txtSplitFolder.value) {
        alert('Pilih folder tujuan simpan terlebih dahulu.');
        return;
      }
      btnExecuteSplit.disabled = true;
      try {
        if (window.corelAPI?.executeSplit) {
          const res = await window.corelAPI.executeSplit({
            mode: document.getElementById('selSplitMode')?.value || 'pages',
            outputFolder: txtSplitFolder.value
          });
          if (res.success) {
            showToast(res.message);
            alert(`🎉 Sukses!\n\n${res.message}`);
          } else {
            alert(res.message);
          }
        }
      } catch (err) {
        showToast(err.message, false);
      } finally {
        btnExecuteSplit.disabled = false;
      }
    });
  }

  // ==========================================
  // 10. Tool: Batch Processing Logic
  // ==========================================
  const btnExecuteBatchPipeline = document.getElementById('btnExecuteBatchPipeline');
  if (btnExecuteBatchPipeline) {
    btnExecuteBatchPipeline.addEventListener('click', async () => {
      const checkedSteps = [];
      document.querySelectorAll('.chk-batch-step:checked').forEach(cb => {
        checkedSteps.push(cb.getAttribute('data-step'));
      });
      if (checkedSteps.length === 0) {
        alert('Pilih minimal 1 proses batch.');
        return;
      }

      btnExecuteBatchPipeline.disabled = true;
      btnExecuteBatchPipeline.innerText = 'Menjalankan Batch...';
      try {
        if (window.corelAPI?.executeBatch) {
          const res = await window.corelAPI.executeBatch({ tasks: checkedSteps });
          if (res.success) {
            showToast(res.message);
            alert(`🎉 Sukses!\n\n${res.message}`);
          } else {
            alert(res.message);
          }
        }
      } catch (err) {
        showToast(err.message, false);
      } finally {
        btnExecuteBatchPipeline.disabled = false;
        btnExecuteBatchPipeline.innerText = '⚡ Jalankan Pipeline di CorelDRAW';
      }
    });
  }

  // ==========================================
  // 11. Tool: Utilitas 1-Click
  // ==========================================
  const utilActions = [
    { btnId: 'btnUtilCurves', cmd: 'curves' },
    { btnId: 'btnUtilGuidelines', cmd: 'guidelines' },
    { btnId: 'btnUtilUngroup', cmd: 'ungroup' },
    { btnId: 'btnUtilEmptyLayers', cmd: 'emptyLayers' }
  ];

  utilActions.forEach(({ btnId, cmd }) => {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try {
          if (window.corelAPI?.executeUtility) {
            const res = await window.corelAPI.executeUtility(cmd);
            if (res.success) {
              showToast(res.message || 'Operasi utilitas berhasil.');
              alert(`✓ ${res.message || 'Berhasil!'}`);
            } else {
              alert(res.message);
            }
          }
        } catch (err) {
          showToast(err.message, false);
        } finally {
          btn.disabled = false;
        }
      });
    }
  });

  // ==========================================
  // 12. Keyboard Shortcuts (Native Desktop)
  // ==========================================
  window.addEventListener('keydown', (e) => {
    // Esc: return to Beranda if in tool view
    if (e.key === 'Escape') {
      if (activeView !== 'beranda') {
        switchView('beranda');
      }
    }
    // Ctrl+1: Beranda, Ctrl+2: Enumerator, Ctrl+3: Konversi, Ctrl+4: Warna, Ctrl+5: Merger
    if (e.ctrlKey && !e.shiftKey && !e.altKey) {
      if (e.key === '1') { e.preventDefault(); switchView('beranda'); }
      if (e.key === '2') { e.preventDefault(); switchView('enumerator'); }
      if (e.key === '3') { e.preventDefault(); switchView('konversi'); }
      if (e.key === '4') { e.preventDefault(); switchView('warna'); }
      if (e.key === '5') { e.preventDefault(); switchView('merger'); }
    }
  });
});
