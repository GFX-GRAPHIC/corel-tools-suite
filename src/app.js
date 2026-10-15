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
  // 7. Tool: Generator Sertifikat & Data Bebas (VDP)
  // ==========================================
  const btnTabMergerExcel = document.getElementById('btnTabMergerExcel');
  const btnTabMergerManual = document.getElementById('btnTabMergerManual');
  const mergerExcelSection = document.getElementById('mergerExcelSection');
  const mergerManualSection = document.getElementById('mergerManualSection');
  const mergerExcelDropzone = document.getElementById('mergerExcelDropzone');
  const fileMergerExcelInput = document.getElementById('fileMergerExcelInput');
  const boxMergerFileInfo = document.getElementById('boxMergerFileInfo');
  const lblMergerFileName = document.getElementById('lblMergerFileName');
  const lblMergerRowCount = document.getElementById('lblMergerRowCount');
  const btnMergerChangeFile = document.getElementById('btnMergerChangeFile');
  const selMergerSheet = document.getElementById('selMergerSheet');
  const selMergerHeaderRow = document.getElementById('selMergerHeaderRow');
  const boxMergerExcelPreview = document.getElementById('boxMergerExcelPreview');
  const lblMergerColCount = document.getElementById('lblMergerColCount');
  const tblMergerExcelHead = document.getElementById('tblMergerExcelHead');
  const tblMergerExcelBody = document.getElementById('tblMergerExcelBody');
  const mergerMappingList = document.getElementById('mergerMappingList');
  const btnMergerPresetA1 = document.getElementById('btnMergerPresetA1');
  const btnMergerAddMapping = document.getElementById('btnMergerAddMapping');

  const btnManualPresetA1 = document.getElementById('btnManualPresetA1');
  const btnManualAddVar = document.getElementById('btnManualAddVar');
  const mergerManualCardsContainer = document.getElementById('mergerManualCardsContainer');

  const selMergerOutputMode = document.getElementById('selMergerOutputMode');
  const boxMergerGridSettings = document.getElementById('boxMergerGridSettings');
  const numMergerGridCols = document.getElementById('numMergerGridCols');
  const numMergerGridRows = document.getElementById('numMergerGridRows');
  const numMergerSpacingX = document.getElementById('numMergerSpacingX');
  const numMergerSpacingY = document.getElementById('numMergerSpacingY');
  const selMergerGridOrder = document.getElementById('selMergerGridOrder');
  const lblMergerGridSummary = document.getElementById('lblMergerGridSummary');
  const chkMergerAutoCurves = document.getElementById('chkMergerAutoCurves');

  const tblMergerPreview = document.getElementById('tblMergerPreview');
  const tblMergerPreviewHead = document.getElementById('tblMergerPreviewHead');
  const tblMergerPreviewBody = document.getElementById('tblMergerPreviewBody');
  const lblMergerSummaryCount = document.getElementById('lblMergerSummaryCount');
  const btnExecuteMerger = document.getElementById('btnExecuteMerger');
  const btnMergerOpenCompanion = document.getElementById('btnMergerOpenCompanion');

  let mergerActiveSource = 'excel'; // 'excel' or 'manual'
  let currentExcelFilePath = '';
  let activeExcelWorkbookInfo = null;

  let excelMappings = [
    { placeholder: 'A1', col: 'B' },
    { placeholder: 'A2', col: 'C' },
    { placeholder: 'A3', col: 'D' }
  ];

  let manualVariables = [
    { placeholder: 'A1', label: 'Nama Lengkap / Peserta', text: 'Ahmad Dahlan\nBudi Santoso\nCitra Kirana\nDewi Lestari\nEko Prasetyo' },
    { placeholder: 'A2', label: 'Instansi / Perusahaan', text: 'PT Maju Bersama\nUniversitas Indonesia\nSMK Negeri 1\nDinas Pendidikan\nBank Mandiri' },
    { placeholder: 'A3', label: 'Predikat / Juara', text: 'Juara 1 Desain\nJuara 2 Desain\nJuara 3 Desain\nHarapan 1\nHarapan 2' }
  ];

  // Tab switching
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
      renderManualCards();
      updateMergerPreview();
    });
  }

  // Grid settings toggle & summary calculation
  function updateGridSummary() {
    const cols = parseInt(numMergerGridCols?.value, 10) || 2;
    const rows = parseInt(numMergerGridRows?.value, 10) || 5;
    const perPage = cols * rows;
    if (lblMergerGridSummary) {
      lblMergerGridSummary.innerHTML = `📐 <b>${cols} Kolom × ${rows} Baris = ${perPage} Desain per Lembar Cetak</b>`;
    }
  }

  if (selMergerOutputMode) {
    selMergerOutputMode.addEventListener('change', () => {
      if (selMergerOutputMode.value === 'grid') {
        boxMergerGridSettings.style.display = 'flex';
        updateGridSummary();
      } else {
        boxMergerGridSettings.style.display = 'none';
      }
    });
  }

  [numMergerGridCols, numMergerGridRows, numMergerSpacingX, numMergerSpacingY].forEach(el => {
    if (el) el.addEventListener('input', updateGridSummary);
  });

  // Excel Dropzone & File Pickers
  if (mergerExcelDropzone) {
    mergerExcelDropzone.addEventListener('click', async () => {
      if (window.corelAPI?.selectExcelFile) {
        const res = await window.corelAPI.selectExcelFile();
        if (res.success && res.filePath) {
          handleExcelFileSelected(res.filePath);
        }
      } else if (fileMergerExcelInput) {
        fileMergerExcelInput.click();
      }
    });

    mergerExcelDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      mergerExcelDropzone.classList.add('dragover');
    });

    mergerExcelDropzone.addEventListener('dragleave', () => {
      mergerExcelDropzone.classList.remove('dragover');
    });

    mergerExcelDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      mergerExcelDropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleExcelFileSelected(e.dataTransfer.files[0]);
      }
    });
  }

  if (fileMergerExcelInput) {
    fileMergerExcelInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleExcelFileSelected(e.target.files[0]);
      }
    });
  }

  if (btnMergerChangeFile) {
    btnMergerChangeFile.addEventListener('click', () => {
      if (window.corelAPI?.selectExcelFile) {
        window.corelAPI.selectExcelFile().then(res => {
          if (res && res.success && res.filePath) handleExcelFileSelected(res.filePath);
        });
      } else if (fileMergerExcelInput) {
        fileMergerExcelInput.click();
      }
    });
  }

  async function handleExcelFileSelected(filePathOrFile) {
    if (!filePathOrFile) return;
    showToast('Membaca file Excel...');
    try {
      let payload = null;
      let displayPath = '';

      if (typeof filePathOrFile === 'object') {
        const file = filePathOrFile;
        let nativePath = '';
        if (window.corelAPI?.getPathForFile) {
          try { nativePath = window.corelAPI.getPathForFile(file); } catch {}
        }
        if (!nativePath && file.path) nativePath = file.path;
        displayPath = nativePath || file.name || 'data.xlsx';

        // Convert to Base64 (100% reliable across Electron/browser)
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const res = reader.result;
            const b64 = typeof res === 'string' ? (res.split(',')[1] || res) : '';
            resolve(b64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        payload = {
          base64,
          fileName: file.name || 'data_peserta.xlsx',
          filePath: nativePath || file.name || ''
        };
      } else {
        displayPath = filePathOrFile;
        payload = filePathOrFile;
      }

      currentExcelFilePath = displayPath;

      const res = await window.corelAPI.parseExcelFile(payload);
      if (res && res.success) {
        activeExcelWorkbookInfo = res;
        excelMergerData = res;

        // Update UI visibility
        if (mergerExcelDropzone) mergerExcelDropzone.style.display = 'none';
        if (boxMergerFileInfo) boxMergerFileInfo.style.display = 'flex';
        if (boxMergerExcelPreview) boxMergerExcelPreview.style.display = 'flex';

        lblMergerFileName.innerText = (res.filePath || displayPath).split(/[/\\]/).pop();
        lblMergerRowCount.innerText = `(${res.totalRows} Baris Data)`;
        lblMergerColCount.innerText = `${res.headers ? res.headers.length : 0} Kolom`;

        // Populate sheets dropdown
        selMergerSheet.innerHTML = '';
        if (res.sheetNames) {
          res.sheetNames.forEach(sh => {
            const opt = document.createElement('option');
            opt.value = sh;
            opt.innerText = sh;
            if (sh === res.activeSheet) opt.selected = true;
            selMergerSheet.appendChild(opt);
          });
        }

        // Populate header rows dropdown
        populateHeaderRowSelector(res.headerRowIdx, res.rawData?.length || 10);

        renderExcelPreviewTable(res.headers, res.rows);
        autoMapVariablesFromHeaders(res.headers);
        renderMergerMappingList();
        updateMergerPreview();
        showToast(`✓ File Excel berhasil dimuat: ${res.totalRows} baris`);
      } else {
        alert(`Gagal membaca Excel: ${res?.message || 'Format tidak valid'}`);
      }
    } catch (err) {
      alert(`Error membaca file Excel: ${err.message}`);
    }
  }

  function populateHeaderRowSelector(activeIdx, totalRowsCount) {
    if (!selMergerHeaderRow) return;
    selMergerHeaderRow.innerHTML = '';
    const limit = Math.min(10, Math.max(5, totalRowsCount || 10));
    for (let i = 0; i < limit; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.innerText = (i === activeIdx) ? `Baris ${i + 1} (Otomatis)` : `Baris ${i + 1}`;
      if (i === activeIdx) opt.selected = true;
      selMergerHeaderRow.appendChild(opt);
    }
  }

  function recomputeSheetHeaders(sheetName, headerRowIdx) {
    if (!activeExcelWorkbookInfo || !activeExcelWorkbookInfo.sheetsData) return;
    const sheet = activeExcelWorkbookInfo.sheetsData[sheetName];
    if (!sheet || !sheet.rawData || sheet.rawData.length === 0) return;

    const rawData = sheet.rawData;
    const headerRow = rawData[headerRowIdx] || [];
    const maxCols = Math.max(headerRow.length, ...rawData.map(r => (Array.isArray(r) ? r.length : 0)));

    function indexToLetter(idx) {
      let letter = '';
      let temp = idx;
      while (temp >= 0) {
        letter = String.fromCharCode((temp % 26) + 65) + letter;
        temp = Math.floor(temp / 26) - 1;
      }
      return letter;
    }

    const rows = [];
    for (let rIdx = headerRowIdx + 1; rIdx < rawData.length; rIdx++) {
      const rowValues = rawData[rIdx];
      if (!rowValues) continue;
      const hasData = rowValues.some(val => val !== undefined && val !== null && String(val).trim() !== '');
      if (!hasData) continue;

      const rowObj = {};
      for (let colIdx = 0; colIdx < maxCols; colIdx++) {
        const letter = indexToLetter(colIdx);
        const cellVal = rowValues[colIdx];
        rowObj[letter] = cellVal !== undefined && cellVal !== null ? String(cellVal).trim() : '';
      }
      rows.push(rowObj);
    }

    const headers = [];
    for (let colIdx = 0; colIdx < maxCols; colIdx++) {
      const letter = indexToLetter(colIdx);
      const rawName = (headerRow[colIdx] !== undefined && headerRow[colIdx] !== null) ? String(headerRow[colIdx]).trim() : '';
      const name = rawName || `Kolom ${letter}`;

      let sample = '';
      for (const r of rows) {
        if (r[letter] && r[letter].trim() !== '') {
          sample = r[letter].trim();
          if (sample.length > 25) sample = sample.substring(0, 22) + '...';
          break;
        }
      }

      const label = sample ? `${letter}: ${name} (Contoh: ${sample})` : `${letter}: ${name}`;
      headers.push({ letter, name, sample, label });
    }

    sheet.headers = headers;
    sheet.rows = rows;
    sheet.totalRows = rows.length;
    sheet.headerRowIdx = headerRowIdx;

    activeExcelWorkbookInfo.headers = headers;
    activeExcelWorkbookInfo.rows = rows;
    activeExcelWorkbookInfo.totalRows = rows.length;
    activeExcelWorkbookInfo.headerRowIdx = headerRowIdx;
    excelMergerData = activeExcelWorkbookInfo;

    lblMergerRowCount.innerText = `(${rows.length} Baris Data)`;
    lblMergerColCount.innerText = `${headers.length} Kolom`;

    renderExcelPreviewTable(headers, rows);
    autoMapVariablesFromHeaders(headers);
    renderMergerMappingList();
    updateMergerPreview();
  }

  function autoMapVariablesFromHeaders(headers) {
    if (!headers || headers.length === 0) return;

    const nameCol = headers.find(h => /nama|peserta|name/i.test(h.name));
    const awardCol = headers.find(h => /juara|predikat|kategori|sebagai|instrumen|award/i.test(h.name));
    const noCol = headers.find(h => /nomor|no\.|sertifikat|kode/i.test(h.name));

    excelMappings.forEach(v => {
      const p = (v.placeholder || '').toUpperCase();

      if (p === 'A1') {
        if (noCol) v.col = noCol.letter;
        else if (nameCol) v.col = nameCol.letter;
      } else if (p === 'A2') {
        if (nameCol) v.col = nameCol.letter;
        else if (awardCol) v.col = awardCol.letter;
      } else if (p === 'A3') {
        if (awardCol) v.col = awardCol.letter;
        else if (noCol) v.col = noCol.letter;
      }
    });
  }

  // Reload sheet when selection changes
  if (selMergerSheet) {
    selMergerSheet.addEventListener('change', () => {
      if (!activeExcelWorkbookInfo || !activeExcelWorkbookInfo.sheetsData) return;
      const sheetName = selMergerSheet.value;
      const sheet = activeExcelWorkbookInfo.sheetsData[sheetName];
      if (sheet) {
        activeExcelWorkbookInfo.activeSheet = sheetName;
        activeExcelWorkbookInfo.headers = sheet.headers;
        activeExcelWorkbookInfo.rows = sheet.rows;
        activeExcelWorkbookInfo.totalRows = sheet.totalRows;
        activeExcelWorkbookInfo.headerRowIdx = sheet.headerRowIdx || 0;
        excelMergerData = activeExcelWorkbookInfo;

        lblMergerRowCount.innerText = `(${sheet.totalRows} Baris Data)`;
        lblMergerColCount.innerText = `${sheet.headers.length} Kolom`;

        populateHeaderRowSelector(sheet.headerRowIdx, sheet.rawData?.length || 10);
        renderExcelPreviewTable(sheet.headers, sheet.rows);
        autoMapVariablesFromHeaders(sheet.headers);
        renderMergerMappingList();
        updateMergerPreview();
      }
    });
  }

  if (selMergerHeaderRow) {
    selMergerHeaderRow.addEventListener('change', () => {
      const idx = parseInt(selMergerHeaderRow.value, 10);
      recomputeSheetHeaders(selMergerSheet.value, idx);
    });
  }

  function renderExcelPreviewTable(headers, rows) {
    if (!boxMergerExcelPreview || !tblMergerExcelHead || !tblMergerExcelBody) return;
    boxMergerExcelPreview.style.display = 'flex';
    lblMergerColCount.innerText = `${headers ? headers.length : 0} Kolom`;

    tblMergerExcelHead.innerHTML = '';
    tblMergerExcelBody.innerHTML = '';

    if (headers && headers.length > 0) {
      const trH = document.createElement('tr');
      headers.forEach(h => {
        const th = document.createElement('th');
        th.innerText = `${h.letter}: ${h.name}`;
        trH.appendChild(th);
      });
      tblMergerExcelHead.appendChild(trH);
    }

    const previewSlice = (rows || []).slice(0, 5);
    if (previewSlice.length > 0) {
      previewSlice.forEach(row => {
        const trB = document.createElement('tr');
        headers.forEach(h => {
          const td = document.createElement('td');
          td.innerText = row[h.letter] ?? '';
          trB.appendChild(td);
        });
        tblMergerExcelBody.appendChild(trB);
      });
    }
  }

  function renderMergerMappingList() {
    if (!mergerMappingList) return;
    mergerMappingList.innerHTML = '';

    const headers = excelMergerData?.headers || [
      { letter: 'A', label: 'Kolom A' },
      { letter: 'B', label: 'Kolom B' },
      { letter: 'C', label: 'Kolom C' },
      { letter: 'D', label: 'Kolom D' }
    ];

    excelMappings.forEach((m, idx) => {
      const row = document.createElement('div');
      row.className = 'mapping-row';
      row.innerHTML = `
        <input type="text" class="input-text mapping-ph" value="${m.placeholder}" style="width: 75px; font-weight: 700; text-align: center; color: var(--accent-blue);" />
        <span style="color: var(--text-dim); font-size: 13px;">➔</span>
        <select class="select-native mapping-col" style="flex: 1;">
          ${headers.map(h => `<option value="${h.letter}" ${h.letter === m.col ? 'selected' : ''}>[${h.letter}] ${h.label}</option>`).join('')}
        </select>
        <button type="button" class="btn-danger btn-remove-mapping" style="height: 24px; padding: 0 6px; font-size: 10px;" title="Hapus Pemetaan">✕</button>
      `;

      // Event listeners
      row.querySelector('.mapping-ph').addEventListener('input', (e) => {
        m.placeholder = e.target.value;
        updateMergerPreview();
      });
      row.querySelector('.mapping-col').addEventListener('change', (e) => {
        m.col = e.target.value;
        updateMergerPreview();
      });
      row.querySelector('.btn-remove-mapping').addEventListener('click', () => {
        excelMappings.splice(idx, 1);
        renderMergerMappingList();
        updateMergerPreview();
      });

      mergerMappingList.appendChild(row);
    });
  }

  if (btnMergerAddMapping) {
    btnMergerAddMapping.addEventListener('click', () => {
      const nextIdx = excelMappings.length + 1;
      const letters = ['A','B','C','D','E','F','G','H','I','J'];
      const nextCol = letters[nextIdx] || 'A';
      excelMappings.push({ placeholder: `A${nextIdx}`, col: nextCol });
      renderMergerMappingList();
      updateMergerPreview();
    });
  }

  if (btnMergerPresetA1) {
    btnMergerPresetA1.addEventListener('click', () => {
      excelMappings = [
        { placeholder: 'A1', col: 'B' },
        { placeholder: 'A2', col: 'C' },
        { placeholder: 'A3', col: 'D' }
      ];
      renderMergerMappingList();
      updateMergerPreview();
      showToast('Pemetaan direset ke Preset A1-A3');
    });
  }

  // Manual Mode Variable Cards
  function renderManualCards() {
    if (!mergerManualCardsContainer) return;
    mergerManualCardsContainer.innerHTML = '';

    manualVariables.forEach((v, idx) => {
      const card = document.createElement('div');
      card.className = 'variable-card';
      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <input type="text" class="input-text manual-ph" value="${v.placeholder}" style="width: 65px; height: 24px; font-weight: 700; text-align: center; color: var(--accent-blue);" />
            <input type="text" class="input-text manual-label" value="${v.label}" placeholder="Label / Keterangan..." style="flex: 1; height: 24px; font-size: 11px;" />
          </div>
          <button type="button" class="btn-danger btn-remove-var" style="height: 22px; padding: 0 6px; font-size: 10px;" title="Hapus Variabel">✕</button>
        </div>
        <textarea class="textarea-native manual-text" style="height: 65px; font-size: 11px; line-height: 1.4;" placeholder="Ketik atau paste data teks di sini... (1 baris = 1 nilai)">${v.text}</textarea>
      `;

      card.querySelector('.manual-ph').addEventListener('input', (e) => {
        v.placeholder = e.target.value;
        updateMergerPreview();
      });
      card.querySelector('.manual-label').addEventListener('input', (e) => {
        v.label = e.target.value;
      });
      card.querySelector('.manual-text').addEventListener('input', (e) => {
        v.text = e.target.value;
        updateMergerPreview();
      });
      card.querySelector('.btn-remove-var').addEventListener('click', () => {
        manualVariables.splice(idx, 1);
        renderManualCards();
        updateMergerPreview();
      });

      mergerManualCardsContainer.appendChild(card);
    });
  }

  if (btnManualAddVar) {
    btnManualAddVar.addEventListener('click', () => {
      const nextIdx = manualVariables.length + 1;
      manualVariables.push({
        placeholder: `A${nextIdx}`,
        label: `Variabel ${nextIdx}`,
        text: ''
      });
      renderManualCards();
      updateMergerPreview();
    });
  }

  if (btnManualPresetA1) {
    btnManualPresetA1.addEventListener('click', () => {
      manualVariables = [
        { placeholder: 'A1', label: 'Nama Lengkap / Peserta', text: 'Ahmad Dahlan\nBudi Santoso\nCitra Kirana\nDewi Lestari\nEko Prasetyo' },
        { placeholder: 'A2', label: 'Instansi / Perusahaan', text: 'PT Maju Bersama\nUniversitas Indonesia\nSMK Negeri 1\nDinas Pendidikan\nBank Mandiri' },
        { placeholder: 'A3', label: 'Predikat / Juara', text: 'Juara 1 Desain\nJuara 2 Desain\nJuara 3 Desain\nHarapan 1\nHarapan 2' }
      ];
      renderManualCards();
      updateMergerPreview();
      showToast('Variabel manual direset ke Preset A1-A3');
    });
  }

  // Update Right Preview Table
  function updateMergerPreview() {
    let previewCols = [];
    let previewRows = [];

    if (mergerActiveSource === 'excel') {
      if (excelMergerData && excelMergerData.rows) {
        previewCols = excelMappings.map(m => m.placeholder);
        previewRows = excelMergerData.rows.map(r => {
          const item = {};
          excelMappings.forEach(m => {
            item[m.placeholder] = r[m.col] ?? '';
          });
          return item;
        });
      }
    } else {
      previewCols = manualVariables.map(v => v.placeholder);
      const splitLines = manualVariables.map(v => v.text.split(/\r?\n/).filter(l => l.trim()));
      const maxRows = Math.max(...splitLines.map(l => l.length), 0);
      for (let i = 0; i < maxRows; i++) {
        const item = {};
        manualVariables.forEach((v, vIdx) => {
          item[v.placeholder] = splitLines[vIdx][i] || '';
        });
        previewRows.push(item);
      }
    }

    if (lblMergerSummaryCount) {
      lblMergerSummaryCount.innerText = `(${previewRows.length} Baris Siap Dicetak)`;
    }

    if (tblMergerPreviewHead && tblMergerPreviewBody) {
      tblMergerPreviewHead.innerHTML = '';
      tblMergerPreviewBody.innerHTML = '';

      if (previewRows.length === 0 || previewCols.length === 0) {
        tblMergerPreviewBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-dim); padding: 30px;">Belum ada data. Silakan pilih file Excel atau ketik teks manual.</td></tr>`;
        return;
      }

      // Render Head
      const trH = document.createElement('tr');
      const thNo = document.createElement('th');
      thNo.style.width = '35px';
      thNo.innerText = 'No';
      trH.appendChild(thNo);
      previewCols.forEach(col => {
        const th = document.createElement('th');
        th.innerText = col;
        trH.appendChild(th);
      });
      tblMergerPreviewHead.appendChild(trH);

      // Render Rows (up to 50 for speed)
      const maxDisplay = Math.min(previewRows.length, 50);
      for (let i = 0; i < maxDisplay; i++) {
        const trB = document.createElement('tr');
        const tdNo = document.createElement('td');
        tdNo.innerText = i + 1;
        trB.appendChild(tdNo);
        previewCols.forEach(col => {
          const td = document.createElement('td');
          td.innerText = previewRows[i][col] || '';
          trB.appendChild(td);
        });
        tblMergerPreviewBody.appendChild(trB);
      }
    }
  }

  // Execute Certificate & Variable Data Merger
  if (btnExecuteMerger) {
    btnExecuteMerger.addEventListener('click', async () => {
      let finalRows = [];
      let finalMappings = [];

      if (mergerActiveSource === 'excel') {
        if (!excelMergerData || !excelMergerData.rows || !excelMergerData.rows.length) {
          alert('Pilih file Excel yang memiliki baris data terlebih dahulu.');
          return;
        }
        if (!excelMappings || excelMappings.length === 0) {
          alert('Atur minimal 1 pemetaan placeholder teks Corel ➔ Kolom Excel.');
          return;
        }
        finalRows = excelMergerData.rows;
        finalMappings = excelMappings.map(m => ({
          placeholder: m.placeholder.trim(),
          column: m.col
        }));
      } else {
        const splitLines = manualVariables.map(v => v.text.split(/\r?\n/).filter(l => l.trim()));
        const maxRows = Math.max(...splitLines.map(l => l.length), 0);
        if (maxRows === 0) {
          alert('Ketik minimal 1 baris teks pada variabel manual.');
          return;
        }
        for (let i = 0; i < maxRows; i++) {
          const rowObj = {};
          manualVariables.forEach((v, vIdx) => {
            rowObj[v.placeholder] = splitLines[vIdx][i] || '';
          });
          finalRows.push(rowObj);
        }
        finalMappings = manualVariables.map(v => ({
          placeholder: v.placeholder.trim(),
          column: v.placeholder.trim()
        }));
      }

      const mode = selMergerOutputMode?.value || 'page';
      const cols = parseInt(numMergerGridCols?.value, 10) || 2;
      const gridRows = parseInt(numMergerGridRows?.value, 10) || 5;
      const spacingX = parseFloat(numMergerSpacingX?.value) || 0.5;
      const spacingY = parseFloat(numMergerSpacingY?.value) || 0.5;
      const gridOrder = selMergerGridOrder?.value || 'left_right';
      const autoCurves = chkMergerAutoCurves?.checked ?? true;

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
            gridOrder,
            autoCurves
          });

          if (res.success) {
            showToast(`Sukses: ${res.message || 'Selesai!'}`, true);
            alert(`🎉 Sukses!\n\n${res.message}`);
          } else {
            showToast(`Gagal: ${res.message}`, false);
            alert(`Gagal memproses merger:\n\n${res.message}`);
          }
        }
      } catch (err) {
        showToast(`Error: ${err.message}`, false);
        alert(`Error: ${err.message}`);
      } finally {
        btnExecuteMerger.disabled = false;
        btnExecuteMerger.innerText = '🚀 Gas Proses di CorelDRAW';
      }
    });
  }

  // Floating Companion Windows Launchers
  if (btnMergerOpenCompanion) {
    btnMergerOpenCompanion.addEventListener('click', () => {
      if (window.corelAPI?.corelOpenCertMergerTool) {
        window.corelAPI.corelOpenCertMergerTool();
      }
    });
  }

  // ==========================================
  // 8. Tool: Auto-Layout Jersey
  // ==========================================
  const btnJerseyOpenCompanion = document.getElementById('btnJerseyOpenCompanion');
  const btnExecuteJerseyLayout = document.getElementById('btnExecuteJerseyLayout');
  const btnJerseyAddPlayer = document.getElementById('btnJerseyAddPlayer');
  const btnJerseyImportExcel = document.getElementById('btnJerseyImportExcel');
  const btnJerseyClearPlayers = document.getElementById('btnJerseyClearPlayers');
  const fileJerseyExcelInput = document.getElementById('fileJerseyExcelInput');
  const tbodyJerseyPlayers = document.getElementById('tbodyJerseyPlayers');
  const lblJerseyPlayerCount = document.getElementById('lblJerseyPlayerCount');

  let jerseyPlayers = [
    { name: 'ALEXANDER', number: '10', size: 'L' },
    { name: 'CHRISTIAN', number: '07', size: 'M' },
    { name: 'DAVID PRATAMA', number: '09', size: 'XL' },
    { name: 'FERNANDO', number: '11', size: 'L' }
  ];

  function renderJerseyPlayerTable() {
    if (!tbodyJerseyPlayers) return;
    tbodyJerseyPlayers.innerHTML = '';
    jerseyPlayers.forEach((p, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td><input type="text" class="input-text p-name" value="${p.name}" style="height: 22px; font-size: 11px;" /></td>
        <td><input type="text" class="input-text p-num" value="${p.number}" style="height: 22px; font-size: 11px;" /></td>
        <td>
          <select class="select-native p-size" style="height: 22px; font-size: 11px;">
            <option value="S" ${p.size === 'S' ? 'selected' : ''}>S</option>
            <option value="M" ${p.size === 'M' ? 'selected' : ''}>M</option>
            <option value="L" ${p.size === 'L' ? 'selected' : ''}>L</option>
            <option value="XL" ${p.size === 'XL' ? 'selected' : ''}>XL</option>
            <option value="XXL" ${p.size === 'XXL' ? 'selected' : ''}>XXL</option>
          </select>
        </td>
        <td><button type="button" class="btn-danger p-del" style="height: 20px; font-size: 9px; padding: 0 4px;">✕</button></td>
      `;

      tr.querySelector('.p-name').addEventListener('input', (e) => { p.name = e.target.value; });
      tr.querySelector('.p-num').addEventListener('input', (e) => { p.number = e.target.value; });
      tr.querySelector('.p-size').addEventListener('change', (e) => { p.size = e.target.value; });
      tr.querySelector('.p-del').addEventListener('click', () => {
        jerseyPlayers.splice(idx, 1);
        renderJerseyPlayerTable();
      });

      tbodyJerseyPlayers.appendChild(tr);
    });

    if (lblJerseyPlayerCount) {
      lblJerseyPlayerCount.innerText = `(${jerseyPlayers.length} Pemain Siap)`;
    }
  }

  if (btnJerseyAddPlayer) {
    btnJerseyAddPlayer.addEventListener('click', () => {
      jerseyPlayers.push({ name: `PEMAIN ${jerseyPlayers.length + 1}`, number: `${jerseyPlayers.length + 1}`, size: 'L' });
      renderJerseyPlayerTable();
    });
  }

  if (btnJerseyClearPlayers) {
    btnJerseyClearPlayers.addEventListener('click', () => {
      jerseyPlayers = [];
      renderJerseyPlayerTable();
    });
  }

  if (btnJerseyImportExcel) {
    btnJerseyImportExcel.addEventListener('click', async () => {
      if (window.corelAPI?.selectExcelFile) {
        const res = await window.corelAPI.selectExcelFile();
        if (res.success && res.filePath) {
          const parsed = await window.corelAPI.parseExcelFile(res.filePath);
          if (parsed.success && parsed.rows) {
            jerseyPlayers = parsed.rows.map(r => ({
              name: String(r.A || r.B || r.nama || r.Nama || 'PEMAIN').toUpperCase(),
              number: String(r.C || r.no || r.Nomor || '-'),
              size: String(r.D || r.ukuran || r.Size || 'L').toUpperCase()
            }));
            renderJerseyPlayerTable();
            showToast(`Berhasil mengimpor ${jerseyPlayers.length} pemain dari Excel!`);
          }
        }
      }
    });
  }

  if (btnExecuteJerseyLayout) {
    btnExecuteJerseyLayout.addEventListener('click', async () => {
      if (jerseyPlayers.length === 0) {
        alert('Daftar pemain masih kosong.');
        return;
      }
      const targetSize = document.getElementById('selJerseyTargetSize')?.value || 'ALL';
      const spacingCm = parseFloat(document.getElementById('numJerseySpacing')?.value) || 1.0;
      const limitCopy = parseInt(document.getElementById('numJerseyLimit')?.value, 10) || 4;
      const direction = document.getElementById('selJerseyDirection')?.value || 'vertical';
      const maxNameWidthCm = parseFloat(document.getElementById('numJerseyMaxNameWidth')?.value) || 27.0;

      btnExecuteJerseyLayout.disabled = true;
      btnExecuteJerseyLayout.innerText = 'Menata di CorelDRAW...';

      try {
        if (window.corelAPI?.executeLayout) {
          const res = await window.corelAPI.executeLayout({
            targetSize,
            players: jerseyPlayers,
            spacingCm,
            limitCopy,
            direction,
            maxNameWidthCm
          });

          if (res.success) {
            showToast(`Sukses: ${res.message || 'Pola jersey selesai ditata!'}`, true);
            alert(`🎉 Sukses!\n\n${res.message}`);
          } else {
            alert(`Gagal menata jersey:\n\n${res.message}`);
          }
        }
      } catch (err) {
        alert(`Error: ${err.message}`);
      } finally {
        btnExecuteJerseyLayout.disabled = false;
        btnExecuteJerseyLayout.innerText = '🚀 Tata Pola di CorelDRAW';
      }
    });
  }

  if (btnJerseyOpenCompanion) {
    btnJerseyOpenCompanion.addEventListener('click', () => {
      if (window.corelAPI?.corelOpenCompanionTool) {
        window.corelAPI.corelOpenCompanionTool({
          teamName: document.getElementById('txtJerseyTeamName')?.value || 'GFX ESPORTS',
          players: jerseyPlayers
        });
      }
    });
  }

  // ==========================================
  // 9. Tool: AI Jersey Tracer
  // ==========================================
  const txtTracerApiKey = document.getElementById('txtTracerApiKey');
  const btnTracerSaveKey = document.getElementById('btnTracerSaveKey');
  const lblTracerKeyStatus = document.getElementById('lblTracerKeyStatus');
  const tracerDropzone = document.getElementById('tracerDropzone');
  const fileTracerInput = document.getElementById('fileTracerInput');
  const txtTracerPrompt = document.getElementById('txtTracerPrompt');
  const selTracerModel = document.getElementById('selTracerModel');
  const numTracerBleed = document.getElementById('numTracerBleed');
  const btnTracerProcess = document.getElementById('btnTracerProcess');
  const imgTracerPreview = document.getElementById('imgTracerPreview');
  const lblTracerEmptyPreview = document.getElementById('lblTracerEmptyPreview');
  const lblTracerStatus = document.getElementById('lblTracerStatus');
  const btnExecuteTracerPowerClip = document.getElementById('btnExecuteTracerPowerClip');
  const btnTracerCopyClipboard = document.getElementById('btnTracerCopyClipboard');
  const btnTracerOpenFolder = document.getElementById('btnTracerOpenFolder');
  const btnTracerOpenCompanion = document.getElementById('btnTracerOpenCompanion');

  let tracerImageBase64 = '';
  let tracerResultPatternPath = '';

  // Load saved API Key
  const savedApiKey = localStorage.getItem('gemini_api_key') || '';
  if (txtTracerApiKey && savedApiKey) {
    txtTracerApiKey.value = savedApiKey;
  }

  if (btnTracerSaveKey) {
    btnTracerSaveKey.addEventListener('click', async () => {
      const key = txtTracerApiKey.value.trim();
      if (!key) {
        alert('Masukkan API Key Gemini.');
        return;
      }
      btnTracerSaveKey.disabled = true;
      lblTracerKeyStatus.innerText = 'Memvalidasi...';
      lblTracerKeyStatus.style.color = 'var(--accent-blue)';

      try {
        if (window.corelAPI?.aiTracerValidateKey) {
          const res = await window.corelAPI.aiTracerValidateKey(key);
          if (res.valid) {
            localStorage.setItem('gemini_api_key', key);
            lblTracerKeyStatus.innerText = '✓ Valid & Aktif';
            lblTracerKeyStatus.style.color = 'var(--accent-green)';
            showToast('API Key Gemini berhasil divalidasi dan disimpan.');
          } else {
            lblTracerKeyStatus.innerText = '✕ Tidak Valid';
            lblTracerKeyStatus.style.color = 'var(--accent-red)';
            alert(`Validasi API Key gagal: ${res.message}`);
          }
        }
      } catch (err) {
        alert(`Error validasi: ${err.message}`);
      } finally {
        btnTracerSaveKey.disabled = false;
      }
    });
  }

  if (tracerDropzone) {
    tracerDropzone.addEventListener('click', () => {
      if (fileTracerInput) fileTracerInput.click();
    });
    tracerDropzone.addEventListener('dragover', (e) => { e.preventDefault(); tracerDropzone.classList.add('dragover'); });
    tracerDropzone.addEventListener('dragleave', () => { tracerDropzone.classList.remove('dragover'); });
    tracerDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      tracerDropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleTracerImageFile(e.dataTransfer.files[0]);
      }
    });
  }

  if (fileTracerInput) {
    fileTracerInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleTracerImageFile(e.target.files[0]);
      }
    });
  }

  function handleTracerImageFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      tracerImageBase64 = e.target.result;
      imgTracerPreview.src = tracerImageBase64;
      imgTracerPreview.style.display = 'block';
      if (lblTracerEmptyPreview) lblTracerEmptyPreview.style.display = 'none';
      lblTracerStatus.innerText = `Gambar siap: ${file.name} (${Math.round(file.size / 1024)} KB)`;
      showToast('Gambar mockup jersey dimuat.');
    };
    reader.readAsDataURL(file);
  }

  if (btnTracerProcess) {
    btnTracerProcess.addEventListener('click', async () => {
      if (!tracerImageBase64) {
        alert('Upload gambar mockup jersey terlebih dahulu.');
        return;
      }
      const key = txtTracerApiKey?.value.trim() || localStorage.getItem('gemini_api_key');
      if (!key) {
        alert('Masukkan Gemini API Key terlebih dahulu.');
        return;
      }

      btnTracerProcess.disabled = true;
      btnTracerProcess.innerText = 'Memproses Analisa AI...';
      lblTracerStatus.innerText = 'Status: AI sedang menganalisa motif...';

      try {
        if (window.corelAPI?.aiTracerProcess) {
          const res = await window.corelAPI.aiTracerProcess({
            imageBase64: tracerImageBase64,
            prompt: txtTracerPrompt?.value || '',
            model: selTracerModel?.value || 'gemini-2.5-flash',
            apiKey: key
          });

          if (res.success && (res.patternPath || res.dataUrl)) {
            tracerResultPatternPath = res.patternPath;
            if (res.dataUrl) imgTracerPreview.src = res.dataUrl;
            lblTracerStatus.innerText = '✓ Motif flat berhasil diekstrak!';
            showToast('Motif pola berhasil diekstrak!');
          } else {
            alert(`Gagal memproses AI: ${res.message}`);
          }
        }
      } catch (err) {
        alert(`Error AI: ${err.message}`);
      } finally {
        btnTracerProcess.disabled = false;
        btnTracerProcess.innerText = '✨ Analisa & Ekstrak Motif Flat dengan AI';
      }
    });
  }

  if (btnExecuteTracerPowerClip) {
    btnExecuteTracerPowerClip.addEventListener('click', async () => {
      if (!tracerResultPatternPath) {
        alert('Belum ada motif yang diproses oleh AI. Klik Analisa AI terlebih dahulu.');
        return;
      }
      const bleedCm = parseFloat(numTracerBleed?.value) || 1.5;
      btnExecuteTracerPowerClip.disabled = true;

      try {
        if (window.corelAPI?.corelApplyAiPattern) {
          const res = await window.corelAPI.corelApplyAiPattern({
            patternPath: tracerResultPatternPath,
            bleedCm
          });
          if (res.success) {
            showToast(res.message || 'PowerClip berhasil!');
            alert(`🎉 Sukses!\n\n${res.message}`);
          } else {
            alert(res.message);
          }
        }
      } catch (err) {
        alert(`Error: ${err.message}`);
      } finally {
        btnExecuteTracerPowerClip.disabled = false;
      }
    });
  }

  if (btnTracerCopyClipboard) {
    btnTracerCopyClipboard.addEventListener('click', async () => {
      const src = tracerResultPatternPath || imgTracerPreview.src;
      if (!src) {
        alert('Belum ada gambar untuk disalin.');
        return;
      }
      if (window.corelAPI?.copyImageToClipboard) {
        const res = await window.corelAPI.copyImageToClipboard(src);
        if (res.success) showToast('Gambar disalin ke clipboard! Buka CorelDRAW dan tekan Ctrl+V.');
      }
    });
  }

  if (btnTracerOpenFolder) {
    btnTracerOpenFolder.addEventListener('click', () => {
      if (tracerResultPatternPath && window.corelAPI?.openFileInExplorer) {
        window.corelAPI.openFileInExplorer(tracerResultPatternPath);
      } else {
        alert('File motif belum disimpan di komputer.');
      }
    });
  }

  if (btnTracerOpenCompanion) {
    btnTracerOpenCompanion.addEventListener('click', () => {
      if (window.corelAPI?.corelOpenAiTracerTool) {
        window.corelAPI.corelOpenAiTracerTool();
      }
    });
  }

  // Right Sidebar Companion Openers & Quick Actions
  let isCorelDark = false;
  const btnQuickToggleDarkMode = document.getElementById('btnQuickToggleDarkMode');
  const btnUtilDarkMode = document.getElementById('btnUtilDarkMode');
  const badgeUtilDarkMode = document.getElementById('badgeUtilDarkMode');
  const lblQuickDarkModeText = document.getElementById('lblQuickDarkModeText');

  async function toggleCorelDark() {
    const nextMode = !isCorelDark ? 'dark' : 'light';
    try {
      if (window.corelAPI?.corelToggleDarkMode) {
        const res = await window.corelAPI.corelToggleDarkMode(nextMode);
        if (res.success) {
          isCorelDark = !isCorelDark;
          const label = isCorelDark ? 'Mode Terang' : 'Mode Gelap';
          if (lblQuickDarkModeText) lblQuickDarkModeText.innerText = `Corel ${label}`;
          if (badgeUtilDarkMode) {
            badgeUtilDarkMode.innerText = isCorelDark ? 'ON' : 'OFF';
            badgeUtilDarkMode.style.background = isCorelDark ? '#059669' : '#374151';
          }
          showToast(res.message || 'Tema CorelDRAW berhasil diubah!');
          alert(res.message);
        } else {
          alert(res.message);
        }
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  }

  if (btnQuickToggleDarkMode) btnQuickToggleDarkMode.addEventListener('click', toggleCorelDark);
  if (btnUtilDarkMode) btnUtilDarkMode.addEventListener('click', toggleCorelDark);

  const btnQuickConvertCurves = document.getElementById('btnQuickConvertCurves');
  if (btnQuickConvertCurves) {
    btnQuickConvertCurves.addEventListener('click', async () => {
      try {
        if (window.corelAPI?.corelConvertAllCurves) {
          const res = await window.corelAPI.corelConvertAllCurves();
          if (res.success) {
            showToast(res.message || 'Semua teks berhasil dikonversi ke kurva!');
            alert(`✓ ${res.message}`);
          } else {
            alert(res.message);
          }
        }
      } catch (err) {
        alert(`Error: ${err.message}`);
      }
    });
  }

  const btnQuickCenterPage = document.getElementById('btnQuickCenterPage');
  if (btnQuickCenterPage) {
    btnQuickCenterPage.addEventListener('click', async () => {
      if (window.corelAPI?.executeUtility) {
        const res = await window.corelAPI.executeUtility('centerPage');
        if (res.success) showToast('Objek berhasil ditengahkan ke halaman!');
      }
    });
  }

  const btnQuickDeleteGuides = document.getElementById('btnQuickDeleteGuides');
  if (btnQuickDeleteGuides) {
    btnQuickDeleteGuides.addEventListener('click', async () => {
      if (window.corelAPI?.executeUtility) {
        const res = await window.corelAPI.executeUtility('guidelines');
        if (res.success) showToast('Guidelines berhasil dibersihkan!');
      }
    });
  }

  // Companion window openers
  document.getElementById('btnLaunchCompanionNumerator')?.addEventListener('click', () => {
    window.corelAPI?.corelOpenNumeratorTool?.();
  });
  document.getElementById('btnUtilOpenNumeratorComp')?.addEventListener('click', () => {
    window.corelAPI?.corelOpenNumeratorTool?.();
  });
  document.getElementById('btnLaunchCompanionMerger')?.addEventListener('click', () => {
    window.corelAPI?.corelOpenCertMergerTool?.();
  });
  document.getElementById('btnUtilOpenCertComp')?.addEventListener('click', () => {
    window.corelAPI?.corelOpenCertMergerTool?.();
  });
  document.getElementById('btnLaunchCompanionJersey')?.addEventListener('click', () => {
    window.corelAPI?.corelOpenCompanionTool?.();
  });
  document.getElementById('btnUtilOpenJerseyComp')?.addEventListener('click', () => {
    window.corelAPI?.corelOpenCompanionTool?.();
  });
  document.getElementById('btnLaunchCompanionTracer')?.addEventListener('click', () => {
    window.corelAPI?.corelOpenAiTracerTool?.();
  });
  document.getElementById('btnUtilOpenTracerComp')?.addEventListener('click', () => {
    window.corelAPI?.corelOpenAiTracerTool?.();
  });

  // Render initial player table and manual cards
  renderJerseyPlayerTable();
  renderManualCards();

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
