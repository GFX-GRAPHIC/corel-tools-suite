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
          if (res.files.length === 0) {
            recentFilesContainer.innerHTML = `
              <div style="padding: 16px 8px; font-size: 11px; color: var(--text-dim); text-align: center; border: 1px dashed var(--border-color); border-radius: var(--radius-sm); margin: 6px 0;">
                📂 Belum ada dokumen CorelDRAW dibuka
              </div>
            `;
            return;
          }
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
            autoCurves,
            doubleNumber: document.getElementById('enumDoubleNumber')?.checked ?? true
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
    { placeholder: 'A1', col: 'B', width: 14, height: '', lockRatio: true, fitMode: 'max', align: 'center', textCase: 'title' },
    { placeholder: 'A2', col: 'C', width: 14, height: '', lockRatio: true, fitMode: 'max', align: 'center', textCase: 'title' },
    { placeholder: 'A3', col: 'D', width: '', height: '', lockRatio: true, fitMode: 'max', align: 'none', textCase: 'none' }
  ];

  let manualVariables = [
    { placeholder: 'A1', label: 'Nama Lengkap / Peserta', text: 'Ahmad Dahlan\nBudi Santoso\nCitra Kirana\nDewi Lestari\nEko Prasetyo', width: 14, height: '', lockRatio: true, fitMode: 'max', align: 'center', textCase: 'title' },
    { placeholder: 'A2', label: 'Instansi / Perusahaan', text: 'PT Maju Bersama\nUniversitas Indonesia\nSMK Negeri 1\nDinas Pendidikan\nBank Mandiri', width: 14, height: '', lockRatio: true, fitMode: 'max', align: 'center', textCase: 'title' },
    { placeholder: 'A3', label: 'Predikat / Juara', text: 'Juara 1 Desain\nJuara 2 Desain\nJuara 3 Desain\nHarapan 1\nHarapan 2', width: '', height: '', lockRatio: true, fitMode: 'max', align: 'none', textCase: 'none' }
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

  // Helper to create CorelDRAW size bar widget for Main Window
  function createMergerSizeBarElement(item) {
    const bar = document.createElement('div');
    bar.className = 'corel-size-bar';

    if (item.lockRatio === undefined) item.lockRatio = true;
    if (!item.fitMode) item.fitMode = 'max';
    if (!item.align) item.align = 'center';
    if (!item.textCase) item.textCase = 'none';

    bar.innerHTML = `
      <span class="size-label">📐 Ukuran:</span>
      <select class="sel-fit-mode" title="Metode Ukuran: Auto-Fit (Batas Maks) menjaga font normal & hanya mengecilkan nama yang melebihi batas; Paksa Persis memaksakan lebar/tinggi sama persis.">
        <option value="max" ${item.fitMode === 'max' ? 'selected' : ''}>🛡️ Auto-Fit (Batas Maks)</option>
        <option value="exact" ${item.fitMode === 'exact' ? 'selected' : ''}>📏 Paksa Persis</option>
      </select>
      <div class="size-input-group" title="Lebar objek teks di CorelDRAW (cm)">
        <span class="size-icon">↔</span>
        <input type="number" step="0.01" min="0" class="input-size txt-width" placeholder="Auto" value="${item.width ?? ''}" />
        <span class="size-unit">cm</span>
      </div>
      <div class="size-input-group" title="Tinggi objek teks di CorelDRAW (cm)">
        <span class="size-icon">↕</span>
        <input type="number" step="0.01" min="0" class="input-size txt-height" placeholder="Auto" value="${item.height ?? ''}" />
        <span class="size-unit">cm</span>
      </div>
      <button type="button" class="btn-lock ${item.lockRatio !== false ? 'locked' : ''}" title="${item.lockRatio !== false ? 'Status: Gembok Terkunci (Proporsional). Lebar & tinggi diskalakan seimbang agar teks tidak gepeng. Klik untuk membuka gembok.' : 'Status: Gembok Terbuka (Bebas). Lebar & tinggi diubah terpisah (bisa gepeng/distorsi). Klik untuk mengunci gembok.'}">
        ${item.lockRatio !== false ? '🔒 Gembok: Terkunci' : '🔓 Gembok: Terbuka'}
      </button>
      <select class="sel-align" title="Perataan & Posisi Teks di CorelDRAW">
        <option value="center" ${item.align === 'center' ? 'selected' : ''}>🎯 Rata Tengah</option>
        <option value="page_center" ${item.align === 'page_center' ? 'selected' : ''}>📄 Tengah Lembar</option>
        <option value="left" ${item.align === 'left' ? 'selected' : ''}>⬅️ Rata Kiri</option>
        <option value="right" ${item.align === 'right' ? 'selected' : ''}>➡️ Rata Kanan</option>
        <option value="none" ${item.align === 'none' ? 'selected' : ''}>↔️ Posisi Asli</option>
      </select>
      <select class="sel-text-case" title="Change Case (Format Huruf): Atur huruf menjadi Title Case, UPPERCASE, atau lowercase agar nama seragam">
        <option value="none" ${item.textCase === 'none' || !item.textCase ? 'selected' : ''}>🔠 Asli</option>
        <option value="title" ${item.textCase === 'title' ? 'selected' : ''}>Aa Title Case</option>
        <option value="upper" ${item.textCase === 'upper' ? 'selected' : ''}>AA UPPERCASE</option>
        <option value="lower" ${item.textCase === 'lower' ? 'selected' : ''}>aa lowercase</option>
        <option value="sentence" ${item.textCase === 'sentence' ? 'selected' : ''}>A. Sentence case</option>
        <option value="toggle" ${item.textCase === 'toggle' ? 'selected' : ''}>aA tOGGLE</option>
      </select>
      <button type="button" class="btn-sample-size" title="Ambil ukuran objek teks (${item.placeholder}) yang sedang dipilih di CorelDRAW">
        🎯 Ambil Seleksi Corel
      </button>
      ${(item.width || item.height) ? `<button type="button" class="btn-clear-size" title="Kembalikan ukuran teks ke Otomatis">↺ Auto</button>` : ''}
    `;

    const selFitMode = bar.querySelector('.sel-fit-mode');
    const inputW = bar.querySelector('.txt-width');
    const inputH = bar.querySelector('.txt-height');
    const btnLock = bar.querySelector('.btn-lock');
    const selAlign = bar.querySelector('.sel-align');
    const selTextCase = bar.querySelector('.sel-text-case');
    const btnSample = bar.querySelector('.btn-sample-size');
    const btnClear = bar.querySelector('.btn-clear-size');

    if (item.width && item.height && !item.aspectRatio) {
      item.aspectRatio = parseFloat(item.width) / parseFloat(item.height);
    }

    selFitMode.addEventListener('change', () => {
      item.fitMode = selFitMode.value;
    });

    selAlign.addEventListener('change', () => {
      item.align = selAlign.value;
    });

    selTextCase.addEventListener('change', () => {
      item.textCase = selTextCase.value;
    });

    inputW.addEventListener('input', () => {
      const val = parseFloat(inputW.value);
      item.width = isNaN(val) || val <= 0 ? '' : val;
      if (item.lockRatio && item.aspectRatio && item.width) {
        item.height = parseFloat((item.width / item.aspectRatio).toFixed(3));
        inputH.value = item.height;
      } else if (item.width && item.height) {
        item.aspectRatio = item.width / item.height;
      }
    });

    inputH.addEventListener('input', () => {
      const val = parseFloat(inputH.value);
      item.height = isNaN(val) || val <= 0 ? '' : val;
      if (item.lockRatio && item.aspectRatio && item.height) {
        item.width = parseFloat((item.height * item.aspectRatio).toFixed(3));
        inputW.value = item.width;
      } else if (item.width && item.height) {
        item.aspectRatio = item.width / item.height;
      }
    });

    btnLock.addEventListener('click', () => {
      item.lockRatio = !item.lockRatio;
      btnLock.className = `btn-lock ${item.lockRatio ? 'locked' : ''}`;
      btnLock.innerHTML = item.lockRatio ? '🔒 Gembok: Terkunci' : '🔓 Gembok: Terbuka';
      btnLock.title = item.lockRatio
        ? 'Status: Gembok Terkunci (Proporsional). Lebar & tinggi diskalakan seimbang agar teks tidak gepeng. Klik untuk membuka gembok.'
        : 'Status: Gembok Terbuka (Bebas). Lebar & tinggi diubah terpisah (bisa gepeng/distorsi). Klik untuk mengunci gembok.';
      if (item.lockRatio && item.width && item.height) {
        item.aspectRatio = parseFloat(item.width) / parseFloat(item.height);
      }
    });

    btnSample.addEventListener('click', async () => {
      try {
        btnSample.disabled = true;
        btnSample.innerText = '⌛ Mengambil...';
        const getFn = window.corelAPI?.corelGetSelectionInfo || window.electronAPI?.corelGetSelectionInfo;
        if (!getFn) {
          alert('Fitur membaca seleksi CorelDRAW hanya aktif di aplikasi desktop.');
          return;
        }
        const selInfo = await getFn();
        if (selInfo && selInfo.success && selInfo.count > 0 && selInfo.widthCm > 0) {
          item.width = selInfo.widthCm;
          item.height = selInfo.heightCm;
          item.aspectRatio = selInfo.widthCm / selInfo.heightCm;
          item.lockRatio = true;
          btnLock.className = 'btn-lock locked';
          btnLock.innerHTML = '🔒 Gembok: Terkunci';
          inputW.value = item.width;
          inputH.value = item.height;
          inputW.style.backgroundColor = '#1e3a8a';
          inputH.style.backgroundColor = '#1e3a8a';
          setTimeout(() => {
            inputW.style.backgroundColor = '';
            inputH.style.backgroundColor = '';
          }, 800);
          showToast(`Ukuran teks '${item.placeholder}' diset ke ${item.width} × ${item.height} cm`);
        } else {
          alert(`Objek teks di CorelDRAW belum dipilih!\n\nSilakan pilih (klik seleksi) objek teks '${item.placeholder}' di lembar kerja CorelDRAW, lalu klik tombol ini lagi.`);
        }
      } catch (err) {
        alert(`Gagal mengambil ukuran dari CorelDRAW: ${err.message}`);
      } finally {
        btnSample.disabled = false;
        btnSample.innerHTML = '🎯 Ambil Seleksi Corel';
      }
    });

    if (btnClear) {
      btnClear.addEventListener('click', () => {
        item.width = '';
        item.height = '';
        item.aspectRatio = null;
        inputW.value = '';
        inputH.value = '';
        btnClear.remove();
      });
    }

    return bar;
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
        <div style="display: flex; align-items: center; gap: 8px;">
          <input type="text" class="input-text mapping-ph" value="${m.placeholder}" style="width: 75px; font-weight: 700; text-align: center; color: var(--accent-blue);" />
          <span style="color: var(--text-dim); font-size: 13px;">➔</span>
          <select class="select-native mapping-col" style="flex: 1;">
            ${headers.map(h => `<option value="${h.letter}" ${h.letter === m.col ? 'selected' : ''}>[${h.letter}] ${h.label}</option>`).join('')}
          </select>
          <button type="button" class="btn-danger btn-remove-mapping" style="height: 24px; padding: 0 6px; font-size: 10px;" title="Hapus Pemetaan">✕</button>
        </div>
      `;

      // Append Sizing Controls
      row.appendChild(createMergerSizeBarElement(m));

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
      excelMappings.push({ placeholder: `A${nextIdx}`, col: nextCol, width: '', height: '', lockRatio: true, fitMode: 'max', align: 'center', textCase: 'none' });
      renderMergerMappingList();
      updateMergerPreview();
    });
  }

  if (btnMergerPresetA1) {
    btnMergerPresetA1.addEventListener('click', () => {
      excelMappings = [
        { placeholder: 'A1', col: 'B', width: 14, height: '', lockRatio: true, fitMode: 'max', align: 'center', textCase: 'title' },
        { placeholder: 'A2', col: 'C', width: 14, height: '', lockRatio: true, fitMode: 'max', align: 'center', textCase: 'title' },
        { placeholder: 'A3', col: 'D', width: '', height: '', lockRatio: true, fitMode: 'max', align: 'none', textCase: 'none' }
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
          <div style="display: flex; align-items: center; gap: 6px; flex: 1;">
            <input type="text" class="input-text manual-ph" value="${v.placeholder}" style="width: 65px; height: 24px; font-weight: 700; text-align: center; color: var(--accent-blue);" />
            <input type="text" class="input-text manual-label" value="${v.label}" placeholder="Label / Keterangan..." style="flex: 1; height: 24px; font-size: 11px;" />
          </div>
          <button type="button" class="btn-danger btn-remove-var" style="height: 22px; padding: 0 6px; font-size: 10px; margin-left: 6px;" title="Hapus Variabel">✕</button>
        </div>
        <textarea class="textarea-native manual-text" style="height: 65px; font-size: 11px; line-height: 1.4;" placeholder="Ketik atau paste data teks di sini... (1 baris = 1 nilai)">${v.text}</textarea>
      `;

      // Append Sizing Controls
      card.appendChild(createMergerSizeBarElement(v));

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
        text: '',
        width: '',
        height: '',
        lockRatio: true,
        fitMode: 'max',
        align: 'center',
        textCase: 'none'
      });
      renderManualCards();
      updateMergerPreview();
    });
  }

  if (btnManualPresetA1) {
    btnManualPresetA1.addEventListener('click', () => {
      manualVariables = [
        { placeholder: 'A1', label: 'Nama Lengkap / Peserta', text: 'Ahmad Dahlan\nBudi Santoso\nCitra Kirana\nDewi Lestari\nEko Prasetyo', width: 14, height: '', lockRatio: true, fitMode: 'max', align: 'center', textCase: 'title' },
        { placeholder: 'A2', label: 'Instansi / Perusahaan', text: 'PT Maju Bersama\nUniversitas Indonesia\nSMK Negeri 1\nDinas Pendidikan\nBank Mandiri', width: 14, height: '', lockRatio: true, fitMode: 'max', align: 'center', textCase: 'title' },
        { placeholder: 'A3', label: 'Predikat / Juara', text: 'Juara 1 Desain\nJuara 2 Desain\nJuara 3 Desain\nHarapan 1\nHarapan 2', width: '', height: '', lockRatio: true, fitMode: 'max', align: 'none', textCase: 'none' }
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
          column: m.col,
          width: m.width ? parseFloat(m.width) : 0,
          height: m.height ? parseFloat(m.height) : 0,
          lockRatio: m.lockRatio !== false,
          fitMode: m.fitMode || 'max',
          align: m.align || 'center',
          textCase: m.textCase || 'none'
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
          column: v.placeholder.trim(),
          label: v.label || v.placeholder,
          width: v.width ? parseFloat(v.width) : 0,
          height: v.height ? parseFloat(v.height) : 0,
          lockRatio: v.lockRatio !== false,
          fitMode: v.fitMode || 'max',
          align: v.align || 'center',
          textCase: v.textCase || 'none'
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
  // 8. Tool: Auto-Layout Jersey Pro
  // ==========================================
  const btnJerseyOpenCompanion = document.getElementById('btnJerseyOpenCompanion');
  const btnExecuteJerseyLayout = document.getElementById('btnExecuteJerseyLayout');
  const btnJerseyAddPlayer = document.getElementById('btnJerseyAddPlayer');
  const btnJerseyImportExcel = document.getElementById('btnJerseyImportExcel');
  const btnJerseyClearPlayers = document.getElementById('btnJerseyClearPlayers');
  const fileJerseyExcelInput = document.getElementById('fileJerseyExcelInput');
  const tbodyJerseyPlayers = document.getElementById('tbodyJerseyPlayers');
  const lblJerseyPlayerCount = document.getElementById('lblJerseyPlayerCount');
  const btnJerseyAddMapping = document.getElementById('btnJerseyAddMapping');
  const btnJerseyPreset = document.getElementById('btnJerseyPreset');
  const btnJerseyOpenChangeCase = document.getElementById('btnJerseyOpenChangeCase');
  const jerseyMappingsContainer = document.getElementById('jerseyMappingsContainer');

  // Size Chart Elements
  const chkJerseyEnableAutoResize = document.getElementById('chkJerseyEnableAutoResize');
  const btnJerseySampleMaster = document.getElementById('btnJerseySampleMaster');
  const selJerseyMasterSize = document.getElementById('selJerseyMasterSize');
  const lblJerseyMasterW = document.getElementById('lblJerseyMasterW');
  const lblJerseyMasterH = document.getElementById('lblJerseyMasterH');
  const lblJerseyMasterRatio = document.getElementById('lblJerseyMasterRatio');
  const tbodyJerseySizeChart = document.getElementById('tbodyJerseySizeChart');
  const btnJerseyAddSizeRow = document.getElementById('btnJerseyAddSizeRow');
  const btnJerseyResetSizeChart = document.getElementById('btnJerseyResetSizeChart');

  // Mode Tabs
  const btnTabJerseyExcel = document.getElementById('btnTabJerseyExcel');
  const btnTabJerseyManual = document.getElementById('btnTabJerseyManual');
  const jerseyExcelSection = document.getElementById('jerseyExcelSection');
  const jerseyManualSection = document.getElementById('jerseyManualSection');

  // Excel Dropzone & Header Controls
  const jerseyExcelDropzone = document.getElementById('jerseyExcelDropzone');
  const boxJerseyFileInfo = document.getElementById('boxJerseyFileInfo');
  const lblJerseyFileName = document.getElementById('lblJerseyFileName');
  const lblJerseyRowCount = document.getElementById('lblJerseyRowCount');
  const btnJerseyChangeFile = document.getElementById('btnJerseyChangeFile');
  const selJerseySheet = document.getElementById('selJerseySheet');
  const selJerseyHeaderRow = document.getElementById('selJerseyHeaderRow');
  const boxJerseyTablePreview = document.getElementById('boxJerseyTablePreview');
  const lblJerseyColCount = document.getElementById('lblJerseyColCount');
  const tblJerseyExcelHead = document.getElementById('tblJerseyExcelHead');
  const tblJerseyExcelBody = document.getElementById('tblJerseyExcelBody');

  // Manual Mode Elements
  const btnJerseyManualPreset = document.getElementById('btnJerseyManualPreset');
  const btnJerseyManualAddVar = document.getElementById('btnJerseyManualAddVar');
  const jerseyManualCardsContainer = document.getElementById('jerseyManualCardsContainer');
  const lblJerseyManualRowCount = document.getElementById('lblJerseyManualRowCount');
  const tblJerseyManualHead = document.getElementById('tblJerseyManualHead');
  const tblJerseyManualBody = document.getElementById('tblJerseyManualBody');

  let activeJerseyMode = 'excel'; // 'excel' | 'manual'
  let rawJerseyExcelData = null;

  // Size Chart State
  let jerseyMasterWidthCm = 206.41;
  let jerseyMasterHeightCm = 76.0;
  let jerseyMasterRatio = 2.716;

  let jerseySizeChart = [
    { size: 'XS', height: 68.5, width: 186.05, lockRatio: true },
    { size: 'S', height: 71.0, width: 192.84, lockRatio: true },
    { size: 'M', height: 73.5, width: 199.63, lockRatio: true },
    { size: 'L', height: 76.0, width: 206.41, lockRatio: true },
    { size: 'XL', height: 78.5, width: 213.20, lockRatio: true },
    { size: 'XXL', height: 81.0, width: 219.99, lockRatio: true },
    { size: '3XL', height: 83.5, width: 226.78, lockRatio: true }
  ];

  let jerseyExcelHeaders = ['Nama', 'Nomor', 'Ukuran', 'Sponsor', 'Tim'];
  let jerseyMappings = [
    { id: 1, column: 'Nama', placeholder: '[NAMA]', align: 'center', textCase: 'upper', maxWidth: 27.0, lockRatio: true },
    { id: 2, column: 'Nomor', placeholder: '[NOMOR]', align: 'center', textCase: 'none', maxWidth: 16.0, lockRatio: true },
    { id: 3, column: 'Ukuran', placeholder: '[UKURAN]', align: 'center', textCase: 'upper', maxWidth: 10.0, lockRatio: true },
    { id: 4, column: 'Sponsor', placeholder: '[SPONSOR]', align: 'center', textCase: 'upper', maxWidth: 22.0, lockRatio: true }
  ];

  let jerseyPlayers = [
    { Nama: 'ALEXANDER', Nomor: '10', Ukuran: 'L', Sponsor: 'GFX ESPORTS', name: 'ALEXANDER', number: '10', size: 'L' },
    { Nama: 'CHRISTIAN', Nomor: '07', Ukuran: 'M', Sponsor: 'GFX ESPORTS', name: 'CHRISTIAN', number: '07', size: 'M' },
    { Nama: 'DAVID PRATAMA', Nomor: '09', Ukuran: 'XL', Sponsor: 'GFX ESPORTS', name: 'DAVID PRATAMA', number: '09', size: 'XL' },
    { Nama: 'FERNANDO', Nomor: '11', Ukuran: 'L', Sponsor: 'GFX ESPORTS', name: 'FERNANDO', number: '11', size: 'L' }
  ];

  let jerseyManualVars = [
    { placeholder: '[NAMA]', label: 'Nama Pemain', text: 'ALEXANDER\nCHRISTIAN\nDAVID PRATAMA\nFERNANDO' },
    { placeholder: '[NOMOR]', label: 'Nomor Punggung', text: '10\n07\n09\n11' },
    { placeholder: '[UKURAN]', label: 'Ukuran (Size)', text: 'L\nM\nXL\nL' },
    { placeholder: '[SPONSOR]', label: 'Sponsor Depan', text: 'GFX ESPORTS\nGFX ESPORTS\nGFX ESPORTS\nGFX ESPORTS' }
  ];

  // Tab Switching
  if (btnTabJerseyExcel && btnTabJerseyManual) {
    btnTabJerseyExcel.addEventListener('click', () => {
      activeJerseyMode = 'excel';
      btnTabJerseyExcel.classList.add('active');
      btnTabJerseyManual.classList.remove('active');
      if (jerseyExcelSection) jerseyExcelSection.style.display = 'flex';
      if (jerseyManualSection) jerseyManualSection.style.display = 'none';
    });

    btnTabJerseyManual.addEventListener('click', () => {
      activeJerseyMode = 'manual';
      btnTabJerseyManual.classList.add('active');
      btnTabJerseyExcel.classList.remove('active');
      if (jerseyExcelSection) jerseyExcelSection.style.display = 'none';
      if (jerseyManualSection) jerseyManualSection.style.display = 'flex';
      renderJerseyManualCards();
      renderJerseyManualPreview();
    });
  }

  // Render Size Chart Table
  function renderJerseySizeChart() {
    if (!tbodyJerseySizeChart) return;
    tbodyJerseySizeChart.innerHTML = '';

    jerseySizeChart.forEach((sc, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight: 800; color: var(--accent-blue);">${sc.size}</td>
        <td>
          <input type="number" class="input-text sc-h" data-idx="${idx}" value="${sc.height}" step="0.5" style="width: 60px; height: 22px; text-align: right; font-weight: 700;" />
        </td>
        <td>
          <input type="number" class="input-text sc-w" data-idx="${idx}" value="${sc.width}" step="0.5" style="width: 65px; height: 22px; text-align: right; font-weight: 700;" />
        </td>
        <td>
          <button type="button" class="btn-secondary sc-lock" data-idx="${idx}" style="height: 22px; font-size: 9.5px; padding: 0 4px; ${sc.lockRatio ? 'color: #059669; font-weight: 700;' : 'color: var(--text-dim);'}">
            ${sc.lockRatio ? '🔒 Terkunci' : '🔓 Bebas'}
          </button>
        </td>
        <td>
          <button type="button" class="btn-danger sc-del" data-idx="${idx}" style="height: 20px; font-size: 9px; padding: 0 4px;">✕</button>
        </td>
      `;

      const inpH = tr.querySelector('.sc-h');
      const inpW = tr.querySelector('.sc-w');
      const btnLock = tr.querySelector('.sc-lock');
      const btnDel = tr.querySelector('.sc-del');

      inpH.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value) || 0;
        sc.height = val;
        if (sc.lockRatio && jerseyMasterRatio > 0) {
          sc.width = parseFloat((val * jerseyMasterRatio).toFixed(2));
          inpW.value = sc.width;
        }
      });

      inpW.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value) || 0;
        sc.width = val;
        if (sc.lockRatio && jerseyMasterRatio > 0) {
          sc.height = parseFloat((val / jerseyMasterRatio).toFixed(2));
          inpH.value = sc.height;
        }
      });

      btnLock.addEventListener('click', () => {
        sc.lockRatio = !sc.lockRatio;
        renderJerseySizeChart();
      });

      btnDel.addEventListener('click', () => {
        if (jerseySizeChart.length <= 1) {
          alert('Minimal harus ada 1 ukuran pada size chart.');
          return;
        }
        jerseySizeChart.splice(idx, 1);
        renderJerseySizeChart();
      });

      tbodyJerseySizeChart.appendChild(tr);
    });
  }

  if (btnJerseyAddSizeRow) {
    btnJerseyAddSizeRow.addEventListener('click', () => {
      const szName = prompt('Masukkan nama ukuran baru (contoh: 4XL atau ANAK-10):', '4XL');
      if (!szName) return;
      const cleanSz = szName.trim().toUpperCase();
      if (jerseySizeChart.some(s => s.size === cleanSz)) {
        alert('Ukuran ini sudah ada di tabel.');
        return;
      }
      const lastH = jerseySizeChart[jerseySizeChart.length - 1]?.height || 76;
      const newH = lastH + 2.5;
      const newW = parseFloat((newH * jerseyMasterRatio).toFixed(2));
      jerseySizeChart.push({ size: cleanSz, height: newH, width: newW, lockRatio: true });
      renderJerseySizeChart();
    });
  }

  if (btnJerseyResetSizeChart) {
    btnJerseyResetSizeChart.addEventListener('click', () => {
      jerseySizeChart = [
        { size: 'XS', height: 68.5, width: 186.05, lockRatio: true },
        { size: 'S', height: 71.0, width: 192.84, lockRatio: true },
        { size: 'M', height: 73.5, width: 199.63, lockRatio: true },
        { size: 'L', height: 76.0, width: 206.41, lockRatio: true },
        { size: 'XL', height: 78.5, width: 213.20, lockRatio: true },
        { size: 'XXL', height: 81.0, width: 219.99, lockRatio: true },
        { size: '3XL', height: 83.5, width: 226.78, lockRatio: true }
      ];
      renderJerseySizeChart();
      showToast('Tabel ukuran direset ke standar sublimasi.', true);
    });
  }

  // Sample Master Pattern from CorelDRAW Selection
  if (btnJerseySampleMaster) {
    btnJerseySampleMaster.addEventListener('click', async () => {
      try {
        btnJerseySampleMaster.disabled = true;
        btnJerseySampleMaster.innerText = '⌛ Membaca Corel...';
        const api = window.electronAPI || window.corelAPI;
        if (!api?.corelGetSelectionInfo) {
          alert('Fitur membaca seleksi CorelDRAW hanya aktif di aplikasi desktop.');
          return;
        }
        const sel = await api.corelGetSelectionInfo();
        if (sel && sel.success && sel.count > 0 && sel.widthCm > 0 && sel.heightCm > 0) {
          jerseyMasterWidthCm = parseFloat(sel.widthCm);
          jerseyMasterHeightCm = parseFloat(sel.heightCm);
          jerseyMasterRatio = jerseyMasterWidthCm / jerseyMasterHeightCm;

          if (lblJerseyMasterW) lblJerseyMasterW.innerText = jerseyMasterWidthCm.toFixed(2);
          if (lblJerseyMasterH) lblJerseyMasterH.innerText = jerseyMasterHeightCm.toFixed(2);
          if (lblJerseyMasterRatio) lblJerseyMasterRatio.innerText = jerseyMasterRatio.toFixed(3);

          jerseySizeChart.forEach(sc => {
            if (sc.lockRatio && sc.height > 0) {
              sc.width = parseFloat((sc.height * jerseyMasterRatio).toFixed(2));
            }
          });
          renderJerseySizeChart();
          showToast(`Ukuran master terdeteksi: ${jerseyMasterWidthCm.toFixed(2)} × ${jerseyMasterHeightCm.toFixed(2)} cm (Rasio: ${jerseyMasterRatio.toFixed(3)})`, true);
        } else {
          alert('Pilih 1 objek grup master pola jersey di CorelDRAW terlebih dahulu!');
        }
      } catch (err) {
        alert(`Error membaca CorelDRAW: ${err.message}`);
      } finally {
        btnJerseySampleMaster.disabled = false;
        btnJerseySampleMaster.innerText = '🎯 Baca Ukuran Pola dari Corel';
      }
    });
  }

  // Render Jersey Variable Mappings
  function renderJerseyMappings() {
    if (!jerseyMappingsContainer) return;
    jerseyMappingsContainer.innerHTML = '';

    jerseyMappings.forEach((m, idx) => {
      const card = document.createElement('div');
      card.style.cssText = 'background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 7px 9px; display: flex; flex-direction: column; gap: 5px;';

      let colOptions = '';
      jerseyExcelHeaders.forEach(h => {
        const isSel = (h.toLowerCase() === (m.column || '').toLowerCase());
        colOptions += `<option value="${h}" ${isSel ? 'selected' : ''}>${h}</option>`;
      });
      if (!jerseyExcelHeaders.some(h => h.toLowerCase() === (m.column || '').toLowerCase()) && m.column) {
        colOptions += `<option value="${m.column}" selected>${m.column}</option>`;
      }

      card.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 10.5px; font-weight: 700; color: var(--text-main);">
          <span>Variabel #${idx + 1} (${m.column})</span>
          ${jerseyMappings.length > 1 ? `<button type="button" class="btn-danger btn-del-jmap" data-id="${m.id}" style="height: 18px; font-size: 9px; padding: 0 4px;">✕</button>` : ''}
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label" style="font-size: 10px;">Kolom Excel:</label>
            <select class="select-native jmap-col" data-id="${m.id}" style="height: 22px; font-size: 10.5px;">
              ${colOptions}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" style="font-size: 10px;">Placeholder Corel:</label>
            <input type="text" class="input-text jmap-ph" data-id="${m.id}" value="${m.placeholder || ''}" placeholder="[NAMA]" style="height: 22px; font-size: 10.5px;" />
          </div>
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label" style="font-size: 10px;">Perataan (Align):</label>
            <select class="select-native jmap-align" data-id="${m.id}" style="height: 22px; font-size: 10.5px;">
              <option value="center" ${m.align === 'center' ? 'selected' : ''}>Tengah (Center)</option>
              <option value="left" ${m.align === 'left' ? 'selected' : ''}>Kiri (Left)</option>
              <option value="right" ${m.align === 'right' ? 'selected' : ''}>Kanan (Right)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" style="font-size: 10px;">Ubah Huruf (Case):</label>
            <select class="select-native jmap-case" data-id="${m.id}" style="height: 22px; font-size: 10.5px;">
              <option value="upper" ${m.textCase === 'upper' ? 'selected' : ''}>UPPERCASE (BESAR)</option>
              <option value="title" ${m.textCase === 'title' ? 'selected' : ''}>Title Case (Kapital Awal)</option>
              <option value="sentence" ${m.textCase === 'sentence' ? 'selected' : ''}>Sentence case (Awal)</option>
              <option value="lower" ${m.textCase === 'lower' ? 'selected' : ''}>lowercase (kecil)</option>
              <option value="none" ${m.textCase === 'none' ? 'selected' : ''}>Sesuai Excel (As-Is)</option>
            </select>
          </div>
        </div>
        <div class="form-grid-2" style="align-items: center;">
          <div class="form-group">
            <label class="form-label" style="font-size: 10px;">Maks Lebar (cm):</label>
            <input type="number" class="input-text jmap-maxw" data-id="${m.id}" value="${m.maxWidth || 27.0}" step="0.5" min="2" max="100" style="height: 22px; font-size: 10.5px;" />
          </div>
          <div class="form-group" style="padding-top: 14px;">
            <label class="checkbox-native-label" style="font-size: 10px;">
              <input type="checkbox" class="jmap-lock" data-id="${m.id}" ${m.lockRatio ? 'checked' : ''} />
              <span>Kunci Proporsi (Anti Gepeng)</span>
            </label>
          </div>
        </div>
      `;

      jerseyMappingsContainer.appendChild(card);
    });

    jerseyMappingsContainer.querySelectorAll('.jmap-col').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const id = parseInt(e.target.dataset.id, 10);
        const item = jerseyMappings.find(m => m.id === id);
        if (item) {
          item.column = e.target.value;
          if (!item.placeholder || item.placeholder.startsWith('[')) {
            item.placeholder = `[${e.target.value.toUpperCase()}]`;
          }
          renderJerseyMappings();
        }
      });
    });

    jerseyMappingsContainer.querySelectorAll('.jmap-ph').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const id = parseInt(e.target.dataset.id, 10);
        const item = jerseyMappings.find(m => m.id === id);
        if (item) item.placeholder = e.target.value;
      });
    });

    jerseyMappingsContainer.querySelectorAll('.jmap-align').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const id = parseInt(e.target.dataset.id, 10);
        const item = jerseyMappings.find(m => m.id === id);
        if (item) item.align = e.target.value;
      });
    });

    jerseyMappingsContainer.querySelectorAll('.jmap-case').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const id = parseInt(e.target.dataset.id, 10);
        const item = jerseyMappings.find(m => m.id === id);
        if (item) item.textCase = e.target.value;
      });
    });

    jerseyMappingsContainer.querySelectorAll('.jmap-maxw').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const id = parseInt(e.target.dataset.id, 10);
        const item = jerseyMappings.find(m => m.id === id);
        if (item) item.maxWidth = parseFloat(e.target.value) || 27.0;
      });
    });

    jerseyMappingsContainer.querySelectorAll('.jmap-lock').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const id = parseInt(e.target.dataset.id, 10);
        const item = jerseyMappings.find(m => m.id === id);
        if (item) item.lockRatio = e.target.checked;
      });
    });

    jerseyMappingsContainer.querySelectorAll('.btn-del-jmap').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = parseInt(e.target.dataset.id, 10);
        jerseyMappings = jerseyMappings.filter(m => m.id !== id);
        renderJerseyMappings();
      });
    });
  }

  if (btnJerseyAddMapping) {
    btnJerseyAddMapping.addEventListener('click', () => {
      const nextId = (jerseyMappings.reduce((max, m) => Math.max(max, m.id || 0), 0)) + 1;
      const usedCols = jerseyMappings.map(m => m.column.toLowerCase());
      let candidateCol = jerseyExcelHeaders.find(h => !usedCols.includes(h.toLowerCase()));
      if (!candidateCol) {
        if (!usedCols.includes('sponsor')) candidateCol = 'Sponsor';
        else if (!usedCols.includes('tim')) candidateCol = 'Tim';
        else candidateCol = `Variabel_${nextId}`;
      }

      jerseyMappings.push({
        id: nextId,
        column: candidateCol,
        placeholder: `[${candidateCol.toUpperCase()}]`,
        align: 'center',
        textCase: 'upper',
        maxWidth: 22.0,
        lockRatio: true
      });
      renderJerseyMappings();
    });
  }

  if (btnJerseyPreset) {
    btnJerseyPreset.addEventListener('click', () => {
      jerseyMappings = [
        { id: 1, column: 'Nama', placeholder: '[NAMA]', align: 'center', textCase: 'upper', maxWidth: 27.0, lockRatio: true },
        { id: 2, column: 'Nomor', placeholder: '[NOMOR]', align: 'center', textCase: 'none', maxWidth: 16.0, lockRatio: true },
        { id: 3, column: 'Ukuran', placeholder: '[UKURAN]', align: 'center', textCase: 'upper', maxWidth: 10.0, lockRatio: true },
        { id: 4, column: 'Sponsor', placeholder: '[SPONSOR]', align: 'center', textCase: 'upper', maxWidth: 22.0, lockRatio: true }
      ];
      renderJerseyMappings();
      showToast('Preset jersey berhasil diterapkan.', true);
    });
  }

  if (btnJerseyOpenChangeCase) {
    btnJerseyOpenChangeCase.addEventListener('click', () => {
      const m = document.getElementById('changeCaseModal');
      if (m) m.classList.add('show');
    });
  }

  // Render Player Table (Excel Mode)
  function renderJerseyPlayerTable() {
    if (!tbodyJerseyPlayers) return;
    tbodyJerseyPlayers.innerHTML = '';
    jerseyPlayers.forEach((p, idx) => {
      const tr = document.createElement('tr');
      const pName = p.Nama || p.name || 'PEMAIN';
      const pNum = p.Nomor || p.number || '00';
      const pSize = (p.Ukuran || p.size || 'L').toUpperCase();

      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td><input type="text" class="input-text p-name" value="${pName}" style="height: 22px; font-size: 11px;" /></td>
        <td><input type="text" class="input-text p-num" value="${pNum}" style="height: 22px; font-size: 11px;" /></td>
        <td>
          <select class="select-native p-size" style="height: 22px; font-size: 11px;">
            <option value="XS" ${pSize === 'XS' ? 'selected' : ''}>XS</option>
            <option value="S" ${pSize === 'S' ? 'selected' : ''}>S</option>
            <option value="M" ${pSize === 'M' ? 'selected' : ''}>M</option>
            <option value="L" ${pSize === 'L' ? 'selected' : ''}>L</option>
            <option value="XL" ${pSize === 'XL' ? 'selected' : ''}>XL</option>
            <option value="XXL" ${pSize === 'XXL' ? 'selected' : ''}>XXL</option>
            <option value="3XL" ${pSize === '3XL' ? 'selected' : ''}>3XL</option>
          </select>
        </td>
        <td><button type="button" class="btn-danger p-del" style="height: 20px; font-size: 9px; padding: 0 4px;">✕</button></td>
      `;

      tr.querySelector('.p-name').addEventListener('input', (e) => {
        p.name = e.target.value;
        p.Nama = e.target.value;
      });
      tr.querySelector('.p-num').addEventListener('input', (e) => {
        p.number = e.target.value;
        p.Nomor = e.target.value;
      });
      tr.querySelector('.p-size').addEventListener('change', (e) => {
        p.size = e.target.value;
        p.Ukuran = e.target.value;
      });
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
      const idx = jerseyPlayers.length + 1;
      jerseyPlayers.push({ Nama: `PEMAIN ${idx}`, Nomor: `${idx}`, Ukuran: 'L', Sponsor: 'GFX ESPORTS', name: `PEMAIN ${idx}`, number: `${idx}`, size: 'L' });
      renderJerseyPlayerTable();
    });
  }

  if (btnJerseyClearPlayers) {
    btnJerseyClearPlayers.addEventListener('click', () => {
      jerseyPlayers = [];
      renderJerseyPlayerTable();
    });
  }

  // Excel Importer & Dropzone
  if (jerseyExcelDropzone && fileJerseyExcelInput) {
    jerseyExcelDropzone.addEventListener('click', () => fileJerseyExcelInput.click());
    jerseyExcelDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      jerseyExcelDropzone.style.borderColor = 'var(--accent-blue)';
    });
    jerseyExcelDropzone.addEventListener('dragleave', () => {
      jerseyExcelDropzone.style.borderColor = 'var(--border-color)';
    });
    jerseyExcelDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      jerseyExcelDropzone.style.borderColor = 'var(--border-color)';
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleJerseyExcelFile(e.dataTransfer.files[0]);
      }
    });

    fileJerseyExcelInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleJerseyExcelFile(e.target.files[0]);
      }
    });
  }

  if (btnJerseyImportExcel) {
    btnJerseyImportExcel.addEventListener('click', async () => {
      if (window.corelAPI?.selectExcelFile) {
        const res = await window.corelAPI.selectExcelFile();
        if (res.success && res.filePath) {
          await loadJerseyExcelPath(res.filePath);
        }
      } else if (fileJerseyExcelInput) {
        fileJerseyExcelInput.click();
      }
    });
  }

  if (btnJerseyChangeFile && fileJerseyExcelInput) {
    btnJerseyChangeFile.addEventListener('click', () => fileJerseyExcelInput.click());
  }

  async function handleJerseyExcelFile(file) {
    if (!file) return;
    if (file.path) {
      await loadJerseyExcelPath(file.path);
    } else {
      showToast(`Memuat ${file.name}...`, true);
    }
  }

  async function loadJerseyExcelPath(filePath) {
    if (!window.corelAPI?.parseExcelFile) return;
    try {
      const parsed = await window.corelAPI.parseExcelFile(filePath);
      if (parsed.success) {
        rawJerseyExcelData = parsed;
        if (boxJerseyFileInfo) boxJerseyFileInfo.style.display = 'flex';
        if (lblJerseyFileName) lblJerseyFileName.innerText = pathBasename(filePath);

        // Populate sheets
        if (selJerseySheet && parsed.sheets && parsed.sheets.length > 0) {
          selJerseySheet.innerHTML = parsed.sheets.map(s => `<option value="${s}">${s}</option>`).join('');
        }

        // Populate Header Row options (Baris 1 .. 10)
        if (selJerseyHeaderRow) {
          let opts = '';
          for (let r = 1; r <= 10; r++) {
            opts += `<option value="${r}">Baris ${r}</option>`;
          }
          selJerseyHeaderRow.innerHTML = opts;
          selJerseyHeaderRow.value = '1';
        }

        processJerseySheetData();
        showToast('File Excel berhasil dimuat!', true);
      } else {
        alert(`Gagal membaca Excel: ${parsed.message}`);
      }
    } catch (err) {
      alert(`Error membaca file Excel: ${err.message}`);
    }
  }

  function pathBasename(p) {
    if (!p) return 'data.xlsx';
    const parts = p.split(/[\\/]/);
    return parts[parts.length - 1];
  }

  function processJerseySheetData() {
    if (!rawJerseyExcelData || !rawJerseyExcelData.rows) return;
    const headerRowIdx = parseInt(selJerseyHeaderRow?.value || '1', 10);
    const rows = rawJerseyExcelData.rows;

    const headerSet = new Set();
    rows.forEach(r => {
      Object.keys(r).forEach(k => {
        if (k && !k.startsWith('__EMPTY')) headerSet.add(k);
      });
    });

    if (headerSet.size > 0) {
      jerseyExcelHeaders = Array.from(headerSet);
    }

    jerseyPlayers = rows.slice(headerRowIdx - 1).map(r => {
      const name = String(r.Nama || r.nama || r.Name || r.name || r.A || 'PEMAIN').trim();
      const num = String(r.Nomor || r.nomor || r.No || r.no || r.B || '-').trim();
      const sz = String(r.Ukuran || r.ukuran || r.Size || r.size || r.C || 'L').trim().toUpperCase();
      const sp = String(r.Sponsor || r.sponsor || r.D || 'GFX ESPORTS').trim();
      return {
        ...r,
        Nama: name,
        Nomor: num,
        Ukuran: sz,
        Sponsor: sp,
        name: name,
        number: num,
        size: sz
      };
    }).filter(p => p.Nama && p.Nama !== 'PEMAIN');

    if (lblJerseyRowCount) lblJerseyRowCount.innerText = `(${jerseyPlayers.length} Baris Data)`;
    if (boxJerseyTablePreview) boxJerseyTablePreview.style.display = 'flex';
    if (lblJerseyColCount) lblJerseyColCount.innerText = `${jerseyExcelHeaders.length} Kolom Terdeteksi`;

    renderJerseyExcelPreviewTable(rows.slice(headerRowIdx - 1, headerRowIdx + 4));
    renderJerseyMappings();
    renderJerseyPlayerTable();
  }

  if (selJerseySheet) {
    selJerseySheet.addEventListener('change', () => processJerseySheetData());
  }
  if (selJerseyHeaderRow) {
    selJerseyHeaderRow.addEventListener('change', () => processJerseySheetData());
  }

  function renderJerseyExcelPreviewTable(previewRows) {
    if (!tblJerseyExcelHead || !tblJerseyExcelBody) return;
    tblJerseyExcelHead.innerHTML = '';
    tblJerseyExcelBody.innerHTML = '';
    if (!previewRows || previewRows.length === 0) return;

    const cols = jerseyExcelHeaders.slice(0, 6);
    const trHead = document.createElement('tr');
    trHead.innerHTML = `<th style="width: 30px;">#</th>` + cols.map(c => `<th>${c}</th>`).join('');
    tblJerseyExcelHead.appendChild(trHead);

    previewRows.forEach((r, idx) => {
      const tr = document.createElement('tr');
      let tdHtml = `<td>${idx + 1}</td>`;
      cols.forEach(c => {
        tdHtml += `<td>${r[c] !== undefined ? String(r[c]) : ''}</td>`;
      });
      tr.innerHTML = tdHtml;
      tblJerseyExcelBody.appendChild(tr);
    });
  }

  // ==========================================
  // Manual Mode Logic
  // ==========================================
  function renderJerseyManualCards() {
    if (!jerseyManualCardsContainer) return;
    jerseyManualCardsContainer.innerHTML = '';

    jerseyManualVars.forEach((v, index) => {
      const card = document.createElement('div');
      card.style.cssText = 'background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 8px; display: flex; flex-direction: column; gap: 6px;';

      const lines = (v.text || '').split(/\r?\n/).map(l => l.trim()).filter(l => l !== '');

      card.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
          <div style="display: flex; align-items: center; gap: 6px; flex: 1;">
            <span style="font-weight: 800; color: var(--accent-blue); font-size: 11px;">#${index + 1}</span>
            <input type="text" class="input-text m-ph" value="${v.placeholder}" style="width: 90px; height: 22px; font-weight: 800; color: var(--accent-blue);" placeholder="[NAMA]" />
            <input type="text" class="input-text m-lbl" value="${v.label}" style="flex: 1; height: 22px; font-weight: 600;" placeholder="Label Variabel" />
          </div>
          <div style="display: flex; align-items: center; gap: 4px;">
            <span class="m-lines-badge" style="font-size: 10px; font-weight: 700; color: #059669; background: rgba(5,150,105,0.1); padding: 1px 6px; border-radius: 3px; border: 1px solid #059669;">${lines.length} baris</span>
            ${jerseyManualVars.length > 1 ? `<button type="button" class="btn-danger m-del" style="height: 20px; font-size: 9px; padding: 0 4px;">✕</button>` : ''}
          </div>
        </div>
        <textarea class="m-ta" style="width: 100%; height: 60px; font-family: monospace; font-size: 11px; padding: 5px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); background: var(--bg-app); color: var(--text-main); resize: vertical;" placeholder="Paste atau ketik daftar baris di sini...">${v.text}</textarea>
      `;

      const inPh = card.querySelector('.m-ph');
      const inLbl = card.querySelector('.m-lbl');
      const inTa = card.querySelector('.m-ta');
      const badge = card.querySelector('.m-lines-badge');
      const btnDel = card.querySelector('.m-del');

      inPh.addEventListener('input', () => {
        v.placeholder = inPh.value.trim();
        renderJerseyManualPreview();
      });
      inLbl.addEventListener('input', () => {
        v.label = inLbl.value.trim();
        renderJerseyManualPreview();
      });
      inTa.addEventListener('input', () => {
        v.text = inTa.value;
        const cLines = v.text.split(/\r?\n/).map(l => l.trim()).filter(l => l !== '');
        badge.innerText = `${cLines.length} baris`;
        renderJerseyManualPreview();
      });
      if (btnDel) {
        btnDel.addEventListener('click', () => {
          jerseyManualVars.splice(index, 1);
          renderJerseyManualCards();
          renderJerseyManualPreview();
        });
      }

      jerseyManualCardsContainer.appendChild(card);
    });
  }

  function renderJerseyManualPreview() {
    if (!tblJerseyManualHead || !tblJerseyManualBody) return;
    const varLines = jerseyManualVars.map(v => {
      const arr = (v.text || '').split(/\r?\n/).map(l => l.trim());
      while (arr.length > 0 && arr[arr.length - 1] === '') arr.pop();
      return arr;
    });

    const maxLines = Math.max(...varLines.map(arr => arr.length), 0);
    if (lblJerseyManualRowCount) lblJerseyManualRowCount.innerText = `(${maxLines} Pola Jersey)`;

    tblJerseyManualHead.innerHTML = '';
    tblJerseyManualBody.innerHTML = '';

    const trHead = document.createElement('tr');
    trHead.innerHTML = `<th style="width: 35px;">No</th>` + jerseyManualVars.map(v => `<th>${v.label || v.placeholder}</th>`).join('');
    tblJerseyManualHead.appendChild(trHead);

    const previewLimit = Math.min(maxLines, 8);
    for (let i = 0; i < previewLimit; i++) {
      const tr = document.createElement('tr');
      let tdHtml = `<td>${i + 1}</td>`;
      jerseyManualVars.forEach((v, vIdx) => {
        const val = varLines[vIdx][i] || '';
        tdHtml += `<td>${val}</td>`;
      });
      tr.innerHTML = tdHtml;
      tblJerseyManualBody.appendChild(tr);
    }
  }

  if (btnJerseyManualAddVar) {
    btnJerseyManualAddVar.addEventListener('click', () => {
      const idx = jerseyManualVars.length + 1;
      jerseyManualVars.push({
        placeholder: `[VARIABEL_${idx}]`,
        label: `Variabel ${idx}`,
        text: ''
      });
      renderJerseyManualCards();
      renderJerseyManualPreview();
    });
  }

  if (btnJerseyManualPreset) {
    btnJerseyManualPreset.addEventListener('click', () => {
      jerseyManualVars = [
        { placeholder: '[NAMA]', label: 'Nama Pemain', text: 'ALEXANDER\nCHRISTIAN\nDAVID PRATAMA\nFERNANDO' },
        { placeholder: '[NOMOR]', label: 'Nomor Punggung', text: '10\n07\n09\n11' },
        { placeholder: '[UKURAN]', label: 'Ukuran (Size)', text: 'L\nM\nXL\nL' },
        { placeholder: '[SPONSOR]', label: 'Sponsor Depan', text: 'GFX ESPORTS\nGFX ESPORTS\nGFX ESPORTS\nGFX ESPORTS' }
      ];
      renderJerseyManualCards();
      renderJerseyManualPreview();
      showToast('Preset jersey manual berhasil dimuat.', true);
    });
  }

  // Execution: Tata Pola di CorelDRAW
  if (btnExecuteJerseyLayout) {
    btnExecuteJerseyLayout.addEventListener('click', async () => {
      let finalPlayers = [];
      let finalMappings = [];

      if (activeJerseyMode === 'manual') {
        const varLines = jerseyManualVars.map(v => {
          const arr = (v.text || '').split(/\r?\n/).map(l => l.trim());
          while (arr.length > 0 && arr[arr.length - 1] === '') arr.pop();
          return arr;
        });
        const totalRows = Math.max(...varLines.map(arr => arr.length), 0);
        if (totalRows === 0) {
          alert('Data teks manual masih kosong. Silakan paste nama/nomor pemain terlebih dahulu.');
          return;
        }

        finalMappings = jerseyManualVars.map((v, vIdx) => {
          const colKey = `Col_${vIdx + 1}`;
          return {
            id: vIdx + 1,
            column: colKey,
            placeholder: v.placeholder,
            align: 'center',
            textCase: 'none',
            maxWidth: 27.0,
            lockRatio: true
          };
        });

        for (let r = 0; r < totalRows; r++) {
          const rowObj = {};
          jerseyManualVars.forEach((v, vIdx) => {
            const val = varLines[vIdx][r] || '';
            rowObj[`Col_${vIdx + 1}`] = val;
            const phLow = v.placeholder.toLowerCase();
            if (phLow.includes('nama') || phLow.includes('name')) rowObj.Nama = val;
            if (phLow.includes('nomor') || phLow.includes('number') || phLow.includes('no')) rowObj.Nomor = val;
            if (phLow.includes('ukuran') || phLow.includes('size')) rowObj.Ukuran = val;
          });
          finalPlayers.push(rowObj);
        }
      } else {
        if (jerseyPlayers.length === 0) {
          alert('Daftar pemain masih kosong. Silakan tambah pemain atau impor Excel.');
          return;
        }
        finalPlayers = jerseyPlayers;
        finalMappings = jerseyMappings;
      }

      const targetSize = document.getElementById('selJerseyTargetSize')?.value || 'ALL';
      const spacingCm = parseFloat(document.getElementById('numJerseySpacing')?.value) || 1.0;
      const limitCopy = parseInt(document.getElementById('numJerseyLimit')?.value, 10) || 4;
      const direction = document.getElementById('selJerseyDirection')?.value || 'vertical';
      const groupBySize = document.getElementById('selJerseyGrouping')?.value === 'group_size';
      const enableAutoResize = !!chkJerseyEnableAutoResize?.checked;
      const masterSize = selJerseyMasterSize?.value || 'L';
      const autoCurves = !!document.getElementById('chkJerseyAutoCurves')?.checked;

      // Build sizeChart object
      const sizeChartObj = {};
      jerseySizeChart.forEach(sc => {
        sizeChartObj[sc.size] = {
          height: sc.height,
          width: sc.width,
          lockRatio: sc.lockRatio
        };
      });

      btnExecuteJerseyLayout.disabled = true;
      btnExecuteJerseyLayout.innerText = 'Menata di CorelDRAW...';

      try {
        if (window.corelAPI?.executeLayout) {
          const res = await window.corelAPI.executeLayout({
            targetSize,
            players: finalPlayers,
            mappings: finalMappings,
            sizeChart: sizeChartObj,
            enableAutoResize,
            masterSize,
            spacingCm,
            limitCopy,
            direction,
            groupBySize,
            autoCurves
          });

          if (res.success) {
            showToast(`Sukses: ${res.message || 'Pola jersey selesai ditata!'}`, true);
            alert(`🎉 Sukses!\n\n${res.message}`);
          } else {
            const errMsg = res.message || 'Terjadi kesalahan.';
            if (errMsg.includes('ghost') || errMsg.includes('tidak sedang berjalan') || errMsg.includes('belum merespon')) {
              const doLaunch = confirm(`${errMsg}\n\nApakah Anda ingin membuka aplikasi CorelDRAW sekarang?`);
              if (doLaunch && window.corelAPI?.launchCorelApp) {
                const lRes = await window.corelAPI.launchCorelApp();
                showToast(lRes?.message || 'Membuka CorelDRAW...', true);
              }
            } else {
              alert(`Gagal menata jersey:\n\n${errMsg}`);
            }
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

  // Open Floating Companion Window
  if (btnJerseyOpenCompanion) {
    btnJerseyOpenCompanion.addEventListener('click', () => {
      if (window.corelAPI?.corelOpenCompanionTool) {
        const sizeChartObj = {};
        jerseySizeChart.forEach(sc => {
          sizeChartObj[sc.size] = { height: sc.height, width: sc.width, lockRatio: sc.lockRatio };
        });

        window.corelAPI.corelOpenCompanionTool({
          teamName: document.getElementById('txtJerseyTeamName')?.value || 'GFX ESPORTS',
          players: jerseyPlayers,
          mappings: jerseyMappings,
          sizeChart: sizeChartObj,
          enableAutoResize: !!chkJerseyEnableAutoResize?.checked,
          masterSize: selJerseyMasterSize?.value || 'L'
        });
      }
    });
  }

  renderJerseySizeChart();
  renderJerseyMappings();
  renderJerseyPlayerTable();

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
  document.getElementById('btnLaunchNumeratorFromView')?.addEventListener('click', () => {
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
  // Change Case Dialog & Utilities (Native CorelDRAW Feature)
  // ==========================================
  function applyClientTextCase(text, caseType) {
    if (!text) return '';
    switch (caseType) {
      case 'upper':
        return text.toUpperCase();
      case 'lower':
        return text.toLowerCase();
      case 'title':
        return text.toLowerCase().replace(/(^|\s|\-|\/)([a-z])/g, (_, b, c) => b + c.toUpperCase());
      case 'sentence':
        return text.toLowerCase().replace(/(^\s*|[.!?]\s*)([a-z])/g, (_, b, c) => b + c.toUpperCase());
      case 'toggle':
        return text.split('').map(c => c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()).join('');
      default:
        return text;
    }
  }

  const mainChangeCaseModal = document.getElementById('mainChangeCaseModal');
  const btnMainOpenChangeCaseExcel = document.getElementById('btnMainOpenChangeCaseExcel');
  const btnMainOpenChangeCaseManual = document.getElementById('btnMainOpenChangeCaseManual');
  const btnUtilChangeCase = document.getElementById('btnUtilChangeCase');
  const btnMainCloseChangeCaseModal = document.getElementById('btnMainCloseChangeCaseModal');
  const btnMainCancelChangeCase = document.getElementById('btnMainCancelChangeCase');
  const btnMainOkChangeCase = document.getElementById('btnMainOkChangeCase');
  const btnMainHelpChangeCase = document.getElementById('btnMainHelpChangeCase');

  function openMainChangeCaseModal() {
    if (mainChangeCaseModal) mainChangeCaseModal.classList.add('active');
  }

  function closeMainChangeCaseModal() {
    if (mainChangeCaseModal) mainChangeCaseModal.classList.remove('active');
  }

  [btnMainOpenChangeCaseExcel, btnMainOpenChangeCaseManual, btnUtilChangeCase].forEach(btn => {
    if (btn) btn.addEventListener('click', openMainChangeCaseModal);
  });

  [btnMainCloseChangeCaseModal, btnMainCancelChangeCase].forEach(btn => {
    if (btn) btn.addEventListener('click', closeMainChangeCaseModal);
  });

  if (mainChangeCaseModal) {
    mainChangeCaseModal.addEventListener('click', (e) => {
      if (e.target === mainChangeCaseModal) closeMainChangeCaseModal();
    });
  }

  if (btnMainHelpChangeCase) {
    btnMainHelpChangeCase.addEventListener('click', () => {
      alert(
        'Bantuan Format Huruf (Change Case):\n\n' +
        '• Sentence case: Huruf kapital hanya pada awal kalimat/kata pertama.\n' +
        '• lowercase: Semua huruf menjadi kecil (contoh: ahmad dahlan).\n' +
        '• UPPERCASE: Semua huruf menjadi BESAR/KAPITAL (contoh: AHMAD DAHLAN).\n' +
        '• Title Case: Huruf kapital pada setiap awal kata (contoh: Ahmad Dahlan, S.Pd).\n' +
        '• tOGGLE cASE: Membalik kapitalisasi huruf besar ↔ kecil.\n\n' +
        'Target:\n' +
        '- Seleksi CorelDRAW: Mengubah teks yang sedang dipilih di lembar kerja CorelDRAW.\n' +
        '- Semua Variabel Merger: Mengubah format semua variabel A1, A2, A3 sekaligus.'
      );
    });
  }

  if (btnMainOkChangeCase) {
    btnMainOkChangeCase.addEventListener('click', async () => {
      const radCase = document.querySelector('input[name="radMainChangeCase"]:checked')?.value || 'title';
      const radTarget = document.querySelector('input[name="radMainCaseTarget"]:checked')?.value || 'corel_selection';

      closeMainChangeCaseModal();

      if (radTarget === 'corel_selection') {
        const fn = window.corelAPI?.changeCase || window.electronAPI?.changeCase;
        if (!fn) {
          alert('Fitur CorelDRAW hanya aktif di aplikasi desktop.');
          return;
        }
        try {
          btnMainOkChangeCase.disabled = true;
          showToast(`Mengubah huruf objek terpilih (${radCase})...`);
          const res = await fn(radCase);
          if (res && res.success) {
            showToast(`Sukses ubah kapitalisasi di CorelDRAW!`);
            alert(`🎉 Sukses!\n\n${res.message}`);
          } else {
            alert(`Gagal mengubah teks di CorelDRAW:\n\n${res?.message || 'Pastikan ada objek teks yang dipilih di CorelDRAW.'}`);
          }
        } catch (err) {
          alert(`Error: ${err.message}`);
        } finally {
          btnMainOkChangeCase.disabled = false;
        }
      } else {
        // Apply to all variables
        excelMappings.forEach(m => {
          m.textCase = radCase;
        });
        manualVariables.forEach(v => {
          v.textCase = radCase;
          v.text = applyClientTextCase(v.text, radCase);
        });
        renderMergerMappingList();
        renderManualCards();
        updateMergerPreview();
        showToast(`Format huruf semua variabel diset ke: ${radCase.toUpperCase()}`);
      }
    });
  }

  // ==========================================
  // 12. Keyboard Shortcuts (Native Desktop)
  // ==========================================
  window.addEventListener('keydown', (e) => {
    // Esc: close Change Case modal if open, else return to Beranda
    if (e.key === 'Escape') {
      if (mainChangeCaseModal && mainChangeCaseModal.classList.contains('active')) {
        closeMainChangeCaseModal();
        e.preventDefault();
        return;
      }
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
