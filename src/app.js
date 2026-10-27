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
  const lblAppVersionAbout = document.getElementById('lblAppVersionAbout');

  // Dynamic App Version Initialization
  const fetchVersionFn = window.electronAPI?.getAppVersion || window.corelAPI?.getAppVersion;
  if (typeof fetchVersionFn === 'function') {
    fetchVersionFn()
      .then((ver) => {
        if (ver && lblAppVersionAbout) {
          lblAppVersionAbout.textContent = `Versi ${ver}`;
        }
      })
      .catch((err) => {
        console.warn('[App] Failed to load app version:', err);
      });
  }

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
  // License Management & Activation Controller
  // ==========================================
  let currentLicenseState = null;
  const btnTitlebarLicenseBadge = document.getElementById('btnTitlebarLicenseBadge');
  const lblTitlebarLicText = document.getElementById('lblTitlebarLicText');
  const modalLicenseActivation = document.getElementById('modalLicenseActivation');
  const btnLicModalClose = document.getElementById('btnLicModalClose');
  const boxLicStatusBanner = document.getElementById('boxLicStatusBanner');
  const iconLicStatus = document.getElementById('iconLicStatus');
  const lblLicStatusTitle = document.getElementById('lblLicStatusTitle');
  const lblLicStatusDesc = document.getElementById('lblLicStatusDesc');
  const badgeLicDialogType = document.getElementById('badgeLicDialogType');
  const txtLicHwid = document.getElementById('txtLicHwid');
  const btnLicCopyHwid = document.getElementById('btnLicCopyHwid');
  const lblLicCopyText = document.getElementById('lblLicCopyText');
  const txtLicSerialKey = document.getElementById('txtLicSerialKey');
  const btnLicSubmitActivate = document.getElementById('btnLicSubmitActivate');
  const boxLicError = document.getElementById('boxLicError');
  const boxLicSuccess = document.getElementById('boxLicSuccess');
  const linkLicContactAdmin = document.getElementById('linkLicContactAdmin');

  async function checkLicenseStatus(autoOpenIfUnlicensed = false) {
    try {
      if (window.corelAPI?.licenseGetStatus) {
        const status = await window.corelAPI.licenseGetStatus();
        currentLicenseState = status;
        updateLicenseUI(status);

        if (autoOpenIfUnlicensed) {
          if (status.isBlocked || (!status.isLicensed && !status.isTrial)) {
            openLicenseModal();
          }
        }
      }
    } catch (err) {
      console.error('[License Check Error]', err);
    }
  }

  function updateLicenseUI(status) {
    if (!status) return;

    if (txtLicHwid && status.hwid) {
      txtLicHwid.value = status.hwid;
    }

    // Update Titlebar Badge
    if (btnTitlebarLicenseBadge && lblTitlebarLicText) {
      btnTitlebarLicenseBadge.className = 'titlebar-lic-pill';
      if (status.isBlocked) {
        btnTitlebarLicenseBadge.classList.add('lic-blocked');
        lblTitlebarLicText.innerText = 'DITANGGUHKAN';
      } else if (status.isLicensed) {
        btnTitlebarLicenseBadge.classList.add('lic-lifetime');
        lblTitlebarLicText.innerText = status.status === 'LIFETIME' ? 'LIFETIME' : 'AKTIF';
      } else if (status.isTrial) {
        btnTitlebarLicenseBadge.classList.add('lic-trial');
        lblTitlebarLicText.innerText = `TRIAL (${status.remainingDays || 0}H)`;
      } else {
        btnTitlebarLicenseBadge.classList.add('lic-unlicensed');
        lblTitlebarLicText.innerText = 'BELUM AKTIF';
      }
    }

    // Update Modal Banner
    if (boxLicStatusBanner && lblLicStatusTitle && lblLicStatusDesc && iconLicStatus) {
      boxLicStatusBanner.className = 'lic-alert-box';
      if (badgeLicDialogType) badgeLicDialogType.style.display = 'none';

      if (status.isBlocked) {
        boxLicStatusBanner.classList.add('lic-alert-blocked');
        iconLicStatus.innerText = '⛔';
        lblLicStatusTitle.innerText = 'Lisensi Ditangguhkan (Suspended)';
        lblLicStatusDesc.innerText = status.message || 'Lisensi untuk komputer ini telah dinonaktifkan oleh Administrator.';
      } else if (status.isLicensed) {
        boxLicStatusBanner.classList.add('lic-alert-lifetime');
        iconLicStatus.innerText = '✓';
        lblLicStatusTitle.innerText = status.customerName || 'Lisensi Permanen Aktif';
        lblLicStatusDesc.innerText = status.message || 'Lisensi software aktif seumur hidup (Beli Putus).';
        if (badgeLicDialogType) {
          badgeLicDialogType.innerText = status.status || 'LIFETIME';
          badgeLicDialogType.style.display = 'inline-block';
        }
      } else if (status.isTrial) {
        boxLicStatusBanner.classList.add('lic-alert-trial');
        iconLicStatus.innerText = '⏱️';
        lblLicStatusTitle.innerText = 'Masa Percobaan Resmi (Trial Mode)';
        lblLicStatusDesc.innerText = `Sisa waktu aktif: ${status.remainingDays || 0} Hari. Masukkan Serial Key Beli Putus untuk aktivasi permanen.`;
        if (badgeLicDialogType) {
          badgeLicDialogType.innerText = 'TRIAL';
          badgeLicDialogType.style.display = 'inline-block';
        }
      } else {
        boxLicStatusBanner.classList.add('lic-alert-unlicensed');
        iconLicStatus.innerText = '⚠️';
        lblLicStatusTitle.innerText = 'Aplikasi Belum Teraktivasi';
        lblLicStatusDesc.innerText = 'Silakan masukkan Serial Key resmi dari Admin untuk mengaktifkan seluruh fitur aplikasi.';
      }
    }
  }

  function openLicenseModal() {
    if (!modalLicenseActivation) return;
    if (boxLicError) boxLicError.style.display = 'none';
    if (boxLicSuccess) boxLicSuccess.style.display = 'none';
    if (txtLicSerialKey) txtLicSerialKey.value = '';
    modalLicenseActivation.style.display = 'flex';
    checkLicenseStatus(false);
  }

  function closeLicenseModal() {
    if (!modalLicenseActivation) return;
    modalLicenseActivation.style.display = 'none';
  }

  function requireActiveLicense() {
    if (currentLicenseState?.isBlocked) {
      alert(`⛔ AKSES DITOLAK: Komputer ini sedang dinonaktifkan (BLOCKED) oleh Administrator!\n\nAlasan: ${currentLicenseState.message || 'Penangguhan lisensi'}\n\nHubungi WhatsApp Support (0851-6359-4245).`);
      openLicenseModal();
      return false;
    }
    if (currentLicenseState && !currentLicenseState.isLicensed && !currentLicenseState.isTrial) {
      showToast('Aplikasi belum diaktivasi! Harap aktivasi lisensi resmi terlebih dahulu.', false);
      alert('Aplikasi belum diaktivasi!\n\nSilakan masukkan Serial Key lisensi resmi untuk menggunakan fitur ini.');
      openLicenseModal();
      return false;
    }
    return true;
  }

  if (btnTitlebarLicenseBadge) {
    btnTitlebarLicenseBadge.addEventListener('click', openLicenseModal);
  }
  if (btnLicModalClose) {
    btnLicModalClose.addEventListener('click', closeLicenseModal);
  }
  if (btnLicCopyHwid) {
    btnLicCopyHwid.addEventListener('click', () => {
      const hwidVal = txtLicHwid?.value || '';
      if (hwidVal) {
        navigator.clipboard.writeText(hwidVal);
        showToast('Hardware ID berhasil disalin ke clipboard!', true);
        if (lblLicCopyText) {
          lblLicCopyText.innerText = 'Disalin!';
          setTimeout(() => { if (lblLicCopyText) lblLicCopyText.innerText = 'Salin HWID'; }, 2000);
        }
      }
    });
  }
  if (btnLicSubmitActivate) {
    btnLicSubmitActivate.addEventListener('click', async () => {
      const keyVal = txtLicSerialKey?.value.trim();
      if (!keyVal) {
        if (boxLicError) {
          boxLicError.innerText = 'Harap masukkan Kode Lisensi / Serial Key dari Admin!';
          boxLicError.style.display = 'block';
        }
        return;
      }

      btnLicSubmitActivate.disabled = true;
      btnLicSubmitActivate.innerText = 'Memverifikasi...';
      if (boxLicError) boxLicError.style.display = 'none';
      if (boxLicSuccess) boxLicSuccess.style.display = 'none';

      try {
        if (window.corelAPI?.licenseActivate) {
          const res = await window.corelAPI.licenseActivate(keyVal);
          if (res.success) {
            if (boxLicSuccess) {
              boxLicSuccess.innerText = res.message || 'Lisensi berhasil diaktifkan!';
              boxLicSuccess.style.display = 'block';
            }
            showToast(res.message || 'Lisensi berhasil diaktifkan!', true);
            await checkLicenseStatus(false);
            setTimeout(() => {
              closeLicenseModal();
            }, 1800);
          } else {
            if (boxLicError) {
              boxLicError.innerText = res.message || 'Kode lisensi tidak valid!';
              boxLicError.style.display = 'block';
            }
            showToast(res.message || 'Gagal aktivasi!', false);
          }
        }
      } catch (err) {
        if (boxLicError) {
          boxLicError.innerText = `Error: ${err.message}`;
          boxLicError.style.display = 'block';
        }
      } finally {
        btnLicSubmitActivate.disabled = false;
        btnLicSubmitActivate.innerText = 'Aktivasi Lisensi Sekarang';
      }
    });
  }

  if (linkLicContactAdmin) {
    linkLicContactAdmin.addEventListener('click', (e) => {
      e.preventDefault();
      const hwidVal = txtLicHwid?.value || 'GFX-UNKNOWN';
      const text = encodeURIComponent(
        `Halo Admin / Support GFX, saya ingin membeli / aktivasi lisensi software Corel Tools Suite.\n\nBerikut Hardware ID komputer saya:\n💻 HWID: ${hwidVal}\n\nMohon info nomor rekening & total biayanya. Terima kasih!`
      );
      const waUrl = `https://wa.me/6285163594245?text=${text}`;
      if (window.corelAPI?.openExternalUrl) {
        window.corelAPI.openExternalUrl(waUrl);
      } else {
        window.open(waUrl, '_blank');
      }
    });
  }

  // ==========================================
  // Auto-Updater UI Controller (Restart to Update)
  // ==========================================
  const btnTitlebarUpdate = document.getElementById('btnTitlebarUpdate');
  const lblUpdateBtnText = document.getElementById('lblUpdateBtnText');

  if (window.electronAPI?.onUpdaterStatus || window.corelAPI?.onUpdaterStatus) {
    const listenFn = window.electronAPI?.onUpdaterStatus || window.corelAPI?.onUpdaterStatus;
    listenFn((data) => {
      if (!btnTitlebarUpdate) return;
      if (data.status === 'portable-available') {
        btnTitlebarUpdate.style.display = 'inline-flex';
        btnTitlebarUpdate.style.background = '#0284c7';
        if (lblUpdateBtnText) lblUpdateBtnText.innerHTML = `Update v${data.version} Tersedia &nearr;`;
        btnTitlebarUpdate.onclick = () => {
          const openUrlFn = window.electronAPI?.openExternalUrl || window.corelAPI?.openExternalUrl;
          if (openUrlFn) {
            openUrlFn('https://github.com/GFX-GRAPHIC/corel-tools-suite/releases/latest');
          } else {
            window.open('https://github.com/GFX-GRAPHIC/corel-tools-suite/releases/latest', '_blank');
          }
        };
      } else if (data.status === 'downloading') {
        btnTitlebarUpdate.style.display = 'inline-flex';
        btnTitlebarUpdate.style.background = '#0369a1';
        if (lblUpdateBtnText) lblUpdateBtnText.innerText = `Mengunduh Update: ${data.percent || 0}%`;
      } else if (data.status === 'downloaded') {
        btnTitlebarUpdate.style.display = 'inline-flex';
        btnTitlebarUpdate.style.background = '#059669';
        if (lblUpdateBtnText) lblUpdateBtnText.innerHTML = 'Restart to Update &rarr;';
        btnTitlebarUpdate.onclick = () => {
          const installFn = window.electronAPI?.updaterInstall || window.corelAPI?.updaterInstall;
          if (installFn) {
            installFn();
          }
        };
      }
    });
  }

  // Listen to remote kill switch signal
  if (window.corelAPI?.onLicenseBlocked) {
    window.corelAPI.onLicenseBlocked((data) => {
      currentLicenseState = {
        isLicensed: false,
        isTrial: false,
        isExpired: true,
        isBlocked: true,
        status: 'BLOCKED',
        message: data?.reason || 'Lisensi komputer ini telah dinonaktifkan oleh Administrator.'
      };
      updateLicenseUI(currentLicenseState);
      openLicenseModal();
      alert(`⛔ LISENSI DITANGGUHKAN: ${data?.reason || 'Lisensi komputer ini telah dinonaktifkan oleh Administrator.'}`);
    });
  }

  // Initial check on startup (auto opens modal if unlicensed)
  checkLicenseStatus(true);

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
    if (viewName === 'panduan' && typeof loadTutorialLinksCloud === 'function') {
      loadTutorialLinksCloud();
    }
  }

  // Sidebar clicks
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const view = item.getAttribute('data-view');
      if (view === 'license') {
        openLicenseModal();
        return;
      }
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
  let isUpdatingStatus = false;
  async function updateCorelStatus() {
    if (document.hidden || isUpdatingStatus) return;
    isUpdatingStatus = true;
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
          if (res.versionMajor && selTargetCorelVersion) {
            selTargetCorelVersion.value = String(res.versionMajor);
          }
        } else {
          if (corelDotStatus) corelDotStatus.className = 'status-dot-indicator';
          if (footerCorelDot) footerCorelDot.className = 'status-dot-indicator';
          if (lblCorelConnected) lblCorelConnected.innerText = 'CorelDRAW belum dibuka';
          if (footerCorelStatus) footerCorelStatus.innerText = 'CorelDRAW: Belum Terbuka';
          if (lblActiveDocName) lblActiveDocName.innerText = 'Buka CorelDRAW untuk menggunakan tools';
          if (footerDocInfo) footerDocInfo.innerText = 'Dokumen: -';
        }
        renderMultiCorelInstances(res);
        refreshTargetCorelDropdown();
      }
    } catch {}
    finally {
      isUpdatingStatus = false;
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      updateCorelStatus();
    }
  });

  const selTargetCorelVersion = document.getElementById('selTargetCorelVersion');
  const btnGlobalCancelTask = document.getElementById('btnGlobalCancelTask');

  function setTaskRunning(isRunning, label = '') {
    if (btnGlobalCancelTask) {
      btnGlobalCancelTask.style.display = isRunning ? 'inline-flex' : 'none';
    }
    if (footerActionStatus) {
      footerActionStatus.innerText = isRunning ? (label || 'Memproses...') : 'Siap';
    }
  }

  async function refreshTargetCorelDropdown() {
    if (!selTargetCorelVersion || !window.corelAPI?.getDetectedCorelVersions) return;
    try {
      const res = await window.corelAPI.getDetectedCorelVersions();
      if (res && res.preferred && !selTargetCorelVersion.dataset.userChanged) {
        selTargetCorelVersion.value = res.preferred;
      }
      if (res && Array.isArray(res.running)) {
        const runningIds = res.running.filter(r => r.isVisible && r.id && r.id !== '0').map(r => String(r.id));
        for (let i = 0; i < selTargetCorelVersion.options.length; i++) {
          const opt = selTargetCorelVersion.options[i];
          const baseName = opt.getAttribute('data-basename') || opt.text.replace(/\s*-\s*Sedang Terbuka$/i, '');
          opt.setAttribute('data-basename', baseName);
          if (runningIds.includes(opt.value)) {
            opt.text = `${baseName} - Sedang Terbuka`;
          } else {
            opt.text = baseName;
          }
        }
      }
    } catch {}
  }

  if (selTargetCorelVersion) {
    if (window.corelAPI?.getPreferredCorelVersion) {
      window.corelAPI.getPreferredCorelVersion().then((res) => {
        if (res && res.preferredVersion) {
          selTargetCorelVersion.value = res.preferredVersion;
          const selPolaVer = document.getElementById('selLayoutPolaCorelVer');
          if (selPolaVer) selPolaVer.value = res.preferredVersion;
        }
        refreshTargetCorelDropdown();
      }).catch(() => {});
    }
    selTargetCorelVersion.addEventListener('change', async () => {
      const chosenVer = selTargetCorelVersion.value;
      const selPolaVer = document.getElementById('selLayoutPolaCorelVer');
      if (selPolaVer) selPolaVer.value = chosenVer;
      let targetPid = 0;
      try {
        if (window.corelAPI?.getDetectedCorelVersions) {
          const det = await window.corelAPI.getDetectedCorelVersions();
          if (det && Array.isArray(det.running)) {
            const match = det.running.find(r => String(r.version) === chosenVer);
            if (match) targetPid = match.pid;
          }
        }
      } catch {}
      if (window.corelAPI?.setPreferredCorelVersion) {
        await window.corelAPI.setPreferredCorelVersion(chosenVer, targetPid);
        await updateCorelStatus();
        const selectedText = selTargetCorelVersion.options[selTargetCorelVersion.selectedIndex].text;
        showToast(`Target CorelDRAW: ${selectedText}`);
      }
    });
  }

  async function triggerCancelOperation() {
    if (window.corelAPI?.cancelOperation) {
      if (footerActionStatus) footerActionStatus.innerText = 'Membatalkan proses...';
      const res = await window.corelAPI.cancelOperation();
      showToast(res?.message || 'Proses berhasil dibatalkan.', true);
      if (footerActionStatus) footerActionStatus.innerText = 'Dibatalkan';
      if (btnGlobalCancelTask) btnGlobalCancelTask.style.display = 'none';
    }
  }

  if (btnGlobalCancelTask) {
    btnGlobalCancelTask.addEventListener('click', triggerCancelOperation);
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
  const selEnumSpacingUnit = document.getElementById('selEnumSpacingUnit');
  const lblEnumSpacingX = document.getElementById('lblEnumSpacingX');
  const lblEnumSpacingY = document.getElementById('lblEnumSpacingY');
  const enumGridOrder = document.getElementById('enumGridOrder');
  const enumAutoCurves = document.getElementById('enumAutoCurves');
  const enumPreviewList = document.getElementById('enumPreviewList');
  const enumTotalCount = document.getElementById('enumTotalCount');
  const btnEnumGenerate = document.getElementById('btnEnumGenerate');
  const btnEnumReset = document.getElementById('btnEnumReset');
  const btnEnumCopyPreview = document.getElementById('btnEnumCopyPreview');

  if (selEnumSpacingUnit) {
    selEnumSpacingUnit.addEventListener('change', () => {
      const isMm = selEnumSpacingUnit.value === 'mm';
      if (lblEnumSpacingX) lblEnumSpacingX.innerText = isMm ? 'Jarak X (mm):' : 'Jarak X (cm):';
      if (lblEnumSpacingY) lblEnumSpacingY.innerText = isMm ? 'Jarak Y (mm):' : 'Jarak Y (cm):';
      if (enumSpacingX) enumSpacingX.step = isMm ? '0.5' : '0.1';
      if (enumSpacingY) enumSpacingY.step = isMm ? '0.5' : '0.1';

      const curX = parseFloat(enumSpacingX?.value);
      if (!isNaN(curX) && curX >= 0) {
        enumSpacingX.value = isMm
          ? (curX * 10).toFixed(1).replace(/\.0$/, '')
          : (curX / 10).toFixed(2).replace(/\.?0+$/, '');
      }
      const curY = parseFloat(enumSpacingY?.value);
      if (!isNaN(curY) && curY >= 0) {
        enumSpacingY.value = isMm
          ? (curY * 10).toFixed(1).replace(/\.0$/, '')
          : (curY / 10).toFixed(2).replace(/\.?0+$/, '');
      }
    });
  }

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
      if (!requireActiveLicense()) return;
      const s = parseInt(enumStart?.value, 10) || 1;
      const e = parseInt(enumEnd?.value, 10) || 100;
      const step = parseInt(enumStep?.value, 10) || 1;
      const digits = parseInt(enumFormat?.value, 10) || 0;
      const pfx = enumPrefix?.value || '';
      const sfx = enumSuffix?.value || '';
      const mode = enumMode?.value || 'page';
      const cols = parseInt(enumGridCols?.value, 10) || 2;
      const rows = parseInt(enumGridRows?.value, 10) || 5;
      const isMm = selEnumSpacingUnit?.value === 'mm';
      const rawSpacingX = parseFloat(enumSpacingX?.value);
      const valX = !isNaN(rawSpacingX) && rawSpacingX >= 0 ? rawSpacingX : (isMm ? 5 : 0.5);
      const spacingX = isMm ? (valX / 10.0) : valX;

      const rawSpacingY = parseFloat(enumSpacingY?.value);
      const valY = !isNaN(rawSpacingY) && rawSpacingY >= 0 ? rawSpacingY : (isMm ? 5 : 0.5);
      const spacingY = isMm ? (valY / 10.0) : valY;
      const gridOrder = enumGridOrder?.value || 'cut_stack';
      const autoCurves = enumAutoCurves ? enumAutoCurves.checked : true;

      btnEnumGenerate.disabled = true;
      btnEnumGenerate.innerText = 'Memproses di CorelDRAW...';
      setTaskRunning(true, 'Sedang membuat nomor di CorelDRAW...');

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

          if (res.cancelled) {
            showToast('Nomorator dibatalkan.', false);
          } else if (res.success) {
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
        setTaskRunning(false);
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
  const selConvertEngine = document.getElementById('selConvertEngine');
  const txtConvertOutputFolder = document.getElementById('txtConvertOutputFolder');
  const btnBrowseOutputFolder = document.getElementById('btnBrowseOutputFolder');
  const chkOpenFolderAfter = document.getElementById('chkOpenFolderAfter');
  const chkOverwriteFiles = document.getElementById('chkOverwriteFiles');
  const btnStartConversion = document.getElementById('btnStartConversion');

  // Cloud Converter Link Buttons
  document.querySelectorAll('.btn-cloud-link').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const url = btn.getAttribute('data-url');
      if (!url) return;
      const openFn = window.electronAPI?.openExternalUrl || window.corelAPI?.openExternalUrl;
      if (openFn) {
        openFn(url);
      } else {
        window.open(url, '_blank');
      }
    });
  });

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

  const btnCancelConversion = document.getElementById('btnCancelConversion');
  let isConverting = false;

  if (btnClearFiles) {
    btnClearFiles.addEventListener('click', async () => {
      if (isConverting) {
        const doCancel = confirm('Proses konversi sedang berjalan. Batalkan konversi dan bersihkan daftar file?');
        if (doCancel) {
          await triggerCancelOperation();
        } else {
          return;
        }
      }
      conversionFiles = [];
      renderConversionFiles();
      showToast('Daftar file dikosongkan.');
    });
  }

  if (btnCancelConversion) {
    btnCancelConversion.addEventListener('click', triggerCancelOperation);
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isConverting) {
      triggerCancelOperation();
    }
  });

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

      isConverting = true;
      btnStartConversion.disabled = true;
      btnStartConversion.innerText = 'Mengonversi File...';
      if (btnCancelConversion) btnCancelConversion.style.display = 'inline-flex';
      if (btnGlobalCancelTask) btnGlobalCancelTask.style.display = 'inline-flex';
      footerActionStatus.innerText = `Mengonversi ${conversionFiles.length} file...`;

      try {
        if (window.corelAPI?.executeConversion) {
          const res = await window.corelAPI.executeConversion({
            files: conversionFiles,
            outputFormat: selConvertOutputFormat.value,
            outputFolder: txtConvertOutputFolder.value,
            dpi: parseInt(selConvertDPI.value, 10) || 300,
            engine: selConvertEngine ? selConvertEngine.value : 'auto',
            openFolderAfter: chkOpenFolderAfter.checked,
            overwrite: chkOverwriteFiles.checked
          });

          if (res.success) {
            showToast(`Sukses: ${res.message || 'Konversi selesai!'}`, true);
            alert(`Sukses!\n\n${res.message}`);
          } else {
            showToast(`Gagal: ${res.message}`, false);
            alert(`Gagal konversi:\n\n${res.message}`);
          }
        }
      } catch (err) {
        showToast(`Error: ${err.message}`, false);
      } finally {
        isConverting = false;
        btnStartConversion.disabled = false;
        btnStartConversion.innerText = 'Mulai Konversi';
        if (btnCancelConversion) btnCancelConversion.style.display = 'none';
        if (btnGlobalCancelTask) btnGlobalCancelTask.style.display = 'none';
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
      setTaskRunning(true, 'Mengekstrak warna dari CorelDRAW...');
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
        setTaskRunning(false);
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
      setTaskRunning(true, 'Mengganti warna di CorelDRAW...');
      try {
        if (window.corelAPI?.executeColorReplace) {
          const res = await window.corelAPI.executeColorReplace({
            sourceHex: pickerSourceColor.value,
            targetHex: pickerTargetColor.value,
            replaceFill: document.getElementById('chkReplaceFill')?.checked ?? true,
            replaceOutline: document.getElementById('chkReplaceOutline')?.checked ?? true,
            includeGroups: document.getElementById('chkIncludeGroups')?.checked ?? true
          });

          if (res.cancelled) {
            showToast('Penggantian warna dibatalkan.', false);
          } else if (res.success) {
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
        setTaskRunning(false);
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
  const selWebMergerSpacingUnit = document.getElementById('selWebMergerSpacingUnit');
  const lblWebMergerSpacingX = document.getElementById('lblWebMergerSpacingX');
  const lblWebMergerSpacingY = document.getElementById('lblWebMergerSpacingY');
  const selMergerGridOrder = document.getElementById('selMergerGridOrder');
  const lblMergerGridSummary = document.getElementById('lblMergerGridSummary');
  const chkMergerAutoCurves = document.getElementById('chkMergerAutoCurves');

  if (selWebMergerSpacingUnit) {
    selWebMergerSpacingUnit.addEventListener('change', () => {
      const isMm = selWebMergerSpacingUnit.value === 'mm';
      if (lblWebMergerSpacingX) lblWebMergerSpacingX.innerText = isMm ? 'Jarak X (mm):' : 'Jarak X (cm):';
      if (lblWebMergerSpacingY) lblWebMergerSpacingY.innerText = isMm ? 'Jarak Y (mm):' : 'Jarak Y (cm):';
      if (numMergerSpacingX) numMergerSpacingX.step = isMm ? '0.5' : '0.1';
      if (numMergerSpacingY) numMergerSpacingY.step = isMm ? '0.5' : '0.1';

      const curX = parseFloat(numMergerSpacingX?.value);
      if (!isNaN(curX) && curX >= 0) {
        numMergerSpacingX.value = isMm
          ? (curX * 10).toFixed(1).replace(/\.0$/, '')
          : (curX / 10).toFixed(2).replace(/\.?0+$/, '');
      }
      const curY = parseFloat(numMergerSpacingY?.value);
      if (!isNaN(curY) && curY >= 0) {
        numMergerSpacingY.value = isMm
          ? (curY * 10).toFixed(1).replace(/\.0$/, '')
          : (curY / 10).toFixed(2).replace(/\.?0+$/, '');
      }
    });
  }

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
      lblMergerGridSummary.innerHTML = `<b>${cols} Kolom x ${rows} Baris = ${perPage} Desain per Lembar Cetak</b>`;
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
          showToast(`Ukuran teks '${item.placeholder}' diset ke ${item.width} x ${item.height} cm`);
        } else {
          alert(`Objek teks di CorelDRAW belum dipilih!\n\nSilakan pilih (klik seleksi) objek teks '${item.placeholder}' di lembar kerja CorelDRAW, lalu klik tombol ini lagi.`);
        }
      } catch (err) {
        alert(`Gagal mengambil ukuran dari CorelDRAW: ${err.message}`);
      } finally {
        btnSample.disabled = false;
        btnSample.innerHTML = 'Ambil Seleksi Corel';
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
      if (!requireActiveLicense()) return;
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
      const isMm = selWebMergerSpacingUnit?.value === 'mm';
      const rawMergerSpacingX = parseFloat(numMergerSpacingX?.value);
      const valX = !isNaN(rawMergerSpacingX) && rawMergerSpacingX >= 0 ? rawMergerSpacingX : (isMm ? 5 : 0.5);
      const spacingX = isMm ? (valX / 10.0) : valX;

      const rawMergerSpacingY = parseFloat(numMergerSpacingY?.value);
      const valY = !isNaN(rawMergerSpacingY) && rawMergerSpacingY >= 0 ? rawMergerSpacingY : (isMm ? 5 : 0.5);
      const spacingY = isMm ? (valY / 10.0) : valY;
      const gridOrder = selMergerGridOrder?.value || 'left_right';
      const autoCurves = chkMergerAutoCurves?.checked ?? true;

      btnExecuteMerger.disabled = true;
      btnExecuteMerger.innerText = 'Memproses di CorelDRAW...';
      setTaskRunning(true, 'Sedang memproses merger data di CorelDRAW...');

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

          if (res.cancelled) {
            showToast('Merger data dibatalkan.', false);
          } else if (res.success) {
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
        setTaskRunning(false);
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
  const selWebJerseySpacingUnit = document.getElementById('selWebJerseySpacingUnit');
  const lblWebJerseySpacing = document.getElementById('lblWebJerseySpacing');
  const numJerseySpacing = document.getElementById('numJerseySpacing');

  if (selWebJerseySpacingUnit) {
    selWebJerseySpacingUnit.addEventListener('change', () => {
      const isMm = selWebJerseySpacingUnit.value === 'mm';
      if (lblWebJerseySpacing) lblWebJerseySpacing.innerText = isMm ? 'Jarak Pola (mm):' : 'Jarak Pola (cm):';
      if (numJerseySpacing) numJerseySpacing.step = isMm ? '1' : '0.1';

      const cur = parseFloat(numJerseySpacing?.value);
      if (!isNaN(cur) && cur >= 0) {
        numJerseySpacing.value = isMm
          ? (cur * 10).toFixed(1).replace(/\.0$/, '')
          : (cur / 10).toFixed(2).replace(/\.?0+$/, '');
      }
    });
  }

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

  const STANDARD_SIZE_ORDER = [
    'XXS ANAK', 'XS ANAK', 'S ANAK', 'M ANAK', 'L ANAK', 'XL ANAK', 'XXL ANAK',
    '2', '4', '6', '8', '10', '12', '14', '16',
    'XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL', '6XL', '7XL'
  ];

  function normalizeJerseySize(sz) {
    if (!sz) return 'L';
    let s = sz.toUpperCase().trim().replace(/[\(\)\[\]"']/g, '').replace(/\s+/g, ' ');
    if (s === 'XXXXL') return '4XL';
    if (s === 'XXXL') return '3XL';
    if (s === '2XL') return 'XXL';
    return s;
  }

  function getJerseySizeRank(sz) {
    const norm = normalizeJerseySize(sz);
    const idx = STANDARD_SIZE_ORDER.indexOf(norm);
    return idx >= 0 ? idx : 999;
  }

  function cleanPlayerName(str) {
    if (!str) return '';
    let s = String(str).trim();
    // Strip leading numbering e.g. "1. ", "12) ", "[1] ", "1 " (when followed by letters or open paren)
    s = s.replace(/^\s*(?:\[\s*\d+\s*\]|\d+[\.\)\-:]\s*|\d+\s+(?=[A-Za-z\(\[\{])|\*\s*)/, '').trim();
    // Remove size enclosed in parentheses/brackets e.g. "(S)", "( M )", "(XL)", "[L]", "{XXL}"
    s = s.replace(/[\(\[\{]\s*(?:7XL|6XL|5XL|4XL|XXXXL|3XL|XXXL|XXL|2XL|XL|L|M|S|XS|XXS|S\s*ANAK|M\s*ANAK|L\s*ANAK|XL\s*ANAK|XXL\s*ANAK)\s*[\)\]\}]/gi, ' ').trim();
    // Remove any leftover empty parentheses, brackets, or braces: "()", "( )", "[]", "[ ]", "{}", "{ }"
    s = s.replace(/[\(\[\{]\s*[\)\]\}]/g, ' ').trim();
    // Remove leftover field labels like "Nama:", "Name:", "Punggung:", "Nama Punggung:"
    s = s.replace(/^(?:nama|name|punggung|nama\s*punggung)\s*[:=-]?\s*/i, '').trim();
    // Remove leftover leading/trailing punctuation like '-', '/', ',', '|', ':'
    s = s.replace(/^[\s\-\/\|:,]+|[\s\-\/\|:,]+$/g, '').trim();
    // Clean empty parentheses once more in case stripped punctuation revealed them
    s = s.replace(/[\(\[\{]\s*[\)\]\}]/g, ' ').trim();
    // Collapse whitespace
    s = s.replace(/\s+/g, ' ').trim();
    return s;
  }

  function cleanPlayerNumber(num) {
    if (num === null || num === undefined) return '-';
    let str = String(num).trim();
    if (!str || str === '-' || /^(?:tanpa\s*no(?:mor)?|ga\s*pake\s*no(?:mor)?|no\s*nomor|none|null|undefined)$/i.test(str)) {
      return '-';
    }
    str = str.replace(/[\(\)\[\]\{\}]/g, '').trim();
    str = str.replace(/^(?:no\.?|nomor|nomer|#)\s*[:=-]?\s*/i, '').trim();
    return str || '-';
  }

  function cleanPlayerSize(sz) {
    if (!sz) return 'L';
    let str = String(sz).trim().toUpperCase();
    str = str.replace(/[\(\)\[\]\{\}'"]/g, '').trim();
    str = str.replace(/^(?:size|ukuran|uk\.?|sz\.?)\s*[:=-]?\s*/i, '').trim();
    return normalizeJerseySize(str) || 'L';
  }

  let jerseySizeChart = [
    { size: 'S ANAK', height: 56.0, width: 152.0, lockRatio: true },
    { size: 'M ANAK', height: 59.0, width: 160.0, lockRatio: true },
    { size: 'L ANAK', height: 62.0, width: 168.0, lockRatio: true },
    { size: 'XL ANAK', height: 65.0, width: 176.0, lockRatio: true },
    { size: 'XXL ANAK', height: 67.0, width: 182.0, lockRatio: true },
    { size: 'XS', height: 68.5, width: 186.05, lockRatio: true },
    { size: 'S', height: 71.0, width: 192.84, lockRatio: true },
    { size: 'M', height: 73.5, width: 199.63, lockRatio: true },
    { size: 'L', height: 76.0, width: 206.41, lockRatio: true },
    { size: 'XL', height: 78.5, width: 213.20, lockRatio: true },
    { size: 'XXL', height: 81.0, width: 219.99, lockRatio: true },
    { size: '3XL', height: 83.5, width: 226.78, lockRatio: true },
    { size: '4XL', height: 86.0, width: 233.50, lockRatio: true },
    { size: '5XL', height: 88.5, width: 240.00, lockRatio: true }
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

  // Synchronize input values from DOM table to jerseySizeChart in memory
  function syncJerseySizeChartFromDOM() {
    if (!tbodyJerseySizeChart) return;
    const rows = tbodyJerseySizeChart.querySelectorAll('tr');
    rows.forEach((tr, idx) => {
      if (jerseySizeChart[idx]) {
        const sz = tr.querySelector('.sc-sz')?.value?.trim().toUpperCase();
        const rawH = tr.querySelector('.sc-h')?.value;
        const rawW = tr.querySelector('.sc-w')?.value;
        if (sz) jerseySizeChart[idx].size = sz;
        if (rawH !== undefined && rawH !== '') {
          jerseySizeChart[idx].height = parseFloat(rawH) || 0;
        }
        if (rawW !== undefined && rawW !== '') {
          jerseySizeChart[idx].width = parseFloat(rawW) || 0;
        }
      }
    });
  }

  // Render Size Chart Table
  function renderJerseySizeChart() {
    if (!tbodyJerseySizeChart) return;
    tbodyJerseySizeChart.innerHTML = '';

    jerseySizeChart.forEach((sc, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <input type="text" class="input-text sc-sz" data-idx="${idx}" value="${sc.size}" style="width: 55px; height: 22px; font-weight: 800; text-transform: uppercase; color: var(--accent-blue); text-align: center; padding: 0 2px;" title="Klik untuk mengubah nama ukuran" />
        </td>
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

      const inpSz = tr.querySelector('.sc-sz');
      const inpH = tr.querySelector('.sc-h');
      const inpW = tr.querySelector('.sc-w');
      const btnLock = tr.querySelector('.sc-lock');
      const btnDel = tr.querySelector('.sc-del');

      inpSz.addEventListener('input', (e) => {
        sc.size = e.target.value.trim().toUpperCase();
      });

      inpH.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value) || 0;
        sc.height = val;
        // Only auto-scale width if width is non-zero (if user entered 0, width stays 0!)
        if (sc.lockRatio && jerseyMasterRatio > 0 && sc.width > 0) {
          sc.width = parseFloat((val * jerseyMasterRatio).toFixed(2));
          inpW.value = sc.width;
        }
      });

      inpW.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value) || 0;
        sc.width = val;
        // If user enters 0, DO NOT change height! Lebar = 0 means only height changes.
        if (val > 0 && sc.lockRatio && jerseyMasterRatio > 0) {
          sc.height = parseFloat((val / jerseyMasterRatio).toFixed(2));
          inpH.value = sc.height;
        }
      });

      btnLock.addEventListener('click', () => {
        syncJerseySizeChartFromDOM();
        sc.lockRatio = !sc.lockRatio;
        renderJerseySizeChart();
      });

      btnDel.addEventListener('click', () => {
        if (jerseySizeChart.length <= 1) {
          alert('Minimal harus ada 1 ukuran pada size chart.');
          return;
        }
        syncJerseySizeChartFromDOM();
        jerseySizeChart.splice(idx, 1);
        renderJerseySizeChart();
      });

      tbodyJerseySizeChart.appendChild(tr);
    });
  }

  window.addJerseySizeRow = function() {
    syncJerseySizeChartFromDOM();
    // Determine the next logical size candidate
    const standardSequence = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL', '6XL', '7XL', '8XL'];
    let nextSz = '';
    for (const cand of standardSequence) {
      if (!jerseySizeChart.some(s => s.size === cand)) {
        nextSz = cand;
        break;
      }
    }
    if (!nextSz) {
      let count = jerseySizeChart.length + 1;
      while (jerseySizeChart.some(s => s.size === `SIZE-${count}`)) {
        count++;
      }
      nextSz = `SIZE-${count}`;
    }

    const lastH = jerseySizeChart[jerseySizeChart.length - 1]?.height || 76.0;
    const newH = parseFloat((lastH + 2.5).toFixed(1));
    const curRatio = (jerseyMasterRatio && !isNaN(jerseyMasterRatio) && jerseyMasterRatio > 0) ? jerseyMasterRatio : 1.264;
    const newW = parseFloat((newH * curRatio).toFixed(2));

    jerseySizeChart.push({ size: nextSz, height: newH, width: newW, lockRatio: true });
    renderJerseySizeChart();
    showToast(`Ukuran ${nextSz} berhasil ditambahkan! Anda dapat mengubah nama ukuran langsung di tabel.`, true);

    // Auto-focus the newly added row
    setTimeout(() => {
      const inputs = tbodyJerseySizeChart ? tbodyJerseySizeChart.querySelectorAll('.sc-sz') : [];
      const lastInput = inputs[inputs.length - 1];
      if (lastInput) {
        lastInput.focus();
        lastInput.select();
      }
    }, 50);
  };

  window.resetJerseySizeChart = function() {
    const curRatio = (jerseyMasterRatio && !isNaN(jerseyMasterRatio) && jerseyMasterRatio > 0) ? jerseyMasterRatio : 1.264;
    jerseySizeChart = [
      { size: 'XS', height: 68.0, width: parseFloat((68.0 * curRatio).toFixed(2)), lockRatio: true },
      { size: 'S', height: 71.0, width: parseFloat((71.0 * curRatio).toFixed(2)), lockRatio: true },
      { size: 'M', height: 73.5, width: parseFloat((73.5 * curRatio).toFixed(2)), lockRatio: true },
      { size: 'L', height: 76.0, width: parseFloat((76.0 * curRatio).toFixed(2)), lockRatio: true },
      { size: 'XL', height: 78.5, width: parseFloat((78.5 * curRatio).toFixed(2)), lockRatio: true },
      { size: 'XXL', height: 81.0, width: parseFloat((81.0 * curRatio).toFixed(2)), lockRatio: true },
      { size: '3XL', height: 83.5, width: parseFloat((83.5 * curRatio).toFixed(2)), lockRatio: true }
    ];
    renderJerseySizeChart();
    showToast('Tabel ukuran direset ke standar sublimasi.', true);
  };

  if (btnJerseyAddSizeRow) {
    btnJerseyAddSizeRow.addEventListener('click', window.addJerseySizeRow);
  }

  if (btnJerseyResetSizeChart) {
    btnJerseyResetSizeChart.addEventListener('click', window.resetJerseySizeChart);
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
            if (sc.lockRatio && sc.height > 0 && sc.width > 0) {
              sc.width = parseFloat((sc.height * jerseyMasterRatio).toFixed(2));
            }
          });
          renderJerseySizeChart();
          showToast(`Ukuran master terdeteksi: ${jerseyMasterWidthCm.toFixed(2)} x ${jerseyMasterHeightCm.toFixed(2)} cm (Rasio: ${jerseyMasterRatio.toFixed(3)})`, true);
        } else {
          alert('Pilih 1 objek grup master pola jersey di CorelDRAW terlebih dahulu!');
        }
      } catch (err) {
        alert(`Error membaca CorelDRAW: ${err.message}`);
      } finally {
        btnJerseySampleMaster.disabled = false;
        btnJerseySampleMaster.innerText = 'Baca Ukuran Pola dari Corel';
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

  function updateJerseyTargetSizeOptions() {
    const selTarget = document.getElementById('selJerseyTargetSize');
    if (!selTarget) return;
    const currentVal = selTarget.value;
    const uniqueSizes = [...new Set(jerseyPlayers.map(p => (p.Ukuran || p.size || 'L').toUpperCase()))];
    uniqueSizes.sort((a, b) => getJerseySizeRank(a) - getJerseySizeRank(b));

    let html = `<option value="ALL">Semua Ukuran (Campur)</option>`;
    uniqueSizes.forEach(sz => {
      html += `<option value="${sz}">${sz} Saja</option>`;
    });
    selTarget.innerHTML = html;
    if (uniqueSizes.includes(currentVal)) {
      selTarget.value = currentVal;
    } else {
      selTarget.value = 'ALL';
    }
  }

  // Render Player Table (Excel Mode)
  function renderJerseyPlayerTable() {
    if (!tbodyJerseyPlayers) return;
    tbodyJerseyPlayers.innerHTML = '';
    const hasDada = jerseyPlayers.some(p => p['Nama Dada'] || p.dada);
    const thDada = document.getElementById('thJerseyNamaDada');
    if (thDada) thDada.style.display = hasDada ? '' : 'none';

    jerseyPlayers.forEach((p, idx) => {
      const tr = document.createElement('tr');
      const pName = p['Nama Punggung'] || p.Nama || p.name || 'PEMAIN';
      const pDada = p['Nama Dada'] || p.dada || '';
      const pNum = p.Nomor || p.number || '00';
      const pSize = (p.Ukuran || p.size || 'L').toUpperCase();

      let sizeOpts = STANDARD_SIZE_ORDER.map(sz => `<option value="${sz}" ${sz === pSize ? 'selected' : ''}>${sz}</option>`).join('');
      if (!STANDARD_SIZE_ORDER.includes(pSize) && pSize) {
        sizeOpts += `<option value="${pSize}" selected>${pSize}</option>`;
      }

      let rowHtml = `
        <td style="text-align: center; color: var(--text-dim);">${idx + 1}</td>
        <td><input type="text" class="input-text p-name" value="${pName}" style="height: 22px; font-size: 11px;" /></td>`;
      if (hasDada) {
        rowHtml += `<td><input type="text" class="input-text p-dada" value="${pDada}" placeholder="Dada..." style="height: 22px; font-size: 11px;" /></td>`;
      }
      rowHtml += `
        <td><input type="text" class="input-text p-num" value="${pNum}" style="height: 22px; font-size: 11px; font-weight: 700; color: var(--accent-blue);" /></td>
        <td>
          <select class="select-native p-size" style="height: 22px; font-size: 11px; font-weight: 700;">
            ${sizeOpts}
          </select>
        </td>
        <td><button type="button" class="btn-danger p-del" style="height: 20px; font-size: 9px; padding: 0 4px;" title="Hapus pemain">✕</button></td>
      `;

      tr.innerHTML = rowHtml;

      tr.querySelector('.p-name').addEventListener('input', (e) => {
        p.name = e.target.value;
        p.Nama = e.target.value;
      });
      const inpDada = tr.querySelector('.p-dada');
      if (inpDada) {
        inpDada.addEventListener('input', (e) => {
          p['Nama Dada'] = e.target.value;
          p.dada = e.target.value;
        });
      }
      tr.querySelector('.p-num').addEventListener('input', (e) => {
        p.number = e.target.value;
        p.Nomor = e.target.value;
      });
      tr.querySelector('.p-size').addEventListener('change', (e) => {
        p.size = e.target.value;
        p.Ukuran = e.target.value;
        updateJerseyTargetSizeOptions();
      });
      tr.querySelector('.p-del').addEventListener('click', () => {
        jerseyPlayers.splice(idx, 1);
        renderJerseyPlayerTable();
        updateJerseyTargetSizeOptions();
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

    if (rawJerseyExcelData.headers && rawJerseyExcelData.headers.length > 0) {
      jerseyExcelHeaders = rawJerseyExcelData.headers.map(h => h.name).filter(Boolean);
    } else {
      const headerSet = new Set();
      rows.forEach(r => {
        Object.keys(r).forEach(k => {
          if (k && !k.startsWith('__EMPTY') && k.length > 1) headerSet.add(k);
        });
      });
      if (headerSet.size > 0) {
        jerseyExcelHeaders = Array.from(headerSet);
      }
    }

    jerseyPlayers = rows.slice(headerRowIdx - 1).map(r => {
      const name = String(
        r['NAMA PUNGGUNG'] || r['Nama Punggung'] || r['nama_punggung'] ||
        r['NAMA'] || r['Nama'] || r['nama'] ||
        r['Name'] || r['name'] ||
        (r.B && r.A && !isNaN(parseInt(r.A, 10)) ? r.B : '') ||
        r.A || 'PEMAIN'
      ).trim();

      const num = String(
        r['NOMOR'] || r['Nomor'] || r['nomor'] ||
        r['NO JERSEY'] || r['No Jersey'] || r['no_jersey'] ||
        r['Number'] || r['number'] ||
        (r.C && r.A && !isNaN(parseInt(r.A, 10)) ? r.C : '') ||
        r['No'] || r['no'] || '-'
      ).trim();

      const sz = String(
        r['UKURAN'] || r['Ukuran'] || r['ukuran'] ||
        r['SIZE'] || r['Size'] || r['size'] ||
        (r.D && r.A && !isNaN(parseInt(r.A, 10)) ? r.D : '') ||
        'L'
      ).trim().toUpperCase();

      const dada = String(
        r['NAMA DADA'] || r['Nama Dada'] || r['nama_dada'] ||
        r['DADA'] || r['Dada'] || r['dada'] ||
        r['CHEST'] || r['Chest'] || ''
      ).trim();

      const sp = String(
        r['SPONSOR'] || r['Sponsor'] || r['sponsor'] ||
        r['TIM'] || r['Tim'] || 'GFX ESPORTS'
      ).trim();

      const catatan = String(
        r['CATATAN'] || r['Catatan'] || r['catatan'] ||
        r['POSISI'] || r['Posisi'] || r['posisi'] ||
        r['KETERANGAN'] || r['Keterangan'] || ''
      ).trim();

      return {
        ...r,
        Nama: name,
        'Nama Punggung': name,
        Nomor: num,
        Ukuran: sz,
        'Nama Dada': dada,
        Sponsor: sp,
        Catatan: catatan,
        name: name,
        number: num,
        size: sz,
        dada: dada
      };
    }).filter(p => p.Nama && p.Nama !== 'PEMAIN');

    // Auto sync mapping for Nama Punggung
    const nameMapping = jerseyMappings.find(m => m.placeholder === '[NAMA]');
    const foundBackNameCol = jerseyExcelHeaders.find(h => /^nama\s*punggung$/i.test(h));
    if (nameMapping && foundBackNameCol && !jerseyExcelHeaders.includes(nameMapping.column)) {
      nameMapping.column = foundBackNameCol;
    }

    // Auto sync mapping for Nama Dada
    const foundDadaCol = jerseyExcelHeaders.find(h => /dada|chest/i.test(h)) || (jerseyPlayers.some(p => !!p['Nama Dada']) ? 'Nama Dada' : null);
    if (foundDadaCol && !jerseyMappings.some(m => m.placeholder === '[DADA]')) {
      jerseyMappings.push({
        id: (jerseyMappings.reduce((max, m) => Math.max(max, m.id || 0), 0)) + 1,
        column: foundDadaCol,
        placeholder: '[DADA]',
        align: 'center',
        textCase: 'upper',
        maxWidth: 15.0,
        lockRatio: true
      });
    }

    if (lblJerseyRowCount) lblJerseyRowCount.innerText = `(${jerseyPlayers.length} Baris Data)`;
    if (boxJerseyTablePreview) boxJerseyTablePreview.style.display = 'flex';
    if (lblJerseyColCount) lblJerseyColCount.innerText = `${jerseyExcelHeaders.length} Kolom Terdeteksi`;

    renderJerseyExcelPreviewTable(rows.slice(headerRowIdx - 1, headerRowIdx + 4));
    renderJerseyMappings();
    renderJerseyPlayerTable();
    updateJerseyTargetSizeOptions();
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
      if (!requireActiveLicense()) return;
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
            placeholder: v.placeholder ? v.placeholder.trim() : `[VAR_${vIdx + 1}]`,
            label: v.label || v.placeholder,
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
            const colKey = `Col_${vIdx + 1}`;
            rowObj[colKey] = val;
            if (v.placeholder) {
              rowObj[v.placeholder] = val;
              const phBare = v.placeholder.replace(/[\[\]\{\}]/g, '').trim();
              if (phBare) rowObj[phBare] = val;
            }
            if (v.label) {
              rowObj[v.label] = val;
            }
            const phComb = ((v.placeholder || '') + ' ' + (v.label || '')).toLowerCase();
            if (phComb.includes('nama') || phComb.includes('name') || phComb.includes('pemain') || phComb.includes('player')) {
              rowObj.Nama = val;
              rowObj.Name = val;
            }
            if (phComb.includes('nomor') || phComb.includes('number') || phComb.includes('no') || phComb.includes('00') || phComb.includes('#') || v.placeholder === '[00]') {
              rowObj.Nomor = val;
              rowObj.Number = val;
            }
            if (phComb.includes('ukuran') || phComb.includes('size') || phComb.includes('sz')) {
              rowObj.Ukuran = val;
              rowObj.Size = val;
            }
            if (phComb.includes('sponsor') || phComb.includes('tim') || phComb.includes('team') || phComb.includes('club')) {
              rowObj.Sponsor = val;
            }
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
      const isMm = selWebJerseySpacingUnit?.value === 'mm';
      const rawJerseySpacing = parseFloat(document.getElementById('numJerseySpacing')?.value);
      const valSpacing = !isNaN(rawJerseySpacing) && rawJerseySpacing >= 0 ? rawJerseySpacing : (isMm ? 10 : 1.0);
      const spacingCm = isMm ? (valSpacing / 10.0) : valSpacing;
      const limitCopy = parseInt(document.getElementById('numJerseyLimit')?.value, 10) || 4;
      const direction = document.getElementById('selJerseyDirection')?.value || 'vertical';
      const groupBySize = document.getElementById('selJerseyGrouping')?.value === 'group_size';
      const enableAutoResize = !!chkJerseyEnableAutoResize?.checked;
      const masterSize = selJerseyMasterSize?.value || 'L';
      const autoCurves = !!document.getElementById('chkJerseyAutoCurves')?.checked;

      // Ensure latest values from DOM table are synced into jerseySizeChart
      syncJerseySizeChartFromDOM();

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
      setTaskRunning(true, 'Sedang menata pola jersey di CorelDRAW...');

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

          if (res.cancelled) {
            showToast('Penataan jersey dibatalkan.', false);
          } else if (res.success) {
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
        setTaskRunning(false);
      }
    });
  }

  // Open Floating Companion Window
  if (btnJerseyOpenCompanion) {
    btnJerseyOpenCompanion.addEventListener('click', () => {
      if (window.corelAPI?.corelOpenCompanionTool) {
        syncJerseySizeChartFromDOM();
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
            if (window.syncAiModeBadge) window.syncAiModeBadge();
            const ordKey = document.getElementById('txtOrderApiKey');
            if (ordKey) ordKey.value = key;
            showToast('API Key Gemini berhasil divalidasi dan disimpan! Mode Online aktif.', true);
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

  const btnTracerClearKey = document.getElementById('btnTracerClearKey');
  if (btnTracerClearKey) {
    btnTracerClearKey.addEventListener('click', () => {
      localStorage.removeItem('gemini_api_key');
      if (txtTracerApiKey) txtTracerApiKey.value = '';
      const ordKey = document.getElementById('txtOrderApiKey');
      if (ordKey) ordKey.value = '';
      if (window.syncAiModeBadge) window.syncAiModeBadge();
      showToast('API Key Gemini berhasil dihapus. Sistem beralih ke Mode Offline (Mesin Lokal).');
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
      if (!requireActiveLicense()) return;
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
      setTaskRunning(true, 'Mengonversi seluruh teks ke kurva...');
      try {
        if (window.corelAPI?.corelConvertAllCurves) {
          const res = await window.corelAPI.corelConvertAllCurves();
          if (res.cancelled) {
            showToast('Konversi kurva dibatalkan.', false);
          } else if (res.success) {
            showToast(res.message || 'Semua teks berhasil dikonversi ke kurva!');
            alert(`✓ ${res.message}`);
          } else {
            alert(res.message);
          }
        }
      } catch (err) {
        alert(`Error: ${err.message}`);
      } finally {
        setTaskRunning(false);
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

  // Pemulihan & Pembersihan Proses CorelDRAW
  const btnUtilCleanGhostProcs = document.getElementById('btnUtilCleanGhostProcs');
  const btnUtilForceKillAll = document.getElementById('btnUtilForceKillAll');
  const boxKillProcsResult = document.getElementById('boxKillProcsResult');

  if (btnUtilCleanGhostProcs) {
    btnUtilCleanGhostProcs.addEventListener('click', async () => {
      btnUtilCleanGhostProcs.disabled = true;
      try {
        const res = await window.corelAPI?.cleanGhostProcesses?.();
        showToast(res?.message || 'Pembersihan selesai.');
        if (boxKillProcsResult) {
          boxKillProcsResult.style.display = 'block';
          boxKillProcsResult.style.color = '#34d399';
          boxKillProcsResult.innerText = res?.message || 'Pembersihan proses selesai.';
        }
        await updateCorelStatus();
      } catch (err) {
        showToast('Gagal: ' + (err?.message || err), false);
      } finally {
        btnUtilCleanGhostProcs.disabled = false;
      }
    });
  }

  if (btnUtilForceKillAll) {
    btnUtilForceKillAll.addEventListener('click', async () => {
      btnUtilForceKillAll.disabled = true;
      try {
        const res = await window.corelAPI?.forceKillAllCorel?.();
        showToast(res?.message || 'Semua proses CorelDRAW berhasil dihentikan.');
        if (boxKillProcsResult) {
          boxKillProcsResult.style.display = 'block';
          boxKillProcsResult.style.color = '#f87171';
          boxKillProcsResult.innerText = res?.message || 'Semua proses CorelDRAW dihentikan.';
        }
        await updateCorelStatus();
      } catch (err) {
        showToast('Gagal: ' + (err?.message || err), false);
      } finally {
        btnUtilForceKillAll.disabled = false;
      }
    });
  }

  // Registrasi & Integrasi Otomatis CorelDRAW
  const btnAutoScanRegisterCorel = document.getElementById('btnAutoScanRegisterCorel');
  const btnBrowseRegisterCorel = document.getElementById('btnBrowseRegisterCorel');
  const boxRegisterCorelResult = document.getElementById('boxRegisterCorelResult');

  if (btnAutoScanRegisterCorel) {
    btnAutoScanRegisterCorel.addEventListener('click', async () => {
      btnAutoScanRegisterCorel.disabled = true;
      btnAutoScanRegisterCorel.innerText = 'Memindai & Mendaftarkan...';
      if (boxRegisterCorelResult) {
        boxRegisterCorelResult.style.display = 'block';
        boxRegisterCorelResult.style.color = 'var(--text-dim)';
        boxRegisterCorelResult.innerText = 'Sedang mencari instalasi dan versi portable CorelDRAW di komputer...';
      }
      try {
        const res = await window.corelAPI?.autoRegisterCorel?.();
        if (res && res.success && res.registered && res.registered.length > 0) {
          const names = res.registered.map(r => r.name || ('Corel v' + r.version)).join(', ');
          showToast('Berhasil mendaftarkan: ' + names);
          if (boxRegisterCorelResult) {
            boxRegisterCorelResult.style.color = '#34d399';
            boxRegisterCorelResult.innerHTML = '<strong>Pendaftaran Berhasil!</strong> Ditemukan dan didaftarkan ' + res.count + ' versi:<br/>' + res.registered.map(r => '• <b>' + r.name + '</b> (' + r.path + ')').join('<br/>');
          }
        } else {
          showToast('Tidak ada CorelDRAW baru yang perlu didaftarkan.', true);
          if (boxRegisterCorelResult) {
            boxRegisterCorelResult.style.color = '#fbbf24';
            boxRegisterCorelResult.innerText = 'Pindaian selesai. Seluruh CorelDRAW yang terpasang sudah terdaftar.';
          }
        }
        await updateCorelStatus();
      } catch (err) {
        showToast('Gagal mendaftarkan: ' + (err?.message || err), false);
        if (boxRegisterCorelResult) {
          boxRegisterCorelResult.style.color = '#f87171';
          boxRegisterCorelResult.innerText = 'Terjadi kesalahan saat registrasi: ' + (err?.message || err);
        }
      } finally {
        btnAutoScanRegisterCorel.disabled = false;
        btnAutoScanRegisterCorel.innerText = '⚡ Pindai & Daftarkan Semua Versi Otomatis';
      }
    });
  }

  if (btnBrowseRegisterCorel) {
    btnBrowseRegisterCorel.addEventListener('click', async () => {
      try {
        const fileRes = await window.corelAPI?.selectCorelExeDialog?.();
        if (fileRes && fileRes.success && fileRes.path) {
          showToast('Mendaftarkan: ' + fileRes.path + '...');
          const regRes = await window.corelAPI?.registerCorelCustomPath?.(fileRes.path);
          if (regRes && regRes.success) {
            showToast(regRes.message || 'CorelDRAW berhasil didaftarkan!');
            if (boxRegisterCorelResult) {
              boxRegisterCorelResult.style.display = 'block';
              boxRegisterCorelResult.style.color = '#34d399';
              boxRegisterCorelResult.innerHTML = '<strong>Pendaftaran Berhasil!</strong><br/>• ' + regRes.message;
            }
            await updateCorelStatus();
          } else {
            showToast(regRes?.message || 'Gagal mendaftarkan file ini.', false);
          }
        }
      } catch (err) {
        showToast('Error: ' + (err?.message || err), false);
      }
    });
  }

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
      setTaskRunning(true, 'Mengubah ukuran layout di CorelDRAW...');
      try {
        if (window.corelAPI?.executeResizeLayout) {
          const res = await window.corelAPI.executeResizeLayout({ widthCm: w, heightCm: h, centerPage: center });
          if (res.cancelled) {
            showToast('Ubah ukuran dibatalkan.', false);
          } else if (res.success) {
            showToast(res.message || 'Ukuran berhasil diubah.');
          } else {
            alert(res.message);
          }
        }
      } catch (err) {
        showToast(err.message, false);
      } finally {
        btnApplyResizeLayout.disabled = false;
        setTaskRunning(false);
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
      setTaskRunning(true, 'Memisahkan dokumen di CorelDRAW...');
      try {
        if (window.corelAPI?.executeSplit) {
          const res = await window.corelAPI.executeSplit({
            mode: document.getElementById('selSplitMode')?.value || 'pages',
            outputFolder: txtSplitFolder.value
          });
          if (res.cancelled) {
            showToast('Pemisahan dokumen dibatalkan.', false);
          } else if (res.success) {
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
        setTaskRunning(false);
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
      setTaskRunning(true, 'Menjalankan batch pipeline di CorelDRAW...');
      try {
        if (window.corelAPI?.executeBatch) {
          const res = await window.corelAPI.executeBatch({ tasks: checkedSteps });
          if (res.cancelled) {
            showToast('Batch pipeline dibatalkan.', false);
          } else if (res.success) {
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
        setTaskRunning(false);
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
  // 12. Tool: Perapih List Pesanan Jersey
  // ==========================================
  const btnTabOrderText = document.getElementById('btnTabOrderText');
  const btnTabOrderImage = document.getElementById('btnTabOrderImage');
  const boxOrderTextSection = document.getElementById('boxOrderTextSection');
  const boxOrderImageSection = document.getElementById('boxOrderImageSection');

  const txtOrderRawInput = document.getElementById('txtOrderRawInput');
  const btnOrderParseNow = document.getElementById('btnOrderParseNow');
  const btnOrderLoadSample = document.getElementById('btnOrderLoadSample');
  const btnOrderPasteText = document.getElementById('btnOrderPasteText');
  const btnOrderClearText = document.getElementById('btnOrderClearText');

  const dropzoneOrderImage = document.getElementById('dropzoneOrderImage');
  const fileOrderImageInput = document.getElementById('fileOrderImageInput');
  const boxOrderImagePreviewWrap = document.getElementById('boxOrderImagePreviewWrap');
  const imgOrderPreview = document.getElementById('imgOrderPreview');
  const lblOrderImageName = document.getElementById('lblOrderImageName');
  const btnOrderRemoveImage = document.getElementById('btnOrderRemoveImage');
  const btnOrderScanOCR = document.getElementById('btnOrderScanOCR');
  const boxOrderOCRProgress = document.getElementById('boxOrderOCRProgress');
  const lblOrderOCRStep = document.getElementById('lblOrderOCRStep');
  const boxOrderLensRawWrap = document.getElementById('boxOrderLensRawWrap');
  const preOrderLensRaw = document.getElementById('preOrderLensRaw');
  const btnOrderPasteClipboardImg = document.getElementById('btnOrderPasteClipboardImg');

  const txtOrderApiKey = document.getElementById('txtOrderApiKey');
  const btnOrderSaveApiKey = document.getElementById('btnOrderSaveApiKey');
  const lblOrderAiStatus = document.getElementById('lblOrderAiStatus');

  const lblOrderTotalCount = document.getElementById('lblOrderTotalCount');
  const boxOrderSizeChips = document.getElementById('boxOrderSizeChips');
  const selOrderSortMode = document.getElementById('selOrderSortMode');
  const selOrderFilterSize = document.getElementById('selOrderFilterSize');
  const selOrderCaseTransform = document.getElementById('selOrderCaseTransform');
  const txtOrderDefaultSponsor = document.getElementById('txtOrderDefaultSponsor');
  const btnOrderAddEmptyRow = document.getElementById('btnOrderAddEmptyRow');
  const btnOrderClearAllRows = document.getElementById('btnOrderClearAllRows');

  const tblOrderResult = document.getElementById('tblOrderResult');
  const tbodyOrderResult = document.getElementById('tbodyOrderResult');

  const btnOrderCopyFormatted = document.getElementById('btnOrderCopyFormatted');
  const btnOrderExportExcel = document.getElementById('btnOrderExportExcel');
  const btnOrderSendToAutoLayout = document.getElementById('btnOrderSendToAutoLayout');

  let orderItems = [];
  let orderImageFile = null;
  let orderImageBase64 = '';

  // Synchronize Gemini API Key & Offline/Online Mode Badge
  function syncAiModeBadge() {
    window.syncAiModeBadge = syncAiModeBadge;
    const key = localStorage.getItem('gemini_api_key') || (txtOrderApiKey ? txtOrderApiKey.value.trim() : '');
    if (lblOrderAiStatus) {
      if (key) {
        lblOrderAiStatus.textContent = '[MODE ONLINE] AI Gemini Flash Aktif';
        lblOrderAiStatus.style.color = '#10b981';
        lblOrderAiStatus.style.background = 'rgba(16, 185, 129, 0.12)';
        lblOrderAiStatus.style.border = '1px solid rgba(16, 185, 129, 0.35)';
      } else {
        lblOrderAiStatus.textContent = '[MODE OFFLINE] Mesin Lokal (Tanpa API Key)';
        lblOrderAiStatus.style.color = '#f59e0b';
        lblOrderAiStatus.style.background = 'rgba(245, 158, 11, 0.12)';
        lblOrderAiStatus.style.border = '1px solid rgba(245, 158, 11, 0.35)';
      }
    }
    const lblTrk = document.getElementById('lblTracerKeyStatus');
    if (lblTrk) {
      if (key) {
        lblTrk.textContent = 'Online (Gemini Aktif)';
        lblTrk.style.color = '#10b981';
      } else {
        lblTrk.textContent = 'Offline (Belum Ada Key)';
        lblTrk.style.color = '#f59e0b';
      }
    }
  }

  const storedGeminiKey = localStorage.getItem('gemini_api_key') || '';
  if (txtOrderApiKey && storedGeminiKey) {
    txtOrderApiKey.value = storedGeminiKey;
  }
  const trkInputInit = document.getElementById('txtTracerApiKey');
  if (trkInputInit && storedGeminiKey) {
    trkInputInit.value = storedGeminiKey;
  }
  syncAiModeBadge();

  if (txtOrderApiKey) {
    txtOrderApiKey.addEventListener('input', syncAiModeBadge);
  }
  if (trkInputInit) {
    trkInputInit.addEventListener('input', syncAiModeBadge);
  }

  if (btnOrderSaveApiKey && txtOrderApiKey) {
    btnOrderSaveApiKey.addEventListener('click', () => {
      const k = txtOrderApiKey.value.trim();
      if (!k) {
        alert('Masukkan API Key Gemini.');
        return;
      }
      localStorage.setItem('gemini_api_key', k);
      const trk = document.getElementById('txtTracerApiKey');
      if (trk) trk.value = k;
      syncAiModeBadge();
      showToast('API Key Gemini berhasil disimpan! Mode Online aktif.', true);
    });
  }

  const btnOrderClearApiKey = document.getElementById('btnOrderClearApiKey');
  if (btnOrderClearApiKey && txtOrderApiKey) {
    btnOrderClearApiKey.addEventListener('click', () => {
      localStorage.removeItem('gemini_api_key');
      txtOrderApiKey.value = '';
      const trk = document.getElementById('txtTracerApiKey');
      if (trk) trk.value = '';
      syncAiModeBadge();
      showToast('API Key Gemini berhasil dihapus. Sistem beralih ke Mode Offline (Mesin Lokal).');
    });
  }

  let orderActiveCustomCols = [];
  let orderShowDada = false;

  function applyCaseTransform(text, mode) {
    if (!text || mode === 'asis') return text;
    if (mode === 'upper') return text.toUpperCase();
    if (mode === 'title') {
      return text.toLowerCase().replace(/(?:^|\s|-)\S/g, c => c.toUpperCase());
    }
    return text;
  }

  // Switch Sub-Tabs
  if (btnTabOrderText && btnTabOrderImage) {
    btnTabOrderText.addEventListener('click', () => {
      btnTabOrderText.classList.add('active');
      btnTabOrderImage.classList.remove('active');
      if (boxOrderTextSection) boxOrderTextSection.style.display = 'flex';
      if (boxOrderImageSection) boxOrderImageSection.style.display = 'none';
    });

    btnTabOrderImage.addEventListener('click', () => {
      btnTabOrderImage.classList.add('active');
      btnTabOrderText.classList.remove('active');
      if (boxOrderImageSection) boxOrderImageSection.style.display = 'flex';
      if (boxOrderTextSection) boxOrderTextSection.style.display = 'none';
    });
  }

  // Dropzone Image Handlers
  if (dropzoneOrderImage && fileOrderImageInput) {
    dropzoneOrderImage.addEventListener('click', () => fileOrderImageInput.click());

    dropzoneOrderImage.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzoneOrderImage.style.borderColor = 'var(--accent-blue)';
    });
    dropzoneOrderImage.addEventListener('dragleave', () => {
      dropzoneOrderImage.style.borderColor = 'var(--border-color)';
    });
    dropzoneOrderImage.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzoneOrderImage.style.borderColor = 'var(--border-color)';
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleOrderImageSelected(e.dataTransfer.files[0]);
      }
    });

    fileOrderImageInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleOrderImageSelected(e.target.files[0]);
      }
    });
  }

  function handleOrderImageSelected(file) {
    if (!file) return;
    orderImageFile = file;
    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      orderImageBase64 = loadEvt.target.result;
      if (imgOrderPreview) imgOrderPreview.src = orderImageBase64;
      if (lblOrderImageName) lblOrderImageName.innerText = file.name || 'foto_pesanan.jpg';
      if (boxOrderImagePreviewWrap) boxOrderImagePreviewWrap.style.display = 'flex';
      showToast('Gambar pesanan siap dipindai.');
    };
    reader.readAsDataURL(file);
  }

  if (btnOrderRemoveImage) {
    btnOrderRemoveImage.addEventListener('click', () => {
      orderImageFile = null;
      orderImageBase64 = '';
      if (imgOrderPreview) imgOrderPreview.src = '';
      if (boxOrderImagePreviewWrap) boxOrderImagePreviewWrap.style.display = 'none';
      if (fileOrderImageInput) fileOrderImageInput.value = '';
    });
  }

  // Paste Image from Clipboard
  if (btnOrderPasteClipboardImg) {
    btnOrderPasteClipboardImg.addEventListener('click', async () => {
      try {
        const clipboardItems = await navigator.clipboard.read();
        for (const item of clipboardItems) {
          const imageType = item.types.find(t => t.startsWith('image/'));
          if (imageType) {
            const blob = await item.getType(imageType);
            handleOrderImageSelected(blob);
            return;
          }
        }
        alert('Tidak ada gambar di clipboard. Silakan salin gambar / screenshot terlebih dahulu.');
      } catch (err) {
        showToast('Gunakan tombol Ctrl+V langsung untuk menempel gambar.', false);
      }
    });
  }

  // Google Lens + AI Scan Action (Direct in-app processing, no browser redirects)
  if (btnOrderScanOCR) {
    btnOrderScanOCR.addEventListener('click', async () => {
      if (!orderImageBase64 && !orderImageFile) {
        alert('Pilih atau tempel gambar catatan/foto terlebih dahulu.');
        return;
      }
      btnOrderScanOCR.disabled = true;
      btnOrderScanOCR.innerText = 'Memindai Google Lens + AI...';
      if (boxOrderOCRProgress) {
        boxOrderOCRProgress.style.display = 'block';
        if (lblOrderOCRStep) lblOrderOCRStep.innerText = '1/2: Memindai teks foto dengan Google Lens...';
      }

      try {
        const apiKey = localStorage.getItem('gemini_api_key') || (txtOrderApiKey ? txtOrderApiKey.value.trim() : '');
        let pth = '';
        try {
          if (window.corelAPI?.getPathForFile && orderImageFile) {
            pth = window.corelAPI.getPathForFile(orderImageFile);
          }
        } catch {}

        const defaultSponsor = txtOrderDefaultSponsor ? txtOrderDefaultSponsor.value.trim() : '';
        const caseMode = selOrderCaseTransform ? selOrderCaseTransform.value : 'asis';

        // 1. Preferred Route: Combined Google Lens + Gemini AI
        if (window.corelAPI?.aiScanJerseyImage && apiKey) {
          if (lblOrderOCRStep) lblOrderOCRStep.innerText = 'Memproses foto dengan Google Lens & AI...';
          const res = await window.corelAPI.aiScanJerseyImage({
            imageBase64: orderImageBase64,
            imagePath: pth || orderImageFile?.path || '',
            apiKey,
            defaultSponsor,
            caseMode
          });

          if (res.success && Array.isArray(res.items) && res.items.length > 0) {
            orderItems = healJoinedNameVariations(res.items, res.lensRawText || '');
            if (res.lensRawText && preOrderLensRaw) {
              preOrderLensRaw.innerText = res.lensRawText;
              if (boxOrderLensRawWrap) boxOrderLensRawWrap.style.display = 'block';
            }
            if (txtOrderRawInput && res.lensRawText) {
              txtOrderRawInput.value = res.lensRawText;
            }
            updateFilterSizeDropdown();
            renderOrderTable();
            showToast(`Selesai! Berhasil merapihkan ${orderItems.length} pesanan dengan Google Lens + AI!`, true);
            return;
          } else if (!res.success) {
            throw new Error(res.message || 'Gagal memproses gambar.');
          }
        }

        // 2. Direct Google Lens OCR Scan
        if (window.corelAPI?.scanGoogleLens) {
          if (lblOrderOCRStep) lblOrderOCRStep.innerText = '1/2: Memindai teks dengan Google Lens...';
          const lensRes = await window.corelAPI.scanGoogleLens({
            imageBase64: orderImageBase64,
            imagePath: pth || orderImageFile?.path || ''
          });

          if (lensRes.success && lensRes.text) {
            if (preOrderLensRaw) preOrderLensRaw.innerText = lensRes.text;
            if (boxOrderLensRawWrap) boxOrderLensRawWrap.style.display = 'block';
            if (txtOrderRawInput) txtOrderRawInput.value = lensRes.text.trim();

            if (apiKey && window.corelAPI?.aiParseJerseyText) {
              if (lblOrderOCRStep) lblOrderOCRStep.innerText = '2/2: Merapihkan dengan AI Gemini...';
              const aiRes = await window.corelAPI.aiParseJerseyText({
                rawText: lensRes.text,
                apiKey,
                defaultSponsor,
                caseMode
              });
              if (aiRes.success && Array.isArray(aiRes.items) && aiRes.items.length > 0) {
                orderItems = healJoinedNameVariations(aiRes.items, lensRes.text);
                updateFilterSizeDropdown();
                renderOrderTable();
                showToast(`Selesai! Google Lens + AI berhasil mengekstrak ${orderItems.length} pesanan!`, true);
                return;
              }
            }

            // Local fallback if no API key
            const parsed = healJoinedNameVariations(parseJerseyOrderList(lensRes.text), lensRes.text);
            if (parsed.length > 0) {
              orderItems = parsed.map((item, index) => ({ ...item, id: index + 1 }));
              updateFilterSizeDropdown();
              renderOrderTable();
              showToast(`Google Lens berhasil mendeteksi ${orderItems.length} pesanan!`, true);
              return;
            }
          }
        }

        alert('Gagal mendeteksi teks dari gambar. Pastikan foto jelas dan periksa kembali API Key Gemini.');
      } catch (err) {
        showToast('Error: ' + err.message, false);
        alert('Terjadi kesalahan:\n' + err.message);
      } finally {
        btnOrderScanOCR.disabled = false;
        btnOrderScanOCR.innerText = 'Pindai & Rapihkan Foto';
        if (boxOrderOCRProgress) boxOrderOCRProgress.style.display = 'none';
      }
    });
  }

  // Direct Table Parser (Supports Markdown tables from Web Gemini and TSV from Excel/Google Sheets)
  function parseTableInput(rawText) {
    if (!rawText || typeof rawText !== 'string') return null;
    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return null;

    const isMarkdownTable = lines.some(l => l.startsWith('|') && l.endsWith('|') && l.includes('|'));
    const isTSV = lines.some(l => l.includes('\t'));

    if (!isMarkdownTable && !isTSV) return null;

    const rows = [];
    for (let line of lines) {
      if (/^\|?[\s\-:]+(\|[\s\-:]+)+\|?$/.test(line)) continue;

      let cells;
      if (isMarkdownTable) {
        cells = line.split('|').map(c => c.trim());
        if (line.startsWith('|')) cells.shift();
        if (line.endsWith('|')) cells.pop();
      } else {
        cells = line.split('\t').map(c => c.trim());
      }

      if (cells.length >= 2) {
        rows.push(cells);
      }
    }

    if (rows.length === 0) return null;

    const headerRow = rows[0];
    let hasHeader = false;
    let colNameIdx = -1;
    let colNoIdx = -1;
    let colSizeIdx = -1;
    let colDadaIdx = -1;
    let colNoteIdx = -1;

    headerRow.forEach((col, idx) => {
      const c = col.toLowerCase().trim();
      if (/^(?:nama|name|nama\s*punggung|punggung|nama\s*pemain|player)$/i.test(c)) {
        colNameIdx = idx;
      } else if (/^(?:no\.?\s*punggung|nomor|nomer|no\.?|#)$/i.test(c)) {
        if (colNoIdx === -1 || /punggung/i.test(c)) {
          colNoIdx = idx;
        }
      } else if (/^(?:ukuran|size|uk\.?|sz\.?)$/i.test(c)) {
        colSizeIdx = idx;
      } else if (/^(?:dada|nama\s*dada|depan)$/i.test(c)) {
        colDadaIdx = idx;
      } else if (/^(?:keterangan|catatan|posisi|note|ket\.?)$/i.test(c)) {
        colNoteIdx = idx;
      }
    });

    if (colNameIdx !== -1 && (colSizeIdx !== -1 || colNoIdx !== -1)) {
      hasHeader = true;
    } else {
      if (headerRow.length === 4 && /^\d+$/.test(rows[0][0])) {
        colNameIdx = 1;
        colNoIdx = 2;
        colSizeIdx = 3;
      } else if (headerRow.length === 3) {
        colNameIdx = 0;
        colNoIdx = 1;
        colSizeIdx = 2;
      }
    }

    if (colNameIdx === -1 && colSizeIdx === -1 && colNoIdx === -1) {
      return null;
    }

    const dataRows = hasHeader ? rows.slice(1) : rows;
    const items = [];

    for (let r of dataRows) {
      let rawName = colNameIdx !== -1 && r[colNameIdx] !== undefined ? r[colNameIdx] : '';
      let rawNo = colNoIdx !== -1 && r[colNoIdx] !== undefined ? r[colNoIdx] : '-';
      let rawSize = colSizeIdx !== -1 && r[colSizeIdx] !== undefined ? r[colSizeIdx] : 'L';
      let rawDada = colDadaIdx !== -1 && r[colDadaIdx] !== undefined ? r[colDadaIdx] : '';
      let rawNote = colNoteIdx !== -1 && r[colNoteIdx] !== undefined ? r[colNoteIdx] : '';

      let nama = cleanPlayerName(rawName);
      let nomor = cleanPlayerNumber(rawNo);
      let ukuran = cleanPlayerSize(rawSize);

      if (nama) {
        items.push({
          nama,
          nama_punggung: nama,
          nomor,
          ukuran,
          nama_dada: rawDada ? cleanPlayerName(rawDada) : '',
          dada: rawDada ? cleanPlayerName(rawDada) : '',
          posisi: rawNote || '',
          sponsor: ''
        });
      }
    }

    if (items.length > 0) {
      items.sort((a, b) => getJerseySizeRank(a.ukuran) - getJerseySizeRank(b.ukuran));
      return items;
    }
    return null;
  }

  // Text Parsing Function (Supports Single-Line, Multi-Line Blocks, Dada vs Punggung, Celana, Kiper, Tanpa Nomor)
  function parseJerseyOrderList(rawText) {
    if (!rawText || typeof rawText !== 'string') return [];

    // 0. Direct Table Parser (Markdown table from Gemini Web or Excel TSV)
    const tableItems = parseTableInput(rawText);
    if (tableItems && tableItems.length > 0) {
      return tableItems;
    }

    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return [];

    // Filter out document/sponsor/table header lines
    const cleanLines = [];
    for (const l of lines) {
      if (/^(?:LIS|LIST|DAFTAR|PESANAN|ORDER|DATA\s+JERSEY|TIM|SPONSOR\s+DEPAN)\b/i.test(l) && !/\b(?:no|nomor|uk|ukuran|size)\b/i.test(l)) {
        continue;
      }
      if (/^(?:#\s*|NO\.?\s*|\d+\s*)?(?:NAMA|NAME)\s+(?:#\s*|NO\.?\s*|\d+\s*)?(?:UKURAN|SIZE|UK)\b/i.test(l) || /^(?:NAMA|NAME)\s+(?:UKURAN|SIZE|UK)\b/i.test(l)) {
        continue;
      }
      cleanLines.push(l);
    }

    // Check if multi-line block format exists
    const isMultiLineBlock = cleanLines.some((l, i) => {
      return /^\d+[:.]\s*[A-Za-z]/.test(l) && cleanLines[i + 1] && /^(?:No|Nomor|#|Uk|Size|Ukuran|Dada|Punggung|Celana)/i.test(cleanLines[i + 1]);
    }) || cleanLines.some(l => /^(?:Punggung|Nama\s*Punggung|Nama\s*Depan|Dada|Nama\s*Dada)[:=\s]/i.test(l));

    if (isMultiLineBlock) {
      const blocks = [];
      let currentBlock = [];

      for (let i = 0; i < cleanLines.length; i++) {
        const line = cleanLines[i];
        const isNewNumbered = /^\s*(?:\[\s*\d+\s*\]|\d+[\.\)\-:]\s*)/.test(line);
        const isLabelStart = /^(?:Punggung|Nama\s*Punggung|Nama\s*Depan|Nama\s*Pemain|Nama)[:\s]/i.test(line);

        if ((isNewNumbered || isLabelStart) && currentBlock.length > 0) {
          blocks.push(currentBlock);
          currentBlock = [];
        } else if (currentBlock.length > 0 && /^(?:No|Nomor|Uk|Ukuran|Size|Dada|Depan|Celana|Catatan|Ket)[:\s]/i.test(line)) {
          // Continuation of current block
        } else if (currentBlock.length >= 3 && !/^(?:No|Nomor|Uk|Ukuran|Size|Dada|Depan|Celana|Catatan|Ket)[:\s]/i.test(line)) {
          blocks.push(currentBlock);
          currentBlock = [];
        }

        currentBlock.push(line);
      }
      if (currentBlock.length > 0) blocks.push(currentBlock);

      const parsedItems = [];
      for (const block of blocks) {
        const fullBlockText = block.join(' \n ');
        const item = parseSinglePlayerRecord(fullBlockText, block);
        if (item && item.nama) {
          parsedItems.push(item);
        }
      }

      if (parsedItems.length > 0) {
        parsedItems.sort((a, b) => getJerseySizeRank(a.ukuran) - getJerseySizeRank(b.ukuran));
        return parsedItems;
      }
    }

    // Standard Single-Line Parser (e.g. "1. Adi - 07 - M" or "Dimas // 10 // L")
    const items = [];
    const headerSizeRegex = /^(?:SIZE|UKURAN|UK|SZ)?\s*[:=-]?\s*(7XL|6XL|5XL|4XL|XXXXL|3XL|XXXL|XXL|2XL|XL|L|M|S|XS|XXS|S\s*ANAK|M\s*ANAK|L\s*ANAK|XL\s*ANAK|XXL\s*ANAK)\s*(?:\([^)]*\))?\s*[:=-]?$/i;
    const sizeTokenRegex = /^(?:SIZE|UKURAN|UK|SZ)?\s*[:=-]?\s*(7XL|6XL|5XL|4XL|XXXXL|3XL|XXXL|XXL|2XL|XL|L|M|S|XS|XXS|S\s*ANAK|M\s*ANAK|L\s*ANAK|XL\s*ANAK|XXL\s*ANAK)$/i;

    let currentGroupSize = '';

    for (let rawLine of cleanLines) {
      let line = rawLine.trim();
      if (!line) continue;

      const headerMatch = line.match(headerSizeRegex);
      if (headerMatch) {
        currentGroupSize = normalizeJerseySize(headerMatch[1]);
        continue;
      }

      const item = parseLineDelimited(line, currentGroupSize, sizeTokenRegex);
      if (item) {
        items.push(item);
      }
    }

    items.sort((a, b) => getJerseySizeRank(a.ukuran) - getJerseySizeRank(b.ukuran));
    return items;
  }

  function parseSinglePlayerRecord(fullText, blockLines) {
    let nama = '';
    let nomor = '';
    let ukuran = '';
    let namaDada = '';
    let catatanArr = [];

    // 1. Explicit Dada / Depan pattern
    const mDada = fullText.match(/(?:dada(?:\s*depan)?|nama\s*dada|depan)\s*[:=-]?\s*([A-Za-z0-9\s'\.\-_]+?)(?=[,\/\n\|\)]|$|\s+(?:punggung|no|uk|size|celana))/i);
    if (mDada && mDada[1]) {
      namaDada = mDada[1].trim();
    }

    // 2. Explicit Punggung / Nama Belakang pattern
    const mPunggung = fullText.match(/(?:punggung|nama\s*punggung|nama\s*belakang|nama\s*pemain|nama)\s*[:=-]?\s*([A-Za-z0-9\s'\.\-_]+?)(?=[,\/\n\|\)]|$|\s+(?:dada|depan|no|uk|size|celana))/i);
    if (mPunggung && mPunggung[1]) {
      nama = mPunggung[1].trim();
    }

    // 3. Explicit Ukuran / Size pattern
    const mSize = fullText.match(/(?:uk(?:uran)?|size|sz)\s*[:=\-\/]?\s*(7XL|6XL|5XL|4XL|3XL|XXL|2XL|XL|L|M|S|XS|XXS)(?:\s*(?:anak(?:-anak)?|"|'))?/i);
    if (mSize) {
      let rawSz = mSize[1].toUpperCase();
      if (/anak/i.test(mSize[0])) rawSz += ' ANAK';
      ukuran = normalizeJerseySize(rawSz);
    }

    // 4. Nomor pattern
    if (/tanpa\s*no(?:mor)?|ga\s*pake\s*no(?:mor)?|no\s*nomor/i.test(fullText)) {
      nomor = '-';
    } else {
      const mNo = fullText.match(/(?:no(?:\.?\s*punggung)?|nomor|nomer|#)\s*[:=\-\/]?\s*(\d{1,4})/i);
      if (mNo) {
        nomor = mNo[1];
      }
    }

    // 5. Celana pattern
    const mCelana = fullText.match(/celana\s*[:=-]?\s*([A-Za-z0-9\s]+?)(?=[,\/\n\|\)]|$)/i);
    if (mCelana) {
      catatanArr.push(`Celana: ${mCelana[1].trim()}`);
    }

    // 6. Role / Posisi / Keterangan
    if (/kiper|gk|goalkeeper/i.test(fullText)) catatanArr.push('GK Kiper');
    if (/kapten|\(c\)/i.test(fullText)) catatanArr.push('Kapten');
    if (/tangan\s*panjang|lengan\s*panjang/i.test(fullText)) catatanArr.push('Lengan Panjang');
    if (/tanpa\s*lengan/i.test(fullText)) catatanArr.push('Tanpa Lengan');

    // If nama not found from label, extract from first line
    if (!nama && blockLines.length > 0) {
      let firstLine = blockLines[0];
      firstLine = firstLine.replace(/^\s*(?:\[\s*\d+\s*\]|\d+[\.\)\-:]\s*)/, '').trim();

      const parts = firstLine.split(/\s*(?:\/\/|\s+-\s+|\/)\s*/);
      if (parts.length > 1) {
        nama = parts[0].trim();
        for (let p of parts.slice(1)) {
          if (!nomor && /^\d{1,4}$/.test(p)) nomor = p;
          if (!ukuran && /(?:7XL|6XL|5XL|4XL|3XL|XXL|2XL|XL|L|M|S|XS|XXS)/i.test(p)) {
            ukuran = normalizeJerseySize(p);
          }
        }
      } else {
        firstLine = firstLine.replace(/\(.*\)/, '').replace(/no\s*\d+/i, '').replace(/uk\s*\w+/i, '').trim();
        nama = firstLine;
      }
    }

    nama = cleanPlayerName(nama);
    nomor = cleanPlayerNumber(nomor);
    ukuran = cleanPlayerSize(ukuran);
    if (!ukuran) ukuran = 'L';
    if (!nomor) nomor = '-';
    if (!nama) {
      nama = nomor !== '-' ? `PEMAIN ${nomor}` : 'PEMAIN';
    }

    let finalCatatan = catatanArr.join(', ');
    if (namaDada) {
      finalCatatan = `Dada: ${cleanPlayerName(namaDada)}` + (finalCatatan ? ` | ${finalCatatan}` : '');
    }

    return {
      nama,
      nomor,
      ukuran,
      posisi: finalCatatan,
      sponsor: ''
    };
  }

  function parseLineDelimited(line, fallbackSize, sizeTokenRegex) {
    let text = line.trim();
    // Remove leading numbering with dot, paren, dash, colon, OR whitespace when followed by letters
    text = text.replace(/^\s*(?:\[\s*\d+\s*\]|\d+[\.\)\-:]\s*|\d+\s+(?=[A-Za-z\(\[\{])|\*\s*)/, '').trim();
    if (!text) return null;

    let nama = '';
    let nomor = '';
    let size = '';
    let extraNotes = [];
    let namaDada = '';

    // Check for explicit Dada
    const mDada = text.match(/(?:dada(?:\s*depan)?|nama\s*dada|depan)\s*[:=-]?\s*([A-Za-z0-9\s'\.\-_]+?)(?=[,\/\n\|\)]|$|\s+(?:punggung|no|uk|size|celana))/i);
    if (mDada) {
      namaDada = cleanPlayerName(mDada[1]);
      text = text.replace(mDada[0], ' ');
    }

    // Check for explicit Celana
    const mCelana = text.match(/celana\s*[:=-]?\s*([A-Za-z0-9\s]+?)(?=[,\/\n\|\)]|$)/i);
    if (mCelana) {
      extraNotes.push(`Celana: ${mCelana[1].trim()}`);
      text = text.replace(mCelana[0], ' ');
    }

    if (/tanpa\s*no(?:mor)?|ga\s*pake\s*no(?:mor)?|no\s*nomor/i.test(text)) {
      nomor = '-';
      text = text.replace(/tanpa\s*no(?:mor)?|ga\s*pake\s*no(?:mor)?|no\s*nomor/gi, ' ');
    }

    // Check for labeled Nomor (e.g. "Nomer 28", "No. 07", "#14")
    const mLabNo = text.match(/(?:NO\.?|NOMOR|NOMER|#)\s*[:=-]?\s*(\d{1,4})/i);
    if (mLabNo) {
      nomor = mLabNo[1];
      text = text.replace(mLabNo[0], ' ');
    }

    // Detect size in parentheses/brackets: e.g. ( L ), (XL), [M], (S)
    const mParenSize = text.match(/[\(\[\{]\s*(7XL|6XL|5XL|4XL|XXXXL|3XL|XXXL|XXL|2XL|XL|L|M|S|XS|XXS|S\s*ANAK|M\s*ANAK|L\s*ANAK|XL\s*ANAK|XXL\s*ANAK)\s*[\)\]\}]/i);
    if (mParenSize) {
      size = cleanPlayerSize(mParenSize[1]);
      text = text.replace(mParenSize[0], ' ');
    }

    // Check labeled size (e.g. "Size: L", "Ukuran XL", "Uk. M")
    if (!size) {
      const mLabSize = text.match(/(?:SIZE|UKURAN|UK\.?|SZ\.?)\s*[:=-]?\s*(7XL|6XL|5XL|4XL|XXXXL|3XL|XXXL|XXL|2XL|XL|L|M|S|XS|XXS|S\s*ANAK|M\s*ANAK|L\s*ANAK|XL\s*ANAK|XXL\s*ANAK)\b/i);
      if (mLabSize) {
        size = cleanPlayerSize(mLabSize[1]);
        text = text.replace(mLabSize[0], ' ');
      }
    }

    // Detect delimiter
    let delimiter = null;
    if (text.includes('//')) delimiter = '//';
    else if (text.includes('\t')) delimiter = '\t';
    else if (text.includes('|')) delimiter = '|';
    else if (text.includes('/')) delimiter = '/';
    else if (/\s+-\s+/.test(text)) delimiter = '-';
    else if (text.includes(',') && !text.match(/^(?:nama|name)/i)) delimiter = ',';

    if (delimiter) {
      const parts = text.split(delimiter === '-' ? /\s+-\s+/ : (delimiter === '//' ? /\/\// : delimiter)).map(p => p.trim()).filter(Boolean);
      const unassignedWords = [];

      for (let part of parts) {
        if (!size && sizeTokenRegex.test(part)) {
          const m = part.match(sizeTokenRegex);
          size = cleanPlayerSize(m[1]);
          continue;
        }
        const labSize = part.match(/(?:SIZE|UKURAN|UK\.?|SZ\.?)\s*[:=-]?\s*([A-Z0-9]+(?:\s*ANAK)?)/i);
        if (!size && labSize) {
          size = cleanPlayerSize(labSize[1]);
          continue;
        }
        const labNo = part.match(/(?:NO\.?|NOMOR|NOMER|#)\s*[:=-]?\s*(\d{1,4})/i);
        if (!nomor && labNo) {
          nomor = labNo[1];
          continue;
        }
        const pureNo = part.match(/^[\(\[\{]?\s*(\d{1,4})\s*[\)\]\}]?$/);
        if (!nomor && pureNo) {
          nomor = pureNo[1];
          continue;
        }

        unassignedWords.push(part);
      }

      if (unassignedWords.length > 0) {
        nama = unassignedWords[0];
      }
      if (unassignedWords.length > 1) {
        extraNotes.push(unassignedWords.slice(1).join(' - '));
      }
    } else {
      // Space-separated token parsing
      // Size at the very END of line (e.g. "Ferdi 007 M" or "Vera S 022 M" -> "M" is at the end)
      if (!size) {
        const mEndSize = text.match(/(?:^|\s)(7XL|6XL|5XL|4XL|XXXXL|3XL|XXXL|XXL|2XL|XL|L|M|S|XS|XXS|S\s*ANAK|M\s*ANAK|L\s*ANAK|XL\s*ANAK|XXL\s*ANAK)\s*$/i);
        if (mEndSize) {
          size = cleanPlayerSize(mEndSize[1]);
          text = text.substring(0, mEndSize.index).trim();
        }
      }

      if (!nomor) {
        const mParen = text.match(/[\(\[\{]\s*(\d{1,4})\s*[\)\]\}]/);
        if (mParen) {
          nomor = mParen[1];
          text = text.replace(mParen[0], ' ');
        } else {
          // Standalone number ONLY if strictly separated by whitespace and at least 2 tokens exist
          // (e.g. "Budi 10" -> "10" is nomor; but "Padli-046", "SYARIF_007", or "74" as sole token is NAME!)
          const words = text.trim().split(/\s+/).filter(Boolean);
          if (words.length >= 2) {
            let numIdx = -1;
            for (let i = words.length - 1; i >= 0; i--) {
              if (/^\d{1,4}$/.test(words[i])) {
                numIdx = i;
                break;
              }
            }
            if (numIdx !== -1) {
              nomor = words[numIdx];
              words.splice(numIdx, 1);
              text = words.join(' ');
            }
          }
        }
      }

      // If size still not found, search anywhere
      if (!size) {
        const mSize = text.match(/\b(7XL|6XL|5XL|4XL|XXXXL|3XL|XXXL|XXL|2XL|XL|L|M|S|XS|XXS|S\s*ANAK|M\s*ANAK|L\s*ANAK|XL\s*ANAK|XXL\s*ANAK)\b/i);
        if (mSize) {
          size = cleanPlayerSize(mSize[1]);
          const idx = mSize.index;
          text = text.substring(0, idx) + ' ' + text.substring(idx + mSize[0].length);
        }
      }

      // Check for item notes like HOODIE, SWEATER, etc.
      const rawWords = text.trim().split(/\s+/).filter(Boolean);
      const remainingNameWords = [];
      for (const w of rawWords) {
        if (/^(?:HOODIE|SWEATER|JAKET|JERSEY|KAOS)$/i.test(w)) {
          extraNotes.push(w.toUpperCase());
        } else {
          remainingNameWords.push(w);
        }
      }
      nama = remainingNameWords.join(' ').trim();
    }

    nama = cleanPlayerName(nama);
    nomor = cleanPlayerNumber(nomor);
    if (!size && fallbackSize) size = fallbackSize;
    size = cleanPlayerSize(size);
    if (!size) size = 'L';
    if (!nomor) nomor = '-';
    if (!nama) {
      nama = nomor !== '-' ? `PEMAIN ${nomor}` : 'PEMAIN';
    }

    let finalPosisi = extraNotes.join(', ');
    if (namaDada) {
      finalPosisi = `Dada: ${namaDada}` + (finalPosisi ? ` | ${finalPosisi}` : '');
    }

    return {
      nama,
      nomor,
      ukuran: size,
      posisi: finalPosisi,
      sponsor: ''
    };
  }

  function healJoinedNameVariations(items, rawText) {
    if (!Array.isArray(items)) return items;
    return items.map((it) => {
      let nama = cleanPlayerName(it.nama_punggung || it.nama || '');
      let namaDada = cleanPlayerName(it.nama_dada || it.dada || '');
      let nomor = cleanPlayerNumber(it.nomor);
      let ukuran = cleanPlayerSize(it.ukuran || it.size || 'L');

      if (rawText && nomor && nomor !== '-') {
        // 1. Check if name and number were joined with '-' or '_' in rawText (e.g. Padli-046, SYARIF_007)
        if (nama && nama !== '-') {
          const escapedName = nama.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const escapedNum = nomor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const numPattern = '0*' + escapedNum.replace(/^0+/, '');
          const regexJoined = new RegExp('(\\b' + escapedName + ')([-_])(' + numPattern + '\\b)', 'i');
          const match = rawText.match(regexJoined);
          if (match) {
            nama = match[0];
            nomor = '-';
          }
        }

        // 2. Check if number was actually the player name (e.g. "6. 74 ( M )")
        if (!nama || nama === '-' || nama === 'PEMAIN') {
          const escapedNum = nomor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regexSoleNumber = new RegExp('^\\s*(?:\\[\\s*\\d+\\s*\\]|\\d+[\\.\\)\\-:]\\s*)?(' + escapedNum + ')\\s*(?:\\([\\s\\S]*?\\)|[A-Z0-9]+)?\\s*$', 'im');
          const matchSole = rawText.match(regexSoleNumber);
          if (matchSole) {
            nama = matchSole[1];
            nomor = '-';
          }
        }
      }
      return {
        ...it,
        nama,
        nama_punggung: nama,
        nama_dada: namaDada,
        dada: namaDada,
        nomor,
        ukuran
      };
    });
  }

  async function parseAndPopulateOrders() {
    if (!txtOrderRawInput) return;
    const raw = txtOrderRawInput.value.trim();
    if (!raw) {
      alert('Masukkan atau tempel list pesanan terlebih dahulu.');
      return;
    }

    // 0. Instant Route: If input is a structured table (Markdown from Web Gemini or TSV from Excel)
    const tableDirect = parseTableInput(raw);
    if (tableDirect && tableDirect.length > 0) {
      orderItems = tableDirect.map((item, index) => ({
        ...item,
        originalIndex: index
      }));
      orderShowDada = orderItems.some(it => !!(it.nama_dada || it.dada));
      updateFilterSizeDropdown();
      renderOrderTable();
      showToast(`Berhasil memuat ${orderItems.length} pesanan langsung dari Tabel (100% Akurat, Tanpa Typo)!`, true);
      return;
    }

    const apiKey = localStorage.getItem('gemini_api_key') || (txtOrderApiKey ? txtOrderApiKey.value.trim() : '');
    const defaultSponsor = txtOrderDefaultSponsor ? txtOrderDefaultSponsor.value.trim() : '';
    const caseMode = selOrderCaseTransform ? selOrderCaseTransform.value : 'asis';

    // 1. Primary Route: Gemini AI Parsing
    if (apiKey && window.corelAPI?.aiParseJerseyText) {
      if (btnOrderParseNow) {
        btnOrderParseNow.disabled = true;
        btnOrderParseNow.innerText = 'AI Sedang Merapihkan List...';
      }
      try {
        const res = await window.corelAPI.aiParseJerseyText({
          rawText: raw,
          apiKey,
          defaultSponsor,
          caseMode
        });
        if (res.success && Array.isArray(res.items) && res.items.length > 0) {
          orderItems = healJoinedNameVariations(res.items, raw);
          orderShowDada = orderItems.some(it => !!(it.nama_dada || it.dada));
          updateFilterSizeDropdown();
          renderOrderTable();
          showToast(`Berhasil merapihkan ${orderItems.length} pesanan dengan AI Gemini (Mode Online)!`, true);
          return;
        } else if (!res.success) {
          console.warn('AI Parsing warning:', res.message);
        }
      } catch (err) {
        console.warn('AI Parsing error, falling back to local parser:', err);
      } finally {
        if (btnOrderParseNow) {
          btnOrderParseNow.disabled = false;
          btnOrderParseNow.innerText = 'Rapihkan & Urutkan List';
        }
      }
    }

    // 2. Heuristic Local Parser Fallback (Offline Mode)
    const parsed = healJoinedNameVariations(parseJerseyOrderList(raw), raw);
    if (parsed.length === 0) {
      alert('Tidak ada baris pesanan yang dapat dikenali. Periksa kembali format teks atau masukkan API Key Gemini.');
      return;
    }

    orderItems = parsed.map((item, index) => ({
      ...item,
      originalIndex: index
    }));
    orderShowDada = orderItems.some(it => !!(it.nama_dada || it.dada));

    updateFilterSizeDropdown();
    renderOrderTable();
    showToast(`Berhasil merapihkan ${orderItems.length} pesanan dengan Algoritma Lokal (Mode Offline)!`, true);
  }

  if (btnOrderParseNow) {
    btnOrderParseNow.addEventListener('click', parseAndPopulateOrders);
  }

  if (btnOrderPasteText) {
    btnOrderPasteText.addEventListener('click', async () => {
      try {
        const clipText = await navigator.clipboard.readText();
        if (clipText && txtOrderRawInput) {
          txtOrderRawInput.value = clipText;
          showToast('Teks berhasil ditempel dari clipboard.');
        }
      } catch (err) {
        showToast('Gunakan tombol Ctrl+V pada kotak teks.', false);
      }
    });
  }

  if (btnOrderClearText) {
    btnOrderClearText.addEventListener('click', () => {
      if (txtOrderRawInput) txtOrderRawInput.value = '';
    });
  }

  if (btnOrderLoadSample) {
    btnOrderLoadSample.addEventListener('click', () => {
      if (txtOrderRawInput) {
        txtOrderRawInput.value = `LIST PESANAN JERSEY TIM GARUDA UNITED
Sponsor Depan: PT INDO MAJU JAYA

1. Budi Santoso no 10, ukuran L (dada: KAPTI, tangan panjang)
Punggung: EKO PRASETYO
Dada: EKO
No: 07
Uk: M
Ket: GK Kiper

3. Dimas // 09 // XL // Depan: POLRESTABES
Siti Rahma - uk S (tanpa nomor, dada: OFFICIAL)

5:MUHAMMAD RIZKY
nomor: 99
ukuran: XXL
nama dada: RIZKY 99
catatan: kapten tim

Fahri 04 L
7. AHMAD DHANI / NO 17 / UKURAN XL / DADA: DEWA 19 / CELANA: L
8) Hendra tanpa nomor ukuran M (dada: COACH)
9. YUDHA No.08 Size: M anak (dada: YUDHA JR)

10. KEVIN SANJAYA
Punggung: SANJAYA
Dada: KEVIN
No: 01
Uk: L
Catatan: Lengan Panjang

11. Bayu - nomor 23 - xxl anak - depan: BINTANG KECIL
12. ARIS (Dada: ARIS, Punggung: A. KURNIAWAN, No: 12, Size: 3XL)
13. Rian no 05 uk L
14. Bambang Pamungkas (20) XL Striker
15. Bagas #02 Size S (dada: GFX RUNNER)`;
        parseAndPopulateOrders();
      }
    });
  }

  function updateFilterSizeDropdown() {
    if (!selOrderFilterSize) return;
    const currentVal = selOrderFilterSize.value;
    const sizeCounts = {};
    orderItems.forEach(it => {
      const sz = it.ukuran || 'L';
      sizeCounts[sz] = (sizeCounts[sz] || 0) + 1;
    });

    const uniqueSizes = Object.keys(sizeCounts).sort((a, b) => getJerseySizeRank(a) - getJerseySizeRank(b));
    let html = `<option value="ALL">Semua Ukuran (${orderItems.length} Total)</option>`;
    uniqueSizes.forEach(sz => {
      html += `<option value="${sz}">Ukuran ${sz} (${sizeCounts[sz]} Pcs)</option>`;
    });

    selOrderFilterSize.innerHTML = html;
    if (uniqueSizes.includes(currentVal)) {
      selOrderFilterSize.value = currentVal;
    } else {
      selOrderFilterSize.value = 'ALL';
    }
  }

  function getProcessedOrderItems() {
    let items = [...orderItems];
    const caseMode = selOrderCaseTransform ? selOrderCaseTransform.value : 'asis';
    const sortMode = selOrderSortMode ? selOrderSortMode.value : 'size_asc';
    const filterSize = selOrderFilterSize ? selOrderFilterSize.value : 'ALL';

    // 1. Filter Size
    if (filterSize !== 'ALL') {
      items = items.filter(it => (it.ukuran || 'L') === filterSize);
    }

    // 2. Sort
    items.sort((a, b) => {
      if (sortMode === 'size_asc') {
        const diff = getJerseySizeRank(a.ukuran) - getJerseySizeRank(b.ukuran);
        if (diff !== 0) return diff;
        return (parseInt(a.nomor, 10) || 0) - (parseInt(b.nomor, 10) || 0);
      }
      if (sortMode === 'size_desc') {
        const diff = getJerseySizeRank(b.ukuran) - getJerseySizeRank(a.ukuran);
        if (diff !== 0) return diff;
        return (parseInt(a.nomor, 10) || 0) - (parseInt(b.nomor, 10) || 0);
      }
      if (sortMode === 'nomor_asc') {
        return (parseInt(a.nomor, 10) || 0) - (parseInt(b.nomor, 10) || 0);
      }
      if (sortMode === 'nomor_desc') {
        return (parseInt(b.nomor, 10) || 0) - (parseInt(a.nomor, 10) || 0);
      }
      if (sortMode === 'nama_asc') {
        return String(a.nama_punggung || a.nama || '').localeCompare(String(b.nama_punggung || b.nama || ''));
      }
      if (sortMode === 'nama_desc') {
        return String(b.nama_punggung || b.nama || '').localeCompare(String(a.nama_punggung || a.nama || ''));
      }
      return (a.originalIndex || 0) - (b.originalIndex || 0);
    });

    return items;
  }

  function renderOrderTable() {
    if (!tbodyOrderResult) return;
    const items = getProcessedOrderItems();
    const caseMode = selOrderCaseTransform ? selOrderCaseTransform.value : 'asis';

    // Update Total Counter
    if (lblOrderTotalCount) {
      lblOrderTotalCount.innerText = `${orderItems.length} Pcs`;
    }

    // Update Size Chips
    if (boxOrderSizeChips) {
      if (orderItems.length === 0) {
        boxOrderSizeChips.innerHTML = '<span style="font-size: 10.5px; color: var(--text-dim); font-style: italic;">Belum ada data. Masukkan list di samping lalu klik "Rapihkan".</span>';
      } else {
        const counts = {};
        orderItems.forEach(it => {
          const sz = it.ukuran || 'L';
          counts[sz] = (counts[sz] || 0) + 1;
        });
        const sortedSizes = Object.keys(counts).sort((a, b) => getJerseySizeRank(a) - getJerseySizeRank(b));
        boxOrderSizeChips.innerHTML = sortedSizes.map(sz => `
          <div class="size-chip-btn" data-filter-sz="${sz}" style="display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 12px; background: rgba(59, 130, 246, 0.12); border: 1px solid rgba(59, 130, 246, 0.3); font-size: 11px; cursor: pointer;">
            <b style="color: var(--accent-blue);">${sz}:</b>
            <span style="color: #ffffff; font-weight: 700;">${counts[sz]}</span>
          </div>
        `).join('');

        boxOrderSizeChips.querySelectorAll('[data-filter-sz]').forEach(chip => {
          chip.addEventListener('click', () => {
            const sz = chip.getAttribute('data-filter-sz');
            if (selOrderFilterSize) {
              selOrderFilterSize.value = (selOrderFilterSize.value === sz) ? 'ALL' : sz;
              renderOrderTable();
            }
          });
        });
      }
    }

    // Check duplicate numbers
    const numCounts = {};
    orderItems.forEach(it => {
      const no = String(it.nomor || '').trim();
      if (no && no !== '-') {
        numCounts[no] = (numCounts[no] || 0) + 1;
      }
    });
    const duplicateNumbers = Object.keys(numCounts).filter(no => numCounts[no] > 1);
    const boxAlert = document.getElementById('boxOrderValidationAlerts');
    if (boxAlert) {
      if (duplicateNumbers.length > 0) {
        boxAlert.style.display = 'block';
        boxAlert.innerHTML = `⚠️ <b>Peringatan Nomor Kembar:</b> Nomor ${duplicateNumbers.map(n => `<span style="background: rgba(239, 68, 68, 0.25); padding: 1px 5px; border-radius: 3px; font-weight: 700;">#${n} (${numCounts[n]}x)</span>`).join(', ')} digunakan lebih dari satu pemain. Silakan periksa kembali sebelum masuk CorelDRAW.`;
      } else {
        boxAlert.style.display = 'none';
        boxAlert.innerHTML = '';
      }
    }

    // Render Dynamic thead
    const thead = document.getElementById('theadOrderResult');
    if (thead) {
      let thHtml = `<tr>
        <th style="width: 35px;">No</th>
        <th>Nama Punggung</th>`;
      if (orderShowDada) {
        thHtml += `<th style="width: 115px;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <span>Nama Dada</span>
            <button type="button" id="btnHideOrderDada" style="background: none; border: none; color: var(--text-dim); cursor: pointer; font-size: 9px; padding: 0;" title="Sembunyikan kolom Nama Dada">✕</button>
          </div>
        </th>`;
      }
      thHtml += `<th style="width: 85px;">Nomor</th>
        <th style="width: 95px;">Ukuran</th>
        <th style="width: 110px;">Catatan</th>`;
      orderActiveCustomCols.forEach(col => {
        thHtml += `<th style="min-width: 90px;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <span>${col}</span>
            <button type="button" class="btn-remove-custom-col" data-col="${col}" style="background: none; border: none; color: var(--text-dim); cursor: pointer; font-size: 9px; padding: 0;" title="Hapus kolom ini">✕</button>
          </div>
        </th>`;
      });
      thHtml += `<th style="width: 45px;">Aksi</th></tr>`;
      thead.innerHTML = thHtml;

      const btnHideDada = document.getElementById('btnHideOrderDada');
      if (btnHideDada) {
        btnHideDada.addEventListener('click', () => {
          orderShowDada = false;
          renderOrderTable();
        });
      }
      thead.querySelectorAll('.btn-remove-custom-col').forEach(btn => {
        btn.addEventListener('click', () => {
          const c = btn.getAttribute('data-col');
          orderActiveCustomCols = orderActiveCustomCols.filter(x => x !== c);
          renderOrderTable();
        });
      });
    }

    // Empty state
    const colCount = 5 + (orderShowDada ? 1 : 0) + orderActiveCustomCols.length;
    if (items.length === 0) {
      tbodyOrderResult.innerHTML = `
        <tr>
          <td colspan="${colCount}" style="text-align: center; color: var(--text-dim); padding: 40px;">
            ${orderItems.length === 0 ? 'Belum ada data pesanan. Masukkan list di samping lalu klik <b>"Rapihkan & Urutkan List"</b>.' : 'Tidak ada data yang cocok dengan filter ukuran ini.'}
          </td>
        </tr>
      `;
      return;
    }

    tbodyOrderResult.innerHTML = '';
    const sizeOptions = STANDARD_SIZE_ORDER.map(s => `<option value="${s}">${s}</option>`).join('');

    items.forEach((item, displayIdx) => {
      const tr = document.createElement('tr');
      const displayName = applyCaseTransform(item.nama_punggung || item.nama, caseMode);
      const isDuplicate = item.nomor && item.nomor !== '-' && duplicateNumbers.includes(item.nomor);
      const isLongName = displayName.length > 16;

      let rowHtml = `
        <td style="font-weight: 700; color: var(--text-dim); text-align: center;">${displayIdx + 1}</td>
        <td>
          <input type="text" class="input-text ord-name" value="${displayName}" style="height: 22px; font-size: 11px; font-weight: 600; ${isLongName ? 'border: 1px solid #f59e0b; background: rgba(245, 158, 11, 0.08);' : ''}" ${isLongName ? 'title="Nama panjang (' + displayName.length + ' karakter). Pertimbangkan disingkat agar muat di pundak jersey."' : ''} />
        </td>`;

      if (orderShowDada) {
        rowHtml += `
        <td>
          <input type="text" class="input-text ord-dada" value="${item.nama_dada || item.dada || ''}" placeholder="Dada depan..." style="height: 22px; font-size: 10.5px;" />
        </td>`;
      }

      rowHtml += `
        <td>
          <input type="text" class="input-text ord-no" value="${item.nomor || '-'}" style="height: 22px; font-size: 11px; font-weight: 700; color: ${isDuplicate ? '#ef4444' : 'var(--accent-blue)'}; ${isDuplicate ? 'border: 1px solid #ef4444; background: rgba(239, 68, 68, 0.15);' : ''}" ${isDuplicate ? 'title="Nomor ini kembar/duplikat! Digunakan ' + numCounts[item.nomor] + 'x pemain."' : ''} />
        </td>
        <td>
          <select class="select-native ord-size" style="height: 22px; font-size: 10.5px; font-weight: 700;">
            ${sizeOptions}
          </select>
        </td>
        <td>
          <input type="text" class="input-text ord-pos" value="${item.keterangan || item.posisi || ''}" placeholder="Catatan..." style="height: 22px; font-size: 10.5px;" />
        </td>`;

      orderActiveCustomCols.forEach(col => {
        rowHtml += `
        <td>
          <input type="text" class="input-text ord-custom" data-col="${col}" value="${item[col] || ''}" placeholder="${col}..." style="height: 22px; font-size: 10.5px;" />
        </td>`;
      });

      rowHtml += `
        <td style="text-align: center;">
          <button type="button" class="btn-danger ord-del" style="height: 20px; font-size: 9px; padding: 0 4px;" title="Hapus baris ini">✕</button>
        </td>
      `;

      tr.innerHTML = rowHtml;

      const inpName = tr.querySelector('.ord-name');
      if (inpName) {
        inpName.addEventListener('input', (e) => {
          item.nama = e.target.value;
          item.nama_punggung = e.target.value;
        });
      }

      const inpDada = tr.querySelector('.ord-dada');
      if (inpDada) {
        inpDada.addEventListener('input', (e) => {
          item.nama_dada = e.target.value;
          item.dada = e.target.value;
        });
      }

      const inpNo = tr.querySelector('.ord-no');
      if (inpNo) {
        inpNo.addEventListener('input', (e) => {
          item.nomor = e.target.value;
        });
        inpNo.addEventListener('change', () => {
          renderOrderTable();
        });
      }

      const selSize = tr.querySelector('.ord-size');
      if (selSize) {
        if (!STANDARD_SIZE_ORDER.includes(item.ukuran)) {
          const opt = document.createElement('option');
          opt.value = item.ukuran;
          opt.innerText = item.ukuran;
          selSize.appendChild(opt);
        }
        selSize.value = item.ukuran;
        selSize.addEventListener('change', () => {
          item.ukuran = selSize.value;
          updateFilterSizeDropdown();
          renderOrderTable();
        });
      }

      const inpPos = tr.querySelector('.ord-pos');
      if (inpPos) {
        inpPos.addEventListener('input', (e) => {
          item.posisi = e.target.value;
          item.keterangan = e.target.value;
        });
      }

      tr.querySelectorAll('.ord-custom').forEach(inpCust => {
        inpCust.addEventListener('input', (e) => {
          const colName = inpCust.getAttribute('data-col');
          item[colName] = e.target.value;
        });
      });

      const btnDel = tr.querySelector('.ord-del');
      if (btnDel) {
        btnDel.addEventListener('click', () => {
          const realIdx = orderItems.indexOf(item);
          if (realIdx >= 0) {
            orderItems.splice(realIdx, 1);
            updateFilterSizeDropdown();
            renderOrderTable();
          }
        });
      }

      tbodyOrderResult.appendChild(tr);
    });
  }

  // Sorter / Filter change listeners
  if (selOrderSortMode) {
    selOrderSortMode.addEventListener('change', renderOrderTable);
  }
  if (selOrderFilterSize) {
    selOrderFilterSize.addEventListener('change', renderOrderTable);
  }
  if (selOrderCaseTransform) {
    selOrderCaseTransform.addEventListener('change', renderOrderTable);
  }

  const btnOrderAddColumn = document.getElementById('btnOrderAddColumn');
  if (btnOrderAddColumn) {
    btnOrderAddColumn.addEventListener('click', () => {
      let colName = null;
      try {
        colName = prompt('Masukkan nama kolom baru (contoh: Nama Dada, Kerah, dll.):');
      } catch {}
      if (!colName || !colName.trim()) {
        const nextNum = orderActiveCustomCols.length + 1;
        colName = `Kolom Baru ${nextNum}`;
      }
      const cleanCol = colName.trim();
      if (cleanCol.toLowerCase().includes('dada')) {
        orderShowDada = true;
      } else if (!orderActiveCustomCols.includes(cleanCol)) {
        orderActiveCustomCols.push(cleanCol);
      }
      renderOrderTable();
      showToast(`Kolom "${cleanCol}" berhasil ditambahkan.`);
    });
  }

  if (btnOrderAddEmptyRow) {
    btnOrderAddEmptyRow.addEventListener('click', () => {
      const idx = orderItems.length + 1;
      orderItems.push({
        nama: `PEMAIN ${idx}`,
        nama_punggung: `PEMAIN ${idx}`,
        nama_dada: '',
        dada: '',
        nomor: `${idx}`,
        ukuran: 'L',
        posisi: '',
        keterangan: '',
        sponsor: '',
        originalIndex: orderItems.length
      });
      updateFilterSizeDropdown();
      renderOrderTable();
    });
  }

  if (btnOrderClearAllRows) {
    btnOrderClearAllRows.addEventListener('click', () => {
      if (orderItems.length === 0) return;
      if (confirm('Kosongkan semua daftar pesanan?')) {
        orderItems = [];
        orderShowDada = false;
        orderActiveCustomCols = [];
        updateFilterSizeDropdown();
        renderOrderTable();
        showToast('Daftar pesanan dikosongkan.');
      }
    });
  }

  // Send directly to Auto-Layout Jersey
  if (btnOrderSendToAutoLayout) {
    btnOrderSendToAutoLayout.addEventListener('click', () => {
      if (!requireActiveLicense()) return;
      if (orderItems.length === 0) {
        alert('Daftar pesanan masih kosong. Silakan rapihkan list terlebih dahulu.');
        return;
      }
      const defaultSponsor = txtOrderDefaultSponsor ? txtOrderDefaultSponsor.value.trim() : '';
      const processedItems = getProcessedOrderItems();
      const caseMode = selOrderCaseTransform ? selOrderCaseTransform.value : 'asis';

      jerseyPlayers = processedItems.map((it, idx) => {
        const finalName = applyCaseTransform(it.nama_punggung || it.nama, caseMode);
        const finalDada = applyCaseTransform(it.nama_dada || it.dada || '', caseMode);
        const playerObj = {
          no: idx + 1,
          Nama: finalName,
          'Nama Punggung': finalName,
          Nomor: it.nomor || '-',
          Ukuran: it.ukuran || 'L',
          'Nama Dada': finalDada,
          Sponsor: it.sponsor || defaultSponsor || '',
          Catatan: it.keterangan || it.posisi || '',
          name: finalName,
          number: it.nomor || '-',
          size: it.ukuran || 'L',
          dada: finalDada
        };
        orderActiveCustomCols.forEach(c => {
          playerObj[c] = it[c] || '';
        });
        return playerObj;
      });

      // Update jerseyExcelHeaders to reflect all active columns
      jerseyExcelHeaders = ['Nama', 'Nama Punggung', 'Nomor', 'Ukuran'];
      if (orderShowDada || jerseyPlayers.some(p => !!p['Nama Dada'])) {
        jerseyExcelHeaders.push('Nama Dada');
      }
      jerseyExcelHeaders.push('Sponsor', 'Catatan');
      orderActiveCustomCols.forEach(c => {
        if (!jerseyExcelHeaders.includes(c)) jerseyExcelHeaders.push(c);
      });

      // If any player has Nama Dada, dynamically ensure [DADA] is mapped in Auto-Layout
      const hasNamaDada = jerseyPlayers.some(p => !!p['Nama Dada']);
      if (hasNamaDada) {
        if (!jerseyMappings.some(m => m.column === 'Nama Dada' || m.placeholder === '[DADA]')) {
          jerseyMappings.push({
            id: (jerseyMappings.reduce((max, m) => Math.max(max, m.id || 0), 0)) + 1,
            column: 'Nama Dada',
            placeholder: '[DADA]',
            align: 'center',
            textCase: 'upper',
            maxWidth: 15.0,
            lockRatio: true
          });
        }
      }

      renderJerseyMappings();
      renderJerseyPlayerTable();
      updateJerseyTargetSizeOptions();
      switchView('jersey');
      showToast(`Berhasil memuat ${jerseyPlayers.length} data ke Auto-Layout Jersey!`, true);
    });
  }

  // Export to Excel (.xlsx)
  if (btnOrderExportExcel) {
    btnOrderExportExcel.addEventListener('click', async () => {
      if (!requireActiveLicense()) return;
      if (orderItems.length === 0) {
        alert('Daftar pesanan masih kosong. Silakan rapihkan list terlebih dahulu.');
        return;
      }
      try {
        const defaultSponsor = txtOrderDefaultSponsor ? txtOrderDefaultSponsor.value.trim() : '';
        const saveRes = await window.corelAPI.showSaveDialog({
          title: 'Simpan File Excel Jersey Auto-Layout',
          defaultPath: 'data_jersey_rapi.xlsx'
        });
        if (saveRes && !saveRes.canceled && saveRes.filePath) {
          const processedItems = getProcessedOrderItems();
          const caseMode = selOrderCaseTransform ? selOrderCaseTransform.value : 'asis';

          const exportPayload = {
            items: processedItems.map((it, idx) => {
              const finalName = applyCaseTransform(it.nama_punggung || it.nama, caseMode);
              const finalDada = (orderShowDada || it.nama_dada || it.dada) ? applyCaseTransform(it.nama_dada || it.dada || '', caseMode) : '';
              const row = {
                no: idx + 1,
                nama: finalName,
                nama_punggung: finalName,
                nomor: it.nomor || '-',
                ukuran: it.ukuran || 'L',
                nama_dada: finalDada,
                dada: finalDada,
                sponsor: it.sponsor || defaultSponsor || '',
                catatan: it.keterangan || it.posisi || ''
              };
              orderActiveCustomCols.forEach(c => {
                row[c] = it[c] || '';
              });
              return row;
            }),
            filePath: saveRes.filePath,
            showDada: orderShowDada || processedItems.some(it => !!(it.nama_dada || it.dada)),
            customColumns: orderActiveCustomCols
          };
          const res = await window.corelAPI.exportOrderExcel(exportPayload);
          if (res.success) {
            showToast(`Sukses: ${res.message}`, true);
            alert(`🎉 File Excel berhasil disimpan!\n\nLokasi: ${saveRes.filePath}\n\nFormat sudah 100% cocok dengan Auto-Layout.`);
          } else {
            showToast(`Gagal: ${res.message}`, false);
            alert(`Gagal mengekspor: ${res.message}`);
          }
        }
      } catch (err) {
        showToast('Error: ' + err.message, false);
      }
    });
  }

  // Copy Formatted Text for WhatsApp
  if (btnOrderCopyFormatted) {
    btnOrderCopyFormatted.addEventListener('click', () => {
      if (orderItems.length === 0) {
        alert('Daftar pesanan masih kosong.');
        return;
      }
      const defaultSponsor = txtOrderDefaultSponsor ? txtOrderDefaultSponsor.value.trim() : '';
      const caseMode = selOrderCaseTransform ? selOrderCaseTransform.value : 'asis';
      let text = `*LIST PESANAN JERSEY*\n`;
      if (defaultSponsor) text += `Tim / Sponsor: ${defaultSponsor}\n`;
      text += `Total Pesanan: ${orderItems.length} Pcs\n`;
      text += `==============================\n\n`;

      const grouped = {};
      orderItems.forEach(it => {
        const sz = it.ukuran || 'L';
        if (!grouped[sz]) grouped[sz] = [];
        grouped[sz].push(it);
      });

      const sortedSizes = Object.keys(grouped).sort((a, b) => getJerseySizeRank(a) - getJerseySizeRank(b));

      let counter = 1;
      for (const sz of sortedSizes) {
        const list = grouped[sz];
        text += `*UKURAN ${sz} (${list.length} Pcs):*\n`;
        list.forEach(p => {
          const finalName = applyCaseTransform(p.nama_punggung || p.nama, caseMode);
          let line = `${counter}. ${finalName}`;
          if (p.nomor && p.nomor !== '-') line += ` - ${p.nomor}`;
          const finalDada = p.nama_dada || p.dada;
          let extraArr = [];
          if (finalDada) extraArr.push(`Dada: ${finalDada}`);
          if (p.keterangan || p.posisi) extraArr.push(p.keterangan || p.posisi);
          orderActiveCustomCols.forEach(c => {
            if (p[c]) extraArr.push(`${c}: ${p[c]}`);
          });
          if (extraArr.length > 0) {
            line += ` (${extraArr.join(' | ')})`;
          }
          text += `${line}\n`;
          counter++;
        });
        text += `\n`;
      }

      navigator.clipboard.writeText(text.trim()).then(() => {
        showToast('Daftar pesanan berhasil disalin untuk chat WhatsApp!', true);
      }).catch(() => {
        showToast('Gunakan seleksi teks manual untuk menyalin.', false);
      });
    });
  }

  // Global Clipboard Image Paste Listener for view-pesanan
  window.addEventListener('paste', (e) => {
    if (activeView !== 'pesanan') return;
    const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          handleOrderImageSelected(file);
          if (btnTabOrderImage) btnTabOrderImage.click();
          break;
        }
      }
    }
  });

  // ==========================================
  // 12b. Side-by-Side Comparison & Proofing Feature (Anti-Typo)
  // ==========================================
  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  const SIZE_COLOR_MAP = {
    'XXS': '#d97706',      // Cokelat Amber
    'XS': '#f59e0b',       // Kuning Oranye
    'S': '#eab308',        // Kuning Emas
    'M': '#10b981',        // Hijau (Permintaan spesifik: M itu hijau)
    'L': '#2563eb',        // Biru Royal
    'XL': '#ef4444',       // Merah (Permintaan spesifik: XL itu merah)
    'XXL': '#8b5cf6',      // Ungu (Permintaan spesifik: XXL itu ungu)
    '2XL': '#8b5cf6',      // Ungu
    '3XL': '#ec4899',      // Pink Fuchsia
    '4XL': '#f43f5e',      // Rose Red
    '5XL': '#be123c',      // Crimson
    'M ANAK': '#06b6d4',   // Cyan
    'XL ANAK': '#0891b2',  // Deep Teal
    'XXL ANAK': '#0284c7', // Sky Blue
    'ANAK': '#14b8a6'      // Mint Teal
  };

  function getSizeColor(size) {
    if (!size) return '#6b7280';
    const norm = normalizeJerseySize(size);
    if (SIZE_COLOR_MAP[norm]) return SIZE_COLOR_MAP[norm];
    for (const [key, color] of Object.entries(SIZE_COLOR_MAP)) {
      if (norm === key || norm.includes(key) || key.includes(norm)) return color;
    }
    const fallbackColors = ['#10b981', '#2563eb', '#ef4444', '#8b5cf6', '#f59e0b', '#06b6d4', '#ec4899', '#6366f1'];
    let hash = 0;
    for (let i = 0; i < norm.length; i++) hash = norm.charCodeAt(i) + ((hash << 5) - hash);
    return fallbackColors[Math.abs(hash) % fallbackColors.length];
  }

  const modalOrderComparison = document.getElementById('modalOrderComparison');
  const btnOrderOpenComparison = document.getElementById('btnOrderOpenComparison');
  const btnOrderCompClose = document.getElementById('btnOrderCompClose');
  const btnOrderCompSavePng = document.getElementById('btnOrderCompSavePng');
  const btnOrderCompCopyImg = document.getElementById('btnOrderCompCopyImg');
  const btnOrderCompCopyText = document.getElementById('btnOrderCompCopyText');
  const boxOrderCompLegend = document.getElementById('boxOrderCompLegend');
  const colComparisonRawList = document.getElementById('colComparisonRawList');
  const colComparisonAppList = document.getElementById('colComparisonAppList');
  const canvasOrderComparison = document.getElementById('canvasOrderComparison');

  function closeOrderComparisonModal() {
    if (modalOrderComparison) {
      modalOrderComparison.classList.remove('open');
    }
  }

  function openOrderComparisonModal() {
    if (!orderItems || orderItems.length === 0) {
      alert('Belum ada data pesanan untuk dibandingkan. Silakan masukkan atau rapihkan list pesanan terlebih dahulu.');
      return;
    }

    const defaultSponsor = txtOrderDefaultSponsor ? txtOrderDefaultSponsor.value.trim() : '';
    const caseMode = selOrderCaseTransform ? selOrderCaseTransform.value : 'asis';

    let rawText = txtOrderRawInput ? txtOrderRawInput.value.trim() : '';
    if (!rawText) {
      rawText = orderItems.map((it, idx) => `${idx + 1}:${it.nama}\nNo:${it.nomor || '-'}\nUk:${it.ukuran || 'L'}`).join('\n');
    }

    // Group items by size
    const grouped = {};
    orderItems.forEach(it => {
      const sz = it.ukuran || 'L';
      if (!grouped[sz]) grouped[sz] = [];
      grouped[sz].push(it);
    });
    const sortedSizes = Object.keys(grouped).sort((a, b) => getJerseySizeRank(a) - getJerseySizeRank(b));

    // 1. Render Legend Bar
    if (boxOrderCompLegend) {
      boxOrderCompLegend.innerHTML = sortedSizes.map(sz => {
        const col = getSizeColor(sz);
        return `
          <span class="comparison-legend-item">
            <span class="comparison-legend-dot" style="background: ${col};"></span>
            <span style="color: #ffffff; font-weight: 700;">${sz}</span>
            <span style="color: var(--text-dim); font-size: 10px;">(${grouped[sz].length} pcs)</span>
          </span>
        `;
      }).join('');
    }

    // 2. Render Left Column: List Asli
    if (colComparisonRawList) {
      colComparisonRawList.innerHTML = '';
      const rawLines = rawText.split(/\r?\n/);

      const playerLookup = orderItems.map(p => ({
        cleanName: (p.nama || '').trim().toLowerCase(),
        nomor: (p.nomor || '').trim(),
        ukuran: p.ukuran || 'L'
      })).filter(p => p.cleanName.length >= 2);

      rawLines.forEach(line => {
        const trimmed = line.trim();
        const lineLower = trimmed.toLowerCase();
        let matchedSize = null;

        const sizeMatch = lineLower.match(/(?:uk(?:uran)?|size)\s*[:\-\/]?\s*([a-z0-9\s"]+)/i);
        if (sizeMatch && sizeMatch[1]) {
          const rawSz = sizeMatch[1].replace(/["']/g, '').trim();
          matchedSize = normalizeJerseySize(rawSz);
        }

        if (!matchedSize) {
          for (const p of playerLookup) {
            if (lineLower.includes(p.cleanName)) {
              matchedSize = p.ukuran;
              break;
            }
          }
        }

        const lineDiv = document.createElement('div');
        lineDiv.className = 'comparison-raw-line';
        if (matchedSize) {
          const col = getSizeColor(matchedSize);
          lineDiv.innerHTML = `<span>${escapeHtml(line)}</span><span class="comp-badge-dot" style="background: ${col};" title="Ukuran ${matchedSize}"></span>`;
        } else {
          lineDiv.innerHTML = `<span>${escapeHtml(line) || '&nbsp;'}</span>`;
        }
        colComparisonRawList.appendChild(lineDiv);
      });
    }

    // 3. Render Right Column: Hasil Aplikasi
    if (colComparisonAppList) {
      let appHtml = `
        <div style="font-weight: 800; font-size: 13px; margin-bottom: 2px; color: #111827;">*LIST PESANAN JERSEY*</div>
      `;
      if (defaultSponsor) {
        appHtml += `<div style="font-weight: 600; color: #4b5563; font-size: 11.5px;">Tim / Sponsor: ${escapeHtml(defaultSponsor)}</div>`;
      }
      appHtml += `
        <div style="font-weight: 600; color: #4b5563; font-size: 11.5px;">Total Pesanan: ${orderItems.length} Pcs</div>
        <div style="color: #9ca3af; margin-bottom: 10px; font-weight: 700; font-family: monospace;">==============================</div>
      `;

      let counter = 1;
      for (const sz of sortedSizes) {
        const list = grouped[sz];
        const col = getSizeColor(sz);
        appHtml += `
          <div class="comparison-app-group">
            <div class="comparison-app-group-title">
              <span class="comp-badge-dot" style="background: ${col};"></span>
              <span style="color: #111827;">*UKURAN ${sz} (${list.length} Pcs):*</span>
            </div>
        `;
        list.forEach(p => {
          const finalName = applyCaseTransform(p.nama, caseMode);
          let rowTxt = `${counter}. ${finalName}`;
          if (p.nomor && p.nomor !== '-') rowTxt += ` - ${p.nomor}`;
          if (p.posisi) rowTxt += ` (${p.posisi})`;
          appHtml += `<div class="comparison-app-row">${escapeHtml(rowTxt)}</div>`;
          counter++;
        });
        appHtml += `</div>`;
      }

      colComparisonAppList.innerHTML = appHtml;
    }

    if (modalOrderComparison) {
      modalOrderComparison.classList.add('open');
    }
  }

  function renderComparisonCanvas() {
    if (!canvasOrderComparison) return '';
    const ctx = canvasOrderComparison.getContext('2d');
    if (!ctx) return '';

    const defaultSponsor = txtOrderDefaultSponsor ? txtOrderDefaultSponsor.value.trim() : '';
    const caseMode = selOrderCaseTransform ? selOrderCaseTransform.value : 'asis';

    let rawText = txtOrderRawInput ? txtOrderRawInput.value.trim() : '';
    if (!rawText) {
      rawText = orderItems.map((it, idx) => `${idx + 1}:${it.nama}\nNo:${it.nomor || '-'}\nUk:${it.ukuran || 'L'}`).join('\n');
    }
    const rawLines = rawText.split(/\r?\n/);

    const grouped = {};
    orderItems.forEach(it => {
      const sz = it.ukuran || 'L';
      if (!grouped[sz]) grouped[sz] = [];
      grouped[sz].push(it);
    });
    const sortedSizes = Object.keys(grouped).sort((a, b) => getJerseySizeRank(a) - getJerseySizeRank(b));

    // Calculate lines count for right column
    let rightLinesCount = 3;
    if (defaultSponsor) rightLinesCount += 1;
    for (const sz of sortedSizes) {
      rightLinesCount += 1;
      rightLinesCount += grouped[sz].length;
      rightLinesCount += 1;
    }

    const maxLines = Math.max(rawLines.length, rightLinesCount);
    const lineHeight = 21;
    const topMargin = 85;
    const bottomMargin = 40;
    const baseW = 860;
    const baseH = Math.max(500, topMargin + (maxLines * lineHeight) + bottomMargin);

    const scale = 2;
    canvasOrderComparison.width = baseW * scale;
    canvasOrderComparison.height = baseH * scale;

    ctx.save();
    ctx.scale(scale, scale);

    // 1. Clean White Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, baseW, baseH);

    // 2. Legend Bar at Top
    ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
    let legendX = 35;
    const legendY = 25;
    ctx.fillStyle = '#374151';
    ctx.fillText('KODE WARNA UKURAN:', legendX, legendY);
    legendX += 135;

    for (const sz of sortedSizes) {
      const col = getSizeColor(sz);
      ctx.beginPath();
      ctx.arc(legendX, legendY - 4, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();

      ctx.fillStyle = '#111827';
      const label = `${sz} (${grouped[sz].length})`;
      ctx.fillText(label, legendX + 8, legendY);
      legendX += ctx.measureText(label).width + 18;
      if (legendX > baseW - 80) break;
    }

    // Top divider line below legend
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(30, 38);
    ctx.lineTo(baseW - 30, 38);
    ctx.stroke();

    // 3. Column Headers
    ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillStyle = '#000000';
    ctx.fillText('list asli', 35, 70);
    ctx.fillText('hasil aplikasi', 450, 70);

    // Center vertical divider
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(425, 50);
    ctx.lineTo(425, baseH - 25);
    ctx.stroke();

    // 4. Render Left Column: list asli
    ctx.font = '12px Consolas, "Liberation Mono", Menlo, Monaco, "Courier New", monospace';
    let currY = topMargin + 14;

    const playerLookup = orderItems.map(p => ({
      cleanName: (p.nama || '').trim().toLowerCase(),
      nomor: (p.nomor || '').trim(),
      ukuran: p.ukuran || 'L'
    })).filter(p => p.cleanName.length >= 2);

    for (const line of rawLines) {
      const trimmed = line.trim();
      const lineLower = trimmed.toLowerCase();
      let matchedSize = null;

      const sizeMatch = lineLower.match(/(?:uk(?:uran)?|size)\s*[:\-\/]?\s*([a-z0-9\s"]+)/i);
      if (sizeMatch && sizeMatch[1]) {
        const rawSz = sizeMatch[1].replace(/["']/g, '').trim();
        matchedSize = normalizeJerseySize(rawSz);
      }

      if (!matchedSize) {
        for (const p of playerLookup) {
          if (lineLower.includes(p.cleanName)) {
            matchedSize = p.ukuran;
            break;
          }
        }
      }

      ctx.fillStyle = '#111827';
      ctx.fillText(line, 35, currY);

      if (matchedSize) {
        const col = getSizeColor(matchedSize);
        const textWidth = ctx.measureText(line).width;
        const dotX = Math.min(395, 35 + textWidth + 10);
        ctx.beginPath();
        ctx.arc(dotX, currY - 4, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = col;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      currY += lineHeight;
    }

    // 5. Render Right Column: hasil aplikasi
    let rightY = topMargin + 14;

    ctx.font = 'bold 12.5px Consolas, "Liberation Mono", Menlo, Monaco, "Courier New", monospace';
    ctx.fillStyle = '#111827';
    ctx.fillText('*LIST PESANAN JERSEY*', 450, rightY);
    rightY += lineHeight;

    if (defaultSponsor) {
      ctx.font = '12px Consolas, "Liberation Mono", Menlo, Monaco, "Courier New", monospace';
      ctx.fillStyle = '#4b5563';
      ctx.fillText(`Tim / Sponsor: ${defaultSponsor}`, 450, rightY);
      rightY += lineHeight;
    }

    ctx.font = '12px Consolas, "Liberation Mono", Menlo, Monaco, "Courier New", monospace';
    ctx.fillStyle = '#4b5563';
    ctx.fillText(`Total Pesanan: ${orderItems.length} Pcs`, 450, rightY);
    rightY += lineHeight;

    ctx.fillStyle = '#9ca3af';
    ctx.fillText('==============================', 450, rightY);
    rightY += lineHeight + 4;

    let counter = 1;
    for (const sz of sortedSizes) {
      const list = grouped[sz];
      const col = getSizeColor(sz);

      ctx.beginPath();
      ctx.arc(456, rightY - 4, 5, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.font = 'bold 12.5px Consolas, "Liberation Mono", Menlo, Monaco, "Courier New", monospace';
      ctx.fillStyle = '#111827';
      ctx.fillText(`*UKURAN ${sz} (${list.length} Pcs):*`, 468, rightY);
      rightY += lineHeight;

      ctx.font = '12px Consolas, "Liberation Mono", Menlo, Monaco, "Courier New", monospace';
      ctx.fillStyle = '#1f2937';
      for (const p of list) {
        const finalName = applyCaseTransform(p.nama, caseMode);
        let rowTxt = `  ${counter}. ${finalName}`;
        if (p.nomor && p.nomor !== '-') rowTxt += ` - ${p.nomor}`;
        if (p.posisi) rowTxt += ` (${p.posisi})`;
        ctx.fillText(rowTxt, 450, rightY);
        rightY += lineHeight;
        counter++;
      }

      rightY += 6;
    }

    ctx.restore();
    return canvasOrderComparison.toDataURL('image/png');
  }

  // Comparison Dialog Button Listeners
  if (btnOrderOpenComparison) {
    btnOrderOpenComparison.addEventListener('click', openOrderComparisonModal);
  }

  if (btnOrderCompClose) {
    btnOrderCompClose.addEventListener('click', closeOrderComparisonModal);
  }

  if (modalOrderComparison) {
    modalOrderComparison.addEventListener('click', (e) => {
      if (e.target === modalOrderComparison) {
        closeOrderComparisonModal();
      }
    });
  }

  if (btnOrderCompSavePng) {
    btnOrderCompSavePng.addEventListener('click', async () => {
      try {
        const dataUrl = renderComparisonCanvas();
        if (!dataUrl) {
          alert('Gagal menghasilkan gambar perbandingan.');
          return;
        }
        const saveRes = await window.corelAPI.showSaveDialog({
          title: 'Simpan Gambar Perbandingan Pesanan Jersey',
          defaultPath: 'perbandingan_pesanan_jersey.png',
          filters: [{ name: 'Gambar PNG (*.png)', extensions: ['png'] }]
        });
        if (saveRes && !saveRes.canceled && saveRes.filePath) {
          const res = await window.corelAPI.saveComparisonImage({ dataUrl, filePath: saveRes.filePath });
          if (res && res.success) {
            showToast('Gambar perbandingan berhasil disimpan!', true);
            alert(`File gambar perbandingan berhasil disimpan!\n\nLokasi: ${saveRes.filePath}\n\nSiap dibagikan ke konsumen untuk verifikasi.`);
          } else {
            showToast('Gagal menyimpan gambar: ' + (res?.message || 'Error tidak diketahui'), false);
          }
        }
      } catch (err) {
        showToast('Error: ' + err.message, false);
      }
    });
  }

  if (btnOrderCompCopyImg) {
    btnOrderCompCopyImg.addEventListener('click', async () => {
      try {
        const dataUrl = renderComparisonCanvas();
        if (!dataUrl) {
          alert('Gagal menghasilkan gambar perbandingan.');
          return;
        }
        const res = await window.corelAPI.copyImageToClipboard(dataUrl);
        if (res && res.success) {
          showToast('Gambar perbandingan disalin ke clipboard! Siap dipaste ke WA.', true);
        } else {
          showToast('Gagal menyalin gambar ke clipboard: ' + (res?.message || ''), false);
        }
      } catch (err) {
        showToast('Error: ' + err.message, false);
      }
    });
  }

  if (btnOrderCompCopyText && btnOrderCopyFormatted) {
    btnOrderCompCopyText.addEventListener('click', () => {
      btnOrderCopyFormatted.click();
    });
  }

  // ==========================================
  // Multi-CorelDRAW Instance Switcher Logic
  // ==========================================
  const boxMultiCorelSwitcher = document.getElementById('boxMultiCorelSwitcher');
  const containerMultiCorelPills = document.getElementById('containerMultiCorelPills');
  const berandaMultiCorelAlert = document.getElementById('berandaMultiCorelAlert');
  const berandaMultiCorelList = document.getElementById('berandaMultiCorelList');
  const lblDownsaverTargetCorel = document.getElementById('lblDownsaverTargetCorel');

  function renderMultiCorelInstances(res) {
    const running = (res && Array.isArray(res.runningInstances)) ? res.runningInstances : [];

    // Update downsaver target corel label
    if (lblDownsaverTargetCorel) {
      if (res?.connected && res?.version) {
        lblDownsaverTargetCorel.innerText = 'Menggunakan: ' + res.version + ' ▾';
      } else {
        lblDownsaverTargetCorel.innerText = 'CorelDRAW Belum Terbuka ▾';
      }
    }

    if (running.length >= 2) {
      // 1. Show titlebar pill switcher
      if (boxMultiCorelSwitcher && containerMultiCorelPills) {
        boxMultiCorelSwitcher.style.display = 'flex';
        containerMultiCorelPills.innerHTML = '';
        running.forEach((inst) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'multi-corel-pill-btn' + (inst.isCurrent ? ' active' : '');
          const shortVer = inst.version === '17' ? 'Corel X7' : (inst.version === '23' ? 'Corel 2021' : inst.name.replace('CorelDRAW ', ''));
          btn.innerText = inst.isCurrent ? (shortVer + ' ✓') : shortVer;
          btn.title = inst.name + ' (PID: ' + inst.pid + ')\nJudul: ' + (inst.title || '-') + '\nKlik untuk menghubungkan ke instance ini';
          btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (selTargetCorelVersion) {
              selTargetCorelVersion.value = inst.version;
            }
            document.querySelectorAll('.multi-corel-pill-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (window.corelAPI?.setPreferredCorelVersion) {
              await window.corelAPI.setPreferredCorelVersion(inst.version, inst.pid);
              showToast('Berhasil beralih koneksi ke ' + inst.name + '!');
              await updateCorelStatus();
            }
          });
          containerMultiCorelPills.appendChild(btn);
        });
      }

      // 2. Show Beranda alert box
      if (berandaMultiCorelAlert && berandaMultiCorelList) {
        berandaMultiCorelAlert.style.display = 'block';
        berandaMultiCorelList.innerHTML = '';
        running.forEach((inst) => {
          const item = document.createElement('button');
          item.type = 'button';
          item.className = 'multi-corel-item-btn' + (inst.isCurrent ? ' active' : '');
          const dot = inst.isCurrent ? '●' : '○';
          const statusText = inst.isCurrent ? 'Terhubung (Aktif)' : 'Klik untuk Beralih';
          item.innerHTML = '<span>' + dot + ' <strong>' + inst.name + '</strong> <small style="color: var(--text-dim);">(PID: ' + inst.pid + ')</small></span><span style="font-size: 10px; color: ' + (inst.isCurrent ? '#34d399' : '#60a5fa') + ';">' + statusText + '</span>';
          item.addEventListener('click', async () => {
            if (selTargetCorelVersion) {
              selTargetCorelVersion.value = inst.version;
            }
            document.querySelectorAll('.multi-corel-item-btn').forEach(b => b.classList.remove('active'));
            item.classList.add('active');
            if (window.corelAPI?.setPreferredCorelVersion) {
              await window.corelAPI.setPreferredCorelVersion(inst.version, inst.pid);
              showToast('Berhasil beralih koneksi ke ' + inst.name + '!');
              await updateCorelStatus();
            }
          });
          berandaMultiCorelList.appendChild(item);
        });
      }
    } else {
      if (boxMultiCorelSwitcher) boxMultiCorelSwitcher.style.display = 'none';
      if (berandaMultiCorelAlert) berandaMultiCorelAlert.style.display = 'none';
    }
  }

  if (lblDownsaverTargetCorel) {
    lblDownsaverTargetCorel.addEventListener('click', () => {
      if (selTargetCorelVersion) {
        selTargetCorelVersion.focus();
        selTargetCorelVersion.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }

  // ==========================================
  // Tool: Penurun Versi CDR (X4/X7 Downsaver)
  // ==========================================
  const btnDownsaverQuickX4 = document.getElementById('btnDownsaverQuickX4');
  const btnDownsaverQuickX7 = document.getElementById('btnDownsaverQuickX7');
  const btnDownsaverStart = document.getElementById('btnDownsaverStart');
  const btnDownsaverCancel = document.getElementById('btnDownsaverCancel');
  const btnDownsaverAddFiles = document.getElementById('btnDownsaverAddFiles');
  const btnDownsaverAddFolder = document.getElementById('btnDownsaverAddFolder');
  const btnDownsaverClear = document.getElementById('btnDownsaverClear');
  const lblDownsaverSummary = document.getElementById('lblDownsaverSummary');
  const downsaverTableWrapper = document.getElementById('downsaverTableWrapper');
  const downsaverEmptyDropzone = document.getElementById('downsaverEmptyDropzone');
  const tblDownsaverFiles = document.getElementById('tblDownsaverFiles');
  const tbodyDownsaverFiles = document.getElementById('tbodyDownsaverFiles');
  const chkDownsaverSelectAll = document.getElementById('chkDownsaverSelectAll');
  const selDownsaverTargetVersion = document.getElementById('selDownsaverTargetVersion');
  const txtDownsaverSuffix = document.getElementById('txtDownsaverSuffix');
  const selDownsaverLocationMode = document.getElementById('selDownsaverLocationMode');
  const groupDownsaverCustomFolder = document.getElementById('groupDownsaverCustomFolder');
  const txtDownsaverCustomFolder = document.getElementById('txtDownsaverCustomFolder');
  const btnDownsaverBrowseFolder = document.getElementById('btnDownsaverBrowseFolder');
  const chkDownsaverCurveTo = document.getElementById('chkDownsaverCurveTo');
  const chkDownsaverCleanup = document.getElementById('chkDownsaverCleanup');
  const chkDownsaverOverwrite = document.getElementById('chkDownsaverOverwrite');
  const chkDownsaverOpenFolder = document.getElementById('chkDownsaverOpenFolder');
  const downsaverProgressBox = document.getElementById('downsaverProgressBox');
  const downsaverProgressBarFill = document.getElementById('downsaverProgressBarFill');
  const lblDownsaverProgressText = document.getElementById('lblDownsaverProgressText');
  const lblDownsaverProgressPercent = document.getElementById('lblDownsaverProgressPercent');

  let downsaverFiles = [];
  let isDownsaving = false;

  function getTargetVersionLabel(verNum) {
    const v = parseInt(verNum, 10);
    switch (v) {
      case 14: return 'X4 (v14.0)';
      case 15: return 'X5 (v15.0)';
      case 16: return 'X6 (v16.0)';
      case 17: return 'X7 (v17.0)';
      case 18: return 'X8 (v18.0)';
      case 20: return '2018 (v20.0)';
      case 21: return '2019 (v21.0)';
      case 22: return '2020 (v22.0)';
      case 23: return '2021 (v23.0)';
      default: return 'v' + v;
    }
  }

  function renderDownsaverFiles() {
    if (!tbodyDownsaverFiles || !downsaverEmptyDropzone || !tblDownsaverFiles) return;

    if (downsaverFiles.length === 0) {
      downsaverEmptyDropzone.style.display = 'flex';
      tblDownsaverFiles.style.display = 'none';
      if (lblDownsaverSummary) lblDownsaverSummary.innerText = '0 File CDR Terpilih';
      return;
    }

    downsaverEmptyDropzone.style.display = 'none';
    tblDownsaverFiles.style.display = 'table';

    tbodyDownsaverFiles.innerHTML = '';
    const currentTargetVer = selDownsaverTargetVersion?.value || '14';
    const targetLabel = getTargetVersionLabel(currentTargetVer);

    let totalBytes = 0;

    downsaverFiles.forEach((item, idx) => {
      totalBytes += (item.sizeBytes || 0);
      const tr = document.createElement('tr');

      // Checkbox
      const tdCheck = document.createElement('td');
      tdCheck.style.textAlign = 'center';
      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.checked = !!item.selected;
      chk.addEventListener('change', () => {
        item.selected = chk.checked;
        updateDownsaverSummary();
      });
      tdCheck.appendChild(chk);
      tr.appendChild(tdCheck);

      // Thumbnail
      const tdThumb = document.createElement('td');
      tdThumb.style.textAlign = 'center';
      if (item.thumbnailBase64) {
        const img = document.createElement('img');
        img.src = item.thumbnailBase64;
        img.className = 'downsaver-thumb';
        img.alt = 'CDR';
        tdThumb.appendChild(img);
      } else {
        const fb = document.createElement('div');
        fb.className = 'downsaver-thumb-fallback';
        fb.innerText = 'CDR';
        tdThumb.appendChild(fb);
      }
      tr.appendChild(tdThumb);

      // Name & Path
      const tdName = document.createElement('td');
      tdName.innerHTML = '<div style="font-weight: 600; color: var(--text-main); font-size: 12px; margin-bottom: 2px;">' + item.fileName + '</div><div style="font-size: 10px; color: var(--text-dim); max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="' + item.filePath + '">' + item.filePath + '</div>';
      tr.appendChild(tdName);

      // Detected Original Version Badge
      const tdVer = document.createElement('td');
      let badgeClass = 'badge-ver-recent';
      if (item.versionNum >= 23) badgeClass = 'badge-ver-recent';
      else if (item.versionNum >= 17) badgeClass = 'badge-ver-mid';
      else if (item.versionNum >= 14) badgeClass = 'badge-ver-classic';
      else badgeClass = 'badge-ver-legacy';

      const displayVerName = item.versionName || ('CorelDRAW v' + item.versionNum);
      tdVer.innerHTML = '<span class="badge-version-pill ' + badgeClass + '">' + displayVerName + '</span>';
      tr.appendChild(tdVer);

      // File Size & Pages
      const tdSize = document.createElement('td');
      tdSize.style.fontSize = '11px';
      tdSize.style.color = 'var(--text-muted)';
      tdSize.innerText = (item.fileSize || '-') + ' • ' + (item.pages || 1) + ' Hal';
      tr.appendChild(tdSize);

      // Target Version
      const tdTarget = document.createElement('td');
      tdTarget.innerHTML = '<span style="color: #60a5fa; font-weight: 700; font-size: 11px;">➔ ' + targetLabel + '</span>';
      tr.appendChild(tdTarget);

      // Status
      const tdStatus = document.createElement('td');
      if (item.status === 'processing') {
        tdStatus.innerHTML = '<span style="color: #fbbf24; font-size: 11px; font-weight: 600;">⏳ ' + (item.statusText || 'Memproses...') + '</span>';
      } else if (item.status === 'success') {
        tdStatus.innerHTML = '<span style="color: #34d399; font-size: 11px; font-weight: 600;">✓ ' + (item.statusText || 'Selesai') + '</span>';
      } else if (item.status === 'failed') {
        tdStatus.innerHTML = '<span style="color: #f87171; font-size: 11px; font-weight: 600;">✕ ' + (item.statusText || 'Gagal') + '</span>';
      } else {
        tdStatus.innerHTML = '<span style="color: var(--text-dim); font-size: 11px;">Siap</span>';
      }
      tr.appendChild(tdStatus);

      // Action Delete
      const tdAction = document.createElement('td');
      tdAction.style.textAlign = 'center';
      const btnDel = document.createElement('button');
      btnDel.type = 'button';
      btnDel.className = 'btn-danger';
      btnDel.style.padding = '2px 6px';
      btnDel.style.fontSize = '10px';
      btnDel.innerText = '✕';
      btnDel.title = 'Hapus dari daftar';
      btnDel.addEventListener('click', () => {
        downsaverFiles.splice(idx, 1);
        renderDownsaverFiles();
      });
      tdAction.appendChild(btnDel);
      tr.appendChild(tdAction);

      tbodyDownsaverFiles.appendChild(tr);
    });

    updateDownsaverSummary();
  }

  function updateDownsaverSummary() {
    if (!lblDownsaverSummary) return;
    const selectedCount = downsaverFiles.filter(f => f.selected).length;
    let totalBytes = 0;
    downsaverFiles.forEach(f => { if (f.selected) totalBytes += (f.sizeBytes || 0); });

    let sizeStr = '';
    if (totalBytes > 0) {
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(totalBytes) / Math.log(k));
      sizeStr = ' (' + parseFloat((totalBytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i] + ')';
    }

    lblDownsaverSummary.innerText = selectedCount + ' dari ' + downsaverFiles.length + ' File Dipilih' + sizeStr;
  }

  async function addDownsaverFiles(filePaths) {
    if (!filePaths || !filePaths.length) return;

    // Normalize paths cleanly to string
    const normalizedPaths = filePaths.map(item => {
      if (typeof item === 'string') return item;
      return item?.path || item?.filePath || '';
    }).filter(p => p && typeof p === 'string' && p.toLowerCase().endsWith('.cdr'));

    if (!normalizedPaths.length) return;

    const existingPaths = new Set(downsaverFiles.map(f => f.filePath));
    const pathsToInspect = normalizedPaths.filter(p => !existingPaths.has(p));
    if (!pathsToInspect.length) {
      showToast('Semua file yang dipilih sudah ada di dalam daftar.');
      return;
    }

    if (lblDownsaverSummary) lblDownsaverSummary.innerText = 'Memeriksa ' + pathsToInspect.length + ' file CDR...';

    try {
      let inspected = [];
      if (window.corelAPI?.inspectCdrFiles) {
        inspected = await window.corelAPI.inspectCdrFiles(pathsToInspect);
      }

      const newEntries = pathsToInspect.map((p, idx) => {
        const meta = inspected && inspected[idx] ? inspected[idx] : null;
        return {
          filePath: p,
          fileName: meta?.fileName || p.split(/[\\/]/).pop(),
          fileSize: meta?.fileSize || '',
          sizeBytes: meta?.sizeBytes || 0,
          versionNum: meta?.versionNum || 0,
          versionName: meta?.humanVersion || meta?.versionName || 'CDR',
          versionShort: meta?.appVersion || meta?.versionShort || '',
          pages: meta?.pages || 1,
          thumbnailBase64: meta?.thumbnailBase64 || null,
          status: 'ready',
          statusText: 'Siap',
          selected: true
        };
      });

      downsaverFiles = [...downsaverFiles, ...newEntries];
      renderDownsaverFiles();
      showToast('Berhasil menambahkan ' + newEntries.length + ' file CDR!');
    } catch (err) {
      showToast('Gagal memeriksa file CDR: ' + err.message, false);
    }
  }

  async function startDownsaverConversion() {
    if (isDownsaving) return;
    if (!requireActiveLicense()) return;

    const selectedFiles = downsaverFiles.filter(f => f.selected);
    if (!selectedFiles.length) {
      alert('Pilih setidaknya satu file CDR untuk dikonversi.');
      return;
    }

    const targetVer = parseInt(selDownsaverTargetVersion?.value, 10) || 14;
    const targetLabel = getTargetVersionLabel(targetVer);
    const suffix = txtDownsaverSuffix?.value || '';
    const locMode = selDownsaverLocationMode?.value || 'same';
    const outputFolder = locMode === 'custom' ? (txtDownsaverCustomFolder?.value || '') : '';
    const curveTo = chkDownsaverCurveTo ? !!chkDownsaverCurveTo.checked : false;
    const cleanupJunk = !!chkDownsaverCleanup?.checked;
    const overwrite = !!chkDownsaverOverwrite?.checked;
    const openAfter = !!chkDownsaverOpenFolder?.checked;

    if (locMode === 'custom' && !outputFolder) {
      alert('Silakan tentukan Folder Tujuan Output terlebih dahulu.');
      return;
    }

    isDownsaving = true;
    if (btnDownsaverCancel) btnDownsaverCancel.style.display = 'inline-flex';
    if (btnDownsaverStart) {
      btnDownsaverStart.disabled = true;
      btnDownsaverStart.innerText = 'Mengonversi...';
    }
    if (downsaverProgressBox) downsaverProgressBox.style.display = 'block';
    if (downsaverProgressBarFill) downsaverProgressBarFill.style.width = '30%';
    if (lblDownsaverProgressText) lblDownsaverProgressText.innerText = 'Menghubungkan ke CorelDRAW & menurunkan versi ' + selectedFiles.length + ' file ke ' + targetLabel + '...';
    if (lblDownsaverProgressPercent) lblDownsaverProgressPercent.innerText = 'Proses...';

    selectedFiles.forEach((f) => {
      f.status = 'processing';
      f.statusText = 'Sedang dikonversi...';
    });
    renderDownsaverFiles();

    try {
      const payload = {
        files: selectedFiles.map(f => f.filePath),
        targetVersion: targetVer,
        outputFolder,
        suffix,
        curveTo,
        cleanupJunk,
        overwrite
      };

      const res = await window.corelAPI.downsaveCdrBatch(payload);

      if (downsaverProgressBarFill) downsaverProgressBarFill.style.width = '100%';
      if (lblDownsaverProgressPercent) lblDownsaverProgressPercent.innerText = '100%';

      if (res?.cancelled) {
        showToast('Proses konversi dibatalkan.', false);
        selectedFiles.forEach((f) => {
          if (f.status === 'processing') {
            f.status = 'ready';
            f.statusText = 'Dibatalkan';
          }
        });
      } else if (res?.success) {
        const convertedPaths = new Set((res.converted || []).map(c => (c.src || '').toLowerCase()));
        selectedFiles.forEach((f) => {
          if (convertedPaths.has(f.filePath.toLowerCase())) {
            f.status = 'success';
            f.statusText = 'Selesai (' + targetLabel + ')';
          } else {
            f.status = 'failed';
            f.statusText = 'Gagal';
          }
        });

        showToast(res.message || ('Berhasil menurunkan versi ' + (res.converted?.length || 0) + ' file CDR ke ' + targetLabel + '!'), true);

        if (openAfter && window.corelAPI?.openFolder) {
          const targetDir = outputFolder || selectedFiles[0].filePath.substring(0, selectedFiles[0].filePath.lastIndexOf('\\'));
          if (targetDir) window.corelAPI.openFolder(targetDir);
        }
      } else {
        const hasHigherVer = selectedFiles.some(f => (f.versionNum && f.versionNum >= 24));
        selectedFiles.forEach((f) => {
          f.status = 'failed';
          f.statusText = (f.versionNum && f.versionNum >= 24) ? 'Versi Terlalu Tinggi (v' + f.versionNum + ')' : 'Gagal';
        });
        if (hasHigherVer) {
          showToast('File dibuat di CorelDRAW 2024/2026 (v24-v26) dan tidak dapat dibuka Corel lokal. Gunakan tombol AsanConvert di bawah.', false);
        } else {
          showToast(res?.message || 'Gagal menurunkan versi file CDR.', false);
        }
      }
    } catch (err) {
      selectedFiles.forEach((f) => {
        f.status = 'failed';
        f.statusText = 'Error';
      });
      showToast('Error: ' + err.message, false);
    } finally {
      isDownsaving = false;
      if (btnDownsaverCancel) btnDownsaverCancel.style.display = 'none';
      if (btnDownsaverStart) {
        btnDownsaverStart.disabled = false;
        btnDownsaverStart.innerText = 'Mulai Konversi';
      }
      setTimeout(() => {
        if (downsaverProgressBox) downsaverProgressBox.style.display = 'none';
      }, 3000);
      renderDownsaverFiles();
    }
  }

  // Event Listeners for Downsaver
  if (btnDownsaverAddFiles) {
    btnDownsaverAddFiles.addEventListener('click', async () => {
      if (window.corelAPI?.openFiles) {
        const res = await window.corelAPI.openFiles({
          title: 'Pilih File CDR',
          filters: [{ name: 'CorelDRAW Files (*.cdr)', extensions: ['cdr'] }]
        });
        if (res?.success && res?.files?.length) {
          await addDownsaverFiles(res.files);
        }
      }
    });
  }

  if (btnDownsaverAddFolder) {
    btnDownsaverAddFolder.addEventListener('click', async () => {
      if (window.corelAPI?.openDirectory) {
        const res = await window.corelAPI.openDirectory({ title: 'Pilih Folder Berisi File CDR' });
        if (res?.success && res?.path) {
          if (window.corelAPI?.scanCdrDirectory) {
            const scanRes = await window.corelAPI.scanCdrDirectory(res.path, true);
            if (scanRes?.success && scanRes?.files?.length) {
              await addDownsaverFiles(scanRes.files);
            } else {
              showToast('Tidak ditemukan file .cdr di folder tersebut.');
            }
          }
        }
      }
    });
  }

  if (btnDownsaverClear) {
    btnDownsaverClear.addEventListener('click', () => {
      if (downsaverFiles.length === 0) return;
      downsaverFiles = [];
      renderDownsaverFiles();
      showToast('Daftar file CDR telah dikosongkan.');
    });
  }

  if (chkDownsaverSelectAll) {
    chkDownsaverSelectAll.addEventListener('change', () => {
      const state = chkDownsaverSelectAll.checked;
      downsaverFiles.forEach(f => { f.selected = state; });
      renderDownsaverFiles();
    });
  }

  if (selDownsaverTargetVersion) {
    selDownsaverTargetVersion.addEventListener('change', () => {
      const val = parseInt(selDownsaverTargetVersion.value, 10) || 14;
      if (txtDownsaverSuffix) {
        if (val === 14) txtDownsaverSuffix.value = '_X4';
        else if (val === 17) txtDownsaverSuffix.value = '_X7';
        else if (val === 15) txtDownsaverSuffix.value = '_X5';
        else if (val === 16) txtDownsaverSuffix.value = '_X6';
        else if (val === 18) txtDownsaverSuffix.value = '_X8';
        else if (val === 20) txtDownsaverSuffix.value = '_2018';
        else if (val === 21) txtDownsaverSuffix.value = '_2019';
        else if (val === 22) txtDownsaverSuffix.value = '_2020';
        else if (val === 23) txtDownsaverSuffix.value = '_2021';
      }
      renderDownsaverFiles();
    });
  }

  if (selDownsaverLocationMode && groupDownsaverCustomFolder) {
    selDownsaverLocationMode.addEventListener('change', () => {
      groupDownsaverCustomFolder.style.display = selDownsaverLocationMode.value === 'custom' ? 'block' : 'none';
    });
  }

  if (btnDownsaverBrowseFolder && txtDownsaverCustomFolder) {
    btnDownsaverBrowseFolder.addEventListener('click', async () => {
      if (window.corelAPI?.openDirectory) {
        const res = await window.corelAPI.openDirectory({ title: 'Pilih Folder Tujuan Output' });
        if (res?.success && res?.path) {
          txtDownsaverCustomFolder.value = res.path;
        }
      }
    });
  }

  if (btnDownsaverStart) {
    btnDownsaverStart.addEventListener('click', () => {
      startDownsaverConversion();
    });
  }

  if (btnDownsaverCancel) {
    btnDownsaverCancel.addEventListener('click', async () => {
      if (window.corelAPI?.cancelOperation) {
        await window.corelAPI.cancelOperation();
      }
    });
  }

  if (btnDownsaverQuickX4) {
    btnDownsaverQuickX4.addEventListener('click', async () => {
      if (selDownsaverTargetVersion) selDownsaverTargetVersion.value = '14';
      if (txtDownsaverSuffix) txtDownsaverSuffix.value = '_X4';
      renderDownsaverFiles();
      if (downsaverFiles.length === 0) {
        if (window.corelAPI?.openFiles) {
          const res = await window.corelAPI.openFiles({
            title: 'Pilih File CDR untuk Diturunkan ke X4',
            filters: [{ name: 'CorelDRAW Files (*.cdr)', extensions: ['cdr'] }]
          });
          if (res?.success && res?.files?.length) {
            await addDownsaverFiles(res.files);
            startDownsaverConversion();
          }
        }
      } else {
        startDownsaverConversion();
      }
    });
  }

  if (btnDownsaverQuickX7) {
    btnDownsaverQuickX7.addEventListener('click', async () => {
      if (selDownsaverTargetVersion) selDownsaverTargetVersion.value = '17';
      if (txtDownsaverSuffix) txtDownsaverSuffix.value = '_X7';
      renderDownsaverFiles();
      if (downsaverFiles.length === 0) {
        if (window.corelAPI?.openFiles) {
          const res = await window.corelAPI.openFiles({
            title: 'Pilih File CDR untuk Diturunkan ke X7',
            filters: [{ name: 'CorelDRAW Files (*.cdr)', extensions: ['cdr'] }]
          });
          if (res?.success && res?.files?.length) {
            await addDownsaverFiles(res.files);
            startDownsaverConversion();
          }
        }
      } else {
        startDownsaverConversion();
      }
    });
  }

  // Drag and drop onto downsaver table / dropzone
  if (downsaverTableWrapper) {
    downsaverTableWrapper.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (downsaverEmptyDropzone) downsaverEmptyDropzone.classList.add('dragover');
    });
    downsaverTableWrapper.addEventListener('dragleave', () => {
      if (downsaverEmptyDropzone) downsaverEmptyDropzone.classList.remove('dragover');
    });
    downsaverTableWrapper.addEventListener('drop', async (e) => {
      e.preventDefault();
      if (downsaverEmptyDropzone) downsaverEmptyDropzone.classList.remove('dragover');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const paths = [];
        for (let i = 0; i < e.dataTransfer.files.length; i++) {
          const f = e.dataTransfer.files[i];
          const p = window.corelAPI?.getPathForFile ? window.corelAPI.getPathForFile(f) : f.path;
          if (p && p.toLowerCase().endsWith('.cdr')) {
            paths.push(p);
          }
        }
        if (paths.length > 0) {
          await addDownsaverFiles(paths);
        } else {
          showToast('Hanya file berformat .cdr yang didukung.', false);
        }
      }
    });
  }

  if (downsaverEmptyDropzone) {
    downsaverEmptyDropzone.addEventListener('click', () => {
      if (btnDownsaverAddFiles) btnDownsaverAddFiles.click();
    });
  }


  // ==========================================
  // Panduan Penggunaan (User Guide) Controller
  // ==========================================
  const guideListContainer = document.getElementById('guideListContainer');
  const guideDetailContainer = document.getElementById('guideDetailContainer');
  const txtSearchGuide = document.getElementById('txtSearchGuide');
  const guideCategoryBar = document.getElementById('guideCategoryBar');
  const btnTitlebarPanduan = document.getElementById('btnTitlebarPanduan');
  const modalFirstRunGuide = document.getElementById('modalFirstRunGuide');
  const btnOpenFirstRunGuide = document.getElementById('btnOpenFirstRunGuide');
  const btnSkipFirstRunGuide = document.getElementById('btnSkipFirstRunGuide');

  // ==========================================
  // Cloud YouTube Video Tutorial System
  // ==========================================
  const GITHUB_TUTORIALS_URL = 'https://raw.githubusercontent.com/GFX-GRAPHIC/corel-tools-suite/master/tutorials.json';
  const GITHUB_TUTORIALS_EDIT_URL = 'https://github.com/GFX-GRAPHIC/corel-tools-suite/blob/master/tutorials.json';
  let cloudTutorials = {};
  let activeYouTubeUrl = '';

  function parseYouTubeId(url) {
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    const match = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i);
    return match ? match[1] : '';
  }

  // Security: Strict Whitelist & Data Sanitizer
  function sanitizeTutorialData(rawData) {
    if (!rawData || typeof rawData !== 'object') return {};
    const clean = {};
    for (const [key, val] of Object.entries(rawData)) {
      if (typeof key === 'string' && typeof val === 'string') {
        const videoId = parseYouTubeId(val);
        if (videoId) {
          clean[key] = 'https://www.youtube.com/watch?v=' + videoId;
        }
      }
    }
    return clean;
  }

  const FEATURE_ALIASES = {
    'downsaver': ['downsaver', 'penurun', 'versi', 'cdrversion'],
    'enumerator': ['enumerator', 'penomoran', 'nomor', 'numerator'],
    'merger': ['merger', 'gabungan', 'sertifikat', 'certmerger'],
    'jersey': ['jersey', 'autolayout', 'pola', 'olahraga'],
    'layoutPola': ['layoutPola', 'layoutpola', 'nesting'],
    'pesanan': ['pesanan', 'ordersorter', 'order', 'rekap'],
    'tracer': ['tracer', 'aitracer', 'trace', 'vektor'],
    'split': ['split', 'pecah', 'potong'],
    'konversi': ['konversi', 'convert', 'format'],
    'warna': ['warna', 'color', 'cmyk', 'palet'],
    'ukuran': ['ukuran', 'size', 'dimensi'],
    'batch': ['batch', 'massal'],
    'multicorel': ['multicorel', 'multicore', 'multi']
  };

  function getTutorialUrlForFeature(featureId, viewId) {
    if (!cloudTutorials || typeof cloudTutorials !== 'object') return '';
    const fId = (featureId || '').toLowerCase().trim();
    const vId = (viewId || '').toLowerCase().trim();

    for (const [k, url] of Object.entries(cloudTutorials)) {
      const lowerK = k.toLowerCase().trim();
      if ((fId && lowerK === fId) || (vId && lowerK === vId)) {
        if (url && parseYouTubeId(url)) return url;
      }
    }

    for (const [canonical, aliases] of Object.entries(FEATURE_ALIASES)) {
      const isTarget = aliases.some(a => a.toLowerCase() === fId || a.toLowerCase() === vId);
      if (isTarget) {
        for (const alias of aliases) {
          for (const [k, url] of Object.entries(cloudTutorials)) {
            if (k.toLowerCase().trim() === alias.toLowerCase()) {
              if (url && parseYouTubeId(url)) return url;
            }
          }
        }
      }
    }
    return '';
  }

  function openYouTubeModal(url, title) {
    const videoId = parseYouTubeId(url);
    if (!videoId) {
      showToast('Link video tutorial belum tersedia.', false);
      return;
    }

    activeYouTubeUrl = 'https://www.youtube.com/watch?v=' + encodeURIComponent(videoId);

    // Buka jendela pemutar video native terverifikasi (bebas Error 153 & Error 152)
    if (window.electronAPI && window.electronAPI.openTutorialPlayer) {
      window.electronAPI.openTutorialPlayer({ videoId, title });
      return;
    }
    const modal = document.getElementById('modalYouTubeTutorial');
    const playerContainer = document.getElementById('containerYouTubePlayer');
    const titleEl = document.getElementById('lblYouTubeModalTitle');
    if (!modal || !playerContainer) return;

    if (titleEl) {
      titleEl.textContent = title ? ('Video Tutorial: ' + title) : 'Video Tutorial';
    }

    // Format resmi bawaan YouTube Embed
    playerContainer.innerHTML = '<iframe width="100%" height="100%" src="https://www.youtube.com/embed/' + encodeURIComponent(videoId) + '" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>';
    modal.style.display = 'flex';
  }

  function closeYouTubeModal() {
    const modal = document.getElementById('modalYouTubeTutorial');
    const playerContainer = document.getElementById('containerYouTubePlayer');
    if (modal) modal.style.display = 'none';
    if (playerContainer) playerContainer.innerHTML = '';
    activeYouTubeUrl = '';
  }

  const btnYouTubeModalClose = document.getElementById('btnYouTubeModalClose');
  if (btnYouTubeModalClose) {
    btnYouTubeModalClose.addEventListener('click', closeYouTubeModal);
  }

  const modalYouTubeTutorial = document.getElementById('modalYouTubeTutorial');
  if (modalYouTubeTutorial) {
    modalYouTubeTutorial.addEventListener('click', (e) => {
      if (e.target === modalYouTubeTutorial) closeYouTubeModal();
    });
  }

  const btnYouTubeOpenExternal = document.getElementById('btnYouTubeOpenExternal');
  if (btnYouTubeOpenExternal) {
    btnYouTubeOpenExternal.addEventListener('click', () => {
      if (activeYouTubeUrl && parseYouTubeId(activeYouTubeUrl)) {
        if (window.electronAPI && window.electronAPI.openExternalUrl) {
          window.electronAPI.openExternalUrl(activeYouTubeUrl);
        } else {
          window.open(activeYouTubeUrl, '_blank');
        }
      }
    });
  }

  function updateAllTutorialBadges() {
    document.querySelectorAll('.btn-tool-tutorial').forEach(btn => {
      const gid = btn.dataset.guideId;
      if (!gid) return;
      const url = getTutorialUrlForFeature(gid, gid);
      if (url && parseYouTubeId(url)) {
        btn.classList.add('has-video');
        btn.innerHTML = '▶ Video Tutorial';
        btn.title = 'Tonton Video Tutorial Praktik di YouTube';
      } else {
        btn.classList.remove('has-video');
        btn.innerHTML = '🎬 Tutorial';
        btn.title = 'Buka Panduan Langkah-Langkah Penggunaan';
      }
    });
  }

  let currentOpenGuideItem = null;

  function refreshTutorialUI() {
    updateAllTutorialBadges();
    if (typeof renderGuideList === 'function') renderGuideList();
    if (currentOpenGuideItem && guideDetailContainer && guideDetailContainer.style.display === 'block') {
      openGuideDetail(currentOpenGuideItem);
    }
  }

  async function loadTutorialLinksCloud(forceRefresh = false) {
    if (!forceRefresh) {
      try {
        const cached = localStorage.getItem('cts_tutorial_links');
        if (cached) {
          cloudTutorials = sanitizeTutorialData(JSON.parse(cached));
          refreshTutorialUI();
        }
      } catch {}
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(GITHUB_TUTORIALS_URL + '?t=' + Date.now(), {
        signal: controller.signal,
        cache: 'no-store'
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === 'object') {
          cloudTutorials = sanitizeTutorialData(data);
          try { localStorage.setItem('cts_tutorial_links', JSON.stringify(cloudTutorials)); } catch {}
          refreshTutorialUI();
          return Object.keys(cloudTutorials).length;
        }
      }
    } catch (err) {
      console.log('[Tutorials] Cloud sync note:', err?.message);
    }

    // Local fallback if cloud was empty
    if (Object.keys(cloudTutorials).length === 0) {
      try {
        const localRes = await fetch('tutorials.json?t=' + Date.now(), { cache: 'no-store' });
        if (localRes.ok) {
          cloudTutorials = sanitizeTutorialData(await localRes.json());
          refreshTutorialUI();
          return Object.keys(cloudTutorials).length;
        }
      } catch {}
    }
    return Object.keys(cloudTutorials).length;
  }

  // Global click listener for .btn-tool-tutorial in all tool headers
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-tool-tutorial');
    if (!btn) return;
    const guideId = btn.dataset.guideId;
    if (!guideId) return;
    const videoUrl = getTutorialUrlForFeature(guideId, guideId);
    const items = getGuideItems();
    const item = items.find(i => i.id === guideId || i.viewId === guideId);
    const title = item ? item.name : 'Video Tutorial';
    if (videoUrl && parseYouTubeId(videoUrl)) {
      openYouTubeModal(videoUrl, title);
    } else {
      switchView('panduan');
      if (item) {
        openGuideDetail(item);
      }
    }
  });

  // Settings: Button Sync Tutorials from Cloud
  const btnSyncTutorialsCloud = document.getElementById('btnSyncTutorialsCloud');
  if (btnSyncTutorialsCloud) {
    btnSyncTutorialsCloud.addEventListener('click', async () => {
      btnSyncTutorialsCloud.disabled = true;
      btnSyncTutorialsCloud.textContent = '⏳ Menyinkronkan...';
      try {
        await loadTutorialLinksCloud();
        showToast('Link video tutorial berhasil disinkronkan dari GitHub!', true);
      } catch (err) {
        showToast('Gagal menyinkronkan: ' + (err.message || 'Koneksi gagal'), false);
      } finally {
        btnSyncTutorialsCloud.disabled = false;
        btnSyncTutorialsCloud.textContent = '🔄 Segarkan Link dari Cloud';
      }
    });
  }

  // Settings: Button Open tutorials.json on GitHub
  const btnOpenTutorialsOnGithub = document.getElementById('btnOpenTutorialsOnGithub');
  if (btnOpenTutorialsOnGithub) {
    btnOpenTutorialsOnGithub.addEventListener('click', () => {
      if (window.electronAPI && window.electronAPI.openExternalUrl) {
        window.electronAPI.openExternalUrl(GITHUB_TUTORIALS_EDIT_URL);
      } else {
        window.open(GITHUB_TUTORIALS_EDIT_URL, '_blank');
      }
    });
  }

  let activeGuideCategory = 'all';
  let activeGuideSearch = '';

  function getGuideItems() {
    if (typeof GUIDE_DATA !== 'undefined' && Array.isArray(GUIDE_DATA)) {
      return GUIDE_DATA;
    }
    if (typeof window !== 'undefined' && Array.isArray(window.GUIDE_DATA)) {
      return window.GUIDE_DATA;
    }
    if (typeof globalThis !== 'undefined' && Array.isArray(globalThis.GUIDE_DATA)) {
      return globalThis.GUIDE_DATA;
    }
    return [];
  }

  function renderGuideList() {
    if (!guideListContainer) return;

    const items = getGuideItems();
    const q = (activeGuideSearch || '').toLowerCase().trim();

    const filtered = items.filter(item => {
      const matchCat = (activeGuideCategory === 'all' || item.category === activeGuideCategory);
      const matchText = !q || (
        item.name.toLowerCase().includes(q) ||
        item.shortDesc.toLowerCase().includes(q) ||
        item.fungsi.toLowerCase().includes(q) ||
        item.kapanDigunakan.toLowerCase().includes(q)
      );
      return matchCat && matchText;
    });

    if (filtered.length === 0) {
      guideListContainer.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--text-dim); padding: 40px 20px;">Tidak ditemukan panduan yang sesuai dengan kata kunci "' + q + '". Coba kata kunci lain.</div>';
      return;
    }

    guideListContainer.innerHTML = '';
    filtered.forEach(item => {
      const card = document.createElement('div');
      card.className = 'guide-card-item';
      card.innerHTML = '<div class="guide-card-top">' +
        '<div class="guide-card-icon">' + item.icon + '</div>' +
        '<div>' +
          '<span class="guide-card-badge">' + item.badge + '</span>' +
          '<div class="guide-card-title">' + item.name + '</div>' +
          '<div class="guide-card-desc">' + item.shortDesc + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="guide-card-footer">' +
        '<span>' + item.categoryLabel + '</span>' +
        '<span>Buka Panduan ➔</span>' +
      '</div>';

      card.addEventListener('click', () => {
        openGuideDetail(item);
      });

      guideListContainer.appendChild(card);
    });
  }

  function openGuideDetail(item) {
    if (!guideDetailContainer || !guideListContainer) return;
    currentOpenGuideItem = item;

    guideListContainer.style.display = 'none';
    guideDetailContainer.style.display = 'block';

    let stepsHtml = '';
    if (item.langkah && item.langkah.length) {
      stepsHtml = '<ol class="guide-step-list">' + item.langkah.map(s => '<li>' + s + '</li>').join('') + '</ol>';
    }

    let settingsHtml = '';
    if (item.pengaturan && item.pengaturan.length) {
      settingsHtml = '<table class="guide-table-settings">' +
        '<thead><tr><th style="width: 35%;">Opsi / Pengaturan</th><th>Fungsi & Penjelasan</th></tr></thead>' +
        '<tbody>' +
        item.pengaturan.map(p => '<tr><td><strong>' + p.opsi + '</strong></td><td>' + p.arti + '</td></tr>').join('') +
        '</tbody></table>';
    }

    let persiapanHtml = '';
    if (item.persiapan && item.persiapan.length) {
      persiapanHtml = '<ul class="guide-step-list" style="list-style-type: disc;">' + item.persiapan.map(p => '<li>' + p + '</li>').join('') + '</ul>';
    }

    const videoUrl = getTutorialUrlForFeature(item.id, item.viewId);
    let videoCardHtml = '';
    if (videoUrl && parseYouTubeId(videoUrl)) {
      videoCardHtml = '<div class="guide-video-card-ready">' +
        '<div style="display: flex; align-items: center; gap: 12px;">' +
          '<div style="background: #ef4444; color: #ffffff; width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>' +
          '</div>' +
          '<div>' +
            '<div style="font-size: 13px; font-weight: 700; color: #f8fafc;">Video Tutorial Praktik Tersedia</div>' +
            '<div style="font-size: 11.5px; color: #cbd5e1;">Tonton langkah kerja nyata di CorelDRAW melalui video YouTube.</div>' +
          '</div>' +
        '</div>' +
        '<button type="button" class="btn-watch-video" id="btnPlayGuideVideo">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>' +
          '<span>Tonton Video</span>' +
        '</button>' +
      '</div>';
    } else {
      videoCardHtml = '<div class="guide-video-card-pending">' +
        '<span style="font-size: 20px;">🎬</span>' +
        '<div style="flex: 1;">' +
          '<div style="font-size: 12px; font-weight: 700; color: #94a3b8;">Video Tutorial Sedang Disiapkan</div>' +
          '<div style="font-size: 11px; color: #64748b;">Video tutorial praktik untuk fitur ini sedang dalam tahap perekaman. Anda dapat langsung mengikuti panduan tertulis di bawah.</div>' +
        '</div>' +
      '</div>';
    }

    guideDetailContainer.innerHTML = '<div class="guide-detail-header">' +
      '<button class="btn-secondary" id="btnBackToGuideList">← Kembali ke Daftar Panduan</button>' +
      '<div style="display: flex; gap: 8px;">' +
        '<button type="button" class="btn-secondary" id="btnRefreshDetailTutorial" style="height: 32px; font-size: 11.5px;" title="Segarkan status video tutorial dari GitHub">🔄 Segarkan Video</button>' +
        (item.viewId ? '<button class="btn-primary" id="btnLaunchFeatureFromGuide">🚀 Langsung Buka Fitur Ini</button>' : '') +
      '</div>' +
    '</div>' +
    '<div style="margin-bottom: 16px;">' +
      '<span class="guide-card-badge">' + item.badge + '</span>' +
      '<h2 style="font-size: 18px; font-weight: 700; color: #f8fafc; margin-top: 4px; margin-bottom: 6px;">' + item.name + '</h2>' +
      '<p style="font-size: 13px; color: #94a3b8;">' + item.shortDesc + '</p>' +
    '</div>' +
    videoCardHtml +
    '<div class="guide-detail-section">' +
      '<div class="guide-section-title">🎯 Fungsi & Kegunaan</div>' +
      '<div class="guide-section-text">' + item.fungsi + '</div>' +
    '</div>' +
    '<div class="guide-detail-section">' +
      '<div class="guide-section-title">💡 Kapan Digunakan</div>' +
      '<div class="guide-section-text">' + item.kapanDigunakan + '</div>' +
    '</div>' +
    (persiapanHtml ? '<div class="guide-detail-section"><div class="guide-section-title">📋 Persiapan Sebelum Pakai</div>' + persiapanHtml + '</div>' : '') +
    '<div class="guide-detail-section">' +
      '<div class="guide-section-title">🚀 Langkah-Langkah Penggunaan</div>' +
      stepsHtml +
    '</div>' +
    (settingsHtml ? '<div class="guide-detail-section"><div class="guide-section-title">⚙️ Penjelasan Opsi & Pengaturan</div>' + settingsHtml + '</div>' : '') +
    '<div class="guide-detail-section">' +
      '<div class="guide-section-title">✅ Hasil yang Diharapkan</div>' +
      '<div class="guide-section-text">' + item.hasil + '</div>' +
    '</div>' +
    '<div class="guide-detail-section" style="margin-bottom: 0;">' +
      '<div class="guide-section-title">⚠️ Catatan Penting</div>' +
      '<div class="guide-section-text">' + item.catatan + '</div>' +
    '</div>';

    const btnPlayGuide = document.getElementById('btnPlayGuideVideo');
    if (btnPlayGuide && videoUrl) {
      btnPlayGuide.addEventListener('click', () => {
        openYouTubeModal(videoUrl, item.name);
      });
    }

    const btnBack = document.getElementById('btnBackToGuideList');
    if (btnBack) {
      btnBack.addEventListener('click', () => {
        currentOpenGuideItem = null;
        guideDetailContainer.style.display = 'none';
        guideListContainer.style.display = 'grid';
      });
    }

    const btnRefreshDetail = document.getElementById('btnRefreshDetailTutorial');
    if (btnRefreshDetail) {
      btnRefreshDetail.addEventListener('click', async () => {
        btnRefreshDetail.textContent = '⏳ Memeriksa...';
        btnRefreshDetail.disabled = true;
        try {
          const count = await loadTutorialLinksCloud(true);
          showToast('Link video tutorial disinkronkan (' + count + ' aktif)', true);
        } catch {
          showToast('Gagal menyinkronkan dari GitHub.', false);
        } finally {
          btnRefreshDetail.textContent = '🔄 Segarkan Video';
          btnRefreshDetail.disabled = false;
        }
      });
    }

    const btnLaunch = document.getElementById('btnLaunchFeatureFromGuide');
    if (btnLaunch && item.viewId) {
      btnLaunch.addEventListener('click', () => {
        switchView(item.viewId);
      });
    }
  }

  // Category Filter clicks
  if (guideCategoryBar) {
    guideCategoryBar.querySelectorAll('.guide-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        guideCategoryBar.querySelectorAll('.guide-cat-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeGuideCategory = btn.getAttribute('data-cat') || 'all';
        if (guideDetailContainer) guideDetailContainer.style.display = 'none';
        if (guideListContainer) guideListContainer.style.display = 'grid';
        renderGuideList();
      });
    });
  }

  // Search input
  if (txtSearchGuide) {
    txtSearchGuide.addEventListener('input', (e) => {
      activeGuideSearch = e.target.value;
      if (guideDetailContainer) guideDetailContainer.style.display = 'none';
      if (guideListContainer) guideListContainer.style.display = 'grid';
      renderGuideList();
    });
  }

  // Titlebar button
  if (btnTitlebarPanduan) {
    btnTitlebarPanduan.addEventListener('click', () => {
      switchView('panduan');
      if (guideDetailContainer) guideDetailContainer.style.display = 'none';
      if (guideListContainer) guideListContainer.style.display = 'grid';
      renderGuideList();
    });
  }

  // First-run experience
  try {
    const hasSeenGuide = localStorage.getItem('cts_has_seen_guide_v1');
    if (!hasSeenGuide && modalFirstRunGuide) {
      setTimeout(() => {
        modalFirstRunGuide.style.display = 'flex';
      }, 800);
    }
  } catch (e) {}

  if (btnOpenFirstRunGuide) {
    btnOpenFirstRunGuide.addEventListener('click', () => {
      try { localStorage.setItem('cts_has_seen_guide_v1', '1'); } catch (e) {}
      if (modalFirstRunGuide) modalFirstRunGuide.style.display = 'none';
      switchView('panduan');
      renderGuideList();
    });
  }

  if (btnSkipFirstRunGuide) {
    btnSkipFirstRunGuide.addEventListener('click', () => {
      try { localStorage.setItem('cts_has_seen_guide_v1', '1'); } catch (e) {}
      if (modalFirstRunGuide) modalFirstRunGuide.style.display = 'none';
    });
  }

  // Initial render when view becomes active
  renderGuideList();
  loadTutorialLinksCloud();

  // ========================================================
  // 14. LAYOUT POLA (AUTO-NESTING LEMBAR CETAK) CONTROLLER
  // ========================================================
  const btnLayoutPolaFetchCorel = document.getElementById('btnLayoutPolaFetchCorel');
  const btnLayoutPolaExecute = document.getElementById('btnLayoutPolaExecute');
  const btnLayoutPolaLoadSample = document.getElementById('btnLayoutPolaLoadSample');
  const btnLayoutPolaClear = document.getElementById('btnLayoutPolaClear');
  const badgeLayoutPolaCount = document.getElementById('badgeLayoutPolaCount');
  const lblLayoutPolaStatusText = document.getElementById('lblLayoutPolaStatusText');

  const numLayoutPolaBoxWidth = document.getElementById('numLayoutPolaBoxWidth');
  const numLayoutPolaBoxHeight = document.getElementById('numLayoutPolaBoxHeight');
  const selLayoutPolaUnitW = document.getElementById('selLayoutPolaUnitW');
  const selLayoutPolaUnitH = document.getElementById('selLayoutPolaUnitH');
  const btnPresetBox1x5 = document.getElementById('btnPresetBox1x5');
  const chkLayoutPolaCreateBox = document.getElementById('chkLayoutPolaCreateBox');

  const numLayoutPolaGap = document.getElementById('numLayoutPolaGap');
  const numLayoutPolaMargin = document.getElementById('numLayoutPolaMargin');
  const chkLayoutPolaAllowRotation = document.getElementById('chkLayoutPolaAllowRotation');
  const chkLayoutPolaAllowRotation90 = document.getElementById('chkLayoutPolaAllowRotation90');

  const badgeLayoutVariantIndex = document.getElementById('badgeLayoutVariantIndex');
  const lblLayoutVariantName = document.getElementById('lblLayoutVariantName');
  const lblLayoutVariantDesc = document.getElementById('lblLayoutVariantDesc');
  const btnLayoutPolaPrev = document.getElementById('btnLayoutPolaPrev');
  const btnLayoutPolaNext = document.getElementById('btnLayoutPolaNext');
  const btnLayoutPolaQuickNext = document.getElementById('btnLayoutPolaQuickNext');

  const lblLayoutStatUsedHeight = document.getElementById('lblLayoutStatUsedHeight');
  const lblLayoutStatEfficiency = document.getElementById('lblLayoutStatEfficiency');
  const lblLayoutStatFitStatus = document.getElementById('lblLayoutStatFitStatus');

  const layoutPolaCanvas = document.getElementById('layoutPolaCanvas');
  const layoutPolaCanvasContainer = document.getElementById('layoutPolaCanvasContainer');
  const layoutPolaTooltip = document.getElementById('layoutPolaTooltip');
  const btnLayoutPreviewFit = document.getElementById('btnLayoutPreviewFit');
  const btnLayoutPreviewZoomIn = document.getElementById('btnLayoutPreviewZoomIn');
  const btnLayoutPreviewZoomOut = document.getElementById('btnLayoutPreviewZoomOut');
  const lblLayoutPolaZoomLevel = document.getElementById('lblLayoutPolaZoomLevel');
  const lblLayoutPolaDimensionsPreview = document.getElementById('lblLayoutPolaDimensionsPreview');

  // State
  let layoutPolaItems = [];
  let layoutPolaVariants = [];
  let layoutPolaCurrentVariantIndex = 0;
  let layoutPolaZoomScale = 1.0;
  let layoutPolaAutoFit = true;
  let layoutPolaHoveredIndex = -1;

  // Preset sample patterns (matches Image 1 and Image 2 from user request)
  const SAMPLE_JERSEY_PATTERNS = [
    { index: 1, staticId: 101, widthCm: 47.0, heightCm: 74.5, name: 'Jersey #18 (Depan)' },
    { index: 2, staticId: 102, widthCm: 47.5, heightCm: 75.0, name: 'Jersey #18 (Belakang)' },
    { index: 3, staticId: 103, widthCm: 48.0, heightCm: 75.5, name: 'Jersey #33 (Depan)' },
    { index: 4, staticId: 104, widthCm: 48.5, heightCm: 76.0, name: 'Jersey #33 (Belakang)' },
    { index: 5, staticId: 105, widthCm: 46.0, heightCm: 28.5, name: 'Lengan Kiri #18' },
    { index: 6, staticId: 106, widthCm: 46.0, heightCm: 28.5, name: 'Lengan Kanan #18' },
    { index: 7, staticId: 107, widthCm: 46.5, heightCm: 29.0, name: 'Lengan Kiri #33' },
    { index: 8, staticId: 108, widthCm: 46.5, heightCm: 29.0, name: 'Lengan Kanan #33' },
    { index: 9, staticId: 109, widthCm: 42.0, heightCm: 6.5, name: 'Kerah Leher V-Neck' },
    { index: 10, staticId: 110, widthCm: 42.0, heightCm: 6.5, name: 'Kerah Leher #33' },
    { index: 11, staticId: 111, widthCm: 38.0, heightCm: 11.5, name: 'Kotak Strip Manset A' },
    { index: 12, staticId: 112, widthCm: 38.0, heightCm: 11.5, name: 'Kotak Strip Manset B' }
  ];

  function getLayoutBoxDimensionsCm() {
    let w = parseFloat(numLayoutPolaBoxWidth?.value) || 100;
    let h = parseFloat(numLayoutPolaBoxHeight?.value) || 500;
    const unitW = selLayoutPolaUnitW?.value || 'cm';
    const unitH = selLayoutPolaUnitH?.value || 'cm';

    if (unitW === 'm') w = w * 100;
    else if (unitW === 'mm') w = w / 10;

    if (unitH === 'm') h = h * 100;
    else if (unitH === 'mm') h = h / 10;

    return {
      boxW: Math.max(10, Math.round(w * 100) / 100),
      boxH: Math.max(10, Math.round(h * 100) / 100)
    };
  }

  function getLayoutGapAndMarginCm() {
    const rawGap = parseFloat(numLayoutPolaGap?.value);
    const gap = isNaN(rawGap) ? 0.0 : Math.max(0, rawGap);
    const rawMargin = parseFloat(numLayoutPolaMargin?.value);
    const margin = isNaN(rawMargin) ? 0.0 : Math.max(0, rawMargin);
    const allowRotation = !!chkLayoutPolaAllowRotation?.checked;
    const allowRotation90 = !chkLayoutPolaAllowRotation90 || !!chkLayoutPolaAllowRotation90.checked;
    return { gap, margin, allowRotation, allowRotation90 };
  }

  function updateLayoutStatsAndUI() {
    if (!layoutPolaVariants || layoutPolaVariants.length === 0) {
      if (badgeLayoutVariantIndex) badgeLayoutVariantIndex.innerText = 'Variasi 0 / 0';
      if (lblLayoutVariantName) lblLayoutVariantName.innerText = 'Belum Ada Pola';
      if (lblLayoutVariantDesc) lblLayoutVariantDesc.innerText = 'Ambil pola dari CorelDRAW atau klik "Muat Contoh" untuk memulai kalkulasi layout.';
      if (lblLayoutStatUsedHeight) lblLayoutStatUsedHeight.innerText = '0 cm';
      if (lblLayoutStatEfficiency) lblLayoutStatEfficiency.innerText = '0%';
      if (lblLayoutStatFitStatus) {
        lblLayoutStatFitStatus.innerText = '-';
        lblLayoutStatFitStatus.style.color = 'var(--text-muted)';
      }
      return;
    }

    const cur = layoutPolaVariants[layoutPolaCurrentVariantIndex];
    if (!cur) return;

    if (badgeLayoutVariantIndex) {
      badgeLayoutVariantIndex.innerText = `Variasi ${layoutPolaCurrentVariantIndex + 1} / ${layoutPolaVariants.length}`;
    }
    if (lblLayoutVariantName) lblLayoutVariantName.innerText = cur.name;
    if (lblLayoutVariantDesc) lblLayoutVariantDesc.innerText = cur.desc;

    if (lblLayoutStatUsedHeight) {
      lblLayoutStatUsedHeight.innerText = `${cur.usedHeight} cm (dari ${cur.boxH} cm)`;
    }
    if (lblLayoutStatEfficiency) {
      lblLayoutStatEfficiency.innerText = `${cur.efficiency}%`;
    }
    if (lblLayoutStatFitStatus) {
      if (cur.allFit) {
        lblLayoutStatFitStatus.innerText = `Semua Muat ✓ (${cur.positions.length} Pola)`;
        lblLayoutStatFitStatus.style.color = '#10b981';
      } else {
        lblLayoutStatFitStatus.innerText = `Sebagian Melebihi Kotak ⚠️`;
        lblLayoutStatFitStatus.style.color = '#ef4444';
      }
    }

    const { boxW, boxH } = getLayoutBoxDimensionsCm();
    if (lblLayoutPolaDimensionsPreview) {
      lblLayoutPolaDimensionsPreview.innerText = `Kotak: ${boxW} cm × ${boxH} cm (${(boxW / 100).toFixed(1)}m × ${(boxH / 100).toFixed(1)}m)`;
    }
  }

  // High Performance 2D Bin Packer (MaxRects with 90° rotation and zero-waste cavity packing)
  class LayoutPolaMaxRectsPacker {
    constructor(binW, binH, gap, margin, allow180, allow90) {
      this.binW = binW;
      this.binH = binH;
      this.gap = Math.max(0, gap);
      this.margin = Math.max(0, margin);
      this.allow180 = allow180;
      this.allow90 = allow90;

      const usableW = Math.max(1, this.binW - 2 * this.margin);
      const usableH = Math.max(1, this.binH - 2 * this.margin);
      this.usedRectangles = [];
      this.freeRectangles = [{ x: this.margin, y: this.margin, w: usableW, h: usableH }];
    }

    insert(it, heuristic = 'BAF') {
      let bestNode = null;
      let bestScore1 = Infinity;
      let bestScore2 = Infinity;

      const isHorizontal = it.widthCm > it.heightCm;
      const orientations = [{ w: it.widthCm, h: it.heightCm, rot: 0 }];

      if (this.allow180) {
        orientations.push({ w: it.widthCm, h: it.heightCm, rot: 180 });
      }

      // Test 90° rotation (standing up) if general 90° allowed OR if horizontal object fits better
      if (this.allow90 || isHorizontal) {
        orientations.push({ w: it.heightCm, h: it.widthCm, rot: 90 });
      }

      for (let r = 0; r < this.freeRectangles.length; r++) {
        const free = this.freeRectangles[r];

        for (let o = 0; o < orientations.length; o++) {
          const { w, h, rot } = orientations[o];
          if (free.w >= w && free.h >= h) {
            let score1 = 0;
            let score2 = 0;

            if (heuristic === 'BSSF') {
              const leftoverH = free.h - h;
              const leftoverW = free.w - w;
              score1 = Math.min(leftoverW, leftoverH);
              score2 = Math.max(leftoverW, leftoverH);
            } else if (heuristic === 'BAF') {
              score1 = (free.w * free.h) - (w * h);
              score2 = Math.min(free.w - w, free.h - h);
            } else if (heuristic === 'BL') {
              score1 = free.y + h;
              score2 = free.x;
            } else if (heuristic === 'CP') {
              score1 = -(this.contactPerimeter(free.x, free.y, w, h));
              score2 = free.y;
            }

            // Preference: keep upright jersey bodies upright unless rotated 90 saves space
            if (!isHorizontal && rot === 90) {
              score1 += 2.0;
            }

            if (score1 < bestScore1 || (score1 === bestScore1 && score2 < bestScore2)) {
              bestScore1 = score1;
              bestScore2 = score2;
              bestNode = {
                index: it.index,
                staticId: it.staticId,
                name: it.name,
                xCm: Math.round(free.x * 100) / 100,
                yCm: Math.round(free.y * 100) / 100,
                wCm: Math.round(w * 100) / 100,
                hCm: Math.round(h * 100) / 100,
                origWidthCm: it.widthCm,
                origHeightCm: it.heightCm,
                rotate: rot
              };
            }
          }
        }
      }

      if (!bestNode) {
        let maxBottom = this.margin;
        for (const ur of this.usedRectangles) {
          maxBottom = Math.max(maxBottom, ur.yCm + ur.hCm + this.gap);
        }
        bestNode = {
          index: it.index,
          staticId: it.staticId,
          name: it.name,
          xCm: this.margin,
          yCm: Math.round(maxBottom * 100) / 100,
          wCm: it.widthCm,
          hCm: it.heightCm,
          origWidthCm: it.widthCm,
          origHeightCm: it.heightCm,
          rotate: 0
        };
      }

      this.placeRectangle(bestNode);
      return bestNode;
    }

    contactPerimeter(x, y, w, h) {
      let perim = 0;
      if (x === this.margin || x + w >= this.binW - this.margin) perim += h;
      if (y === this.margin || y + h >= this.binH - this.margin) perim += w;

      for (const u of this.usedRectangles) {
        if ((Math.abs(u.xCm - (x + w + this.gap)) < 0.05 || Math.abs(u.xCm + u.wCm + this.gap - x) < 0.05) &&
            !(u.yCm >= y + h || u.yCm + u.hCm <= y)) {
          perim += Math.min(y + h, u.yCm + u.hCm) - Math.max(y, u.yCm);
        }
        if ((Math.abs(u.yCm - (y + h + this.gap)) < 0.05 || Math.abs(u.yCm + u.hCm + this.gap - y) < 0.05) &&
            !(u.xCm >= x + w || u.xCm + u.wCm <= x)) {
          perim += Math.min(x + w, u.xCm + u.wCm) - Math.max(x, u.xCm);
        }
      }
      return perim;
    }

    placeRectangle(node) {
      if (!node) return;
      const nextFree = [];
      for (let i = 0; i < this.freeRectangles.length; i++) {
        const free = this.freeRectangles[i];
        if (!free) continue;
        if (this.splitFreeNode(free, node, nextFree)) {
          // Overlapped: split sub-rectangles were pushed to nextFree
        } else {
          // Did not overlap: keep this free rectangle
          nextFree.push(free);
        }
      }
      this.freeRectangles = nextFree;
      this.pruneFreeList();
      this.usedRectangles.push(node);
    }

    splitFreeNode(free, used, outList) {
      if (!free || !used) return false;
      const usedW = used.wCm + this.gap;
      const usedH = used.hCm + this.gap;

      // Check if used rectangle actually intersects with free rectangle
      if (
        used.xCm >= free.x + free.w ||
        used.xCm + usedW <= free.x ||
        used.yCm >= free.y + free.h ||
        used.yCm + usedH <= free.y
      ) {
        return false;
      }

      // Subdivide free into up to 4 non-overlapping surrounding rectangles
      if (used.yCm > free.y && used.yCm < free.y + free.h) {
        const h = used.yCm - free.y;
        if (h > 0.05) outList.push({ ...free, h });
      }
      if (used.yCm + usedH < free.y + free.h) {
        const newY = used.yCm + usedH;
        const h = (free.y + free.h) - newY;
        if (h > 0.05) outList.push({ ...free, y: newY, h });
      }
      if (used.xCm > free.x && used.xCm < free.x + free.w) {
        const w = used.xCm - free.x;
        if (w > 0.05) outList.push({ ...free, w });
      }
      if (used.xCm + usedW < free.x + free.w) {
        const newX = used.xCm + usedW;
        const w = (free.x + free.w) - newX;
        if (w > 0.05) outList.push({ ...free, x: newX, w });
      }
      return true;
    }

    pruneFreeList() {
      this.freeRectangles = this.freeRectangles.filter(r => r && r.w > 0.1 && r.h > 0.1);
      for (let i = 0; i < this.freeRectangles.length; i++) {
        for (let j = i + 1; j < this.freeRectangles.length; j++) {
          const a = this.freeRectangles[i];
          const b = this.freeRectangles[j];
          if (!a || !b) continue;
          if (this.isContainedIn(a, b)) {
            this.freeRectangles.splice(i, 1);
            i--;
            break;
          }
          if (this.isContainedIn(b, a)) {
            this.freeRectangles.splice(j, 1);
            j--;
          }
        }
      }
    }

    isContainedIn(a, b) {
      if (!a || !b) return false;
      return a.x >= b.x - 0.01 && a.y >= b.y - 0.01 &&
             a.x + a.w <= b.x + b.w + 0.01 &&
             a.y + a.h <= b.y + b.h + 0.01;
    }
  }

  function computeAllLayoutVariants() {
    if (!layoutPolaItems || layoutPolaItems.length === 0) {
      layoutPolaVariants = [];
      layoutPolaCurrentVariantIndex = 0;
      updateLayoutStatsAndUI();
      renderLayoutPolaCanvas();
      return;
    }

    const { boxW, boxH } = getLayoutBoxDimensionsCm();
    const { gap, margin, allowRotation, allowRotation90 } = getLayoutGapAndMarginCm();

    const variants = [];

    // VARIANT 1: Nesting Kompak Otomatis (MaxRects BAF + Rotasi 90° Cerdas)
    {
      const sorted = [...layoutPolaItems].sort((a, b) => {
        const aBody = a.heightCm > 50 ? 1 : 0;
        const bBody = b.heightCm > 50 ? 1 : 0;
        if (aBody !== bBody) return bBody - aBody;
        return (b.widthCm * b.heightCm) - (a.widthCm * a.heightCm);
      });

      const packer = new LayoutPolaMaxRectsPacker(boxW, boxH, gap, margin, allowRotation, allowRotation90);
      const positions = sorted.map(it => packer.insert(it, 'BAF'));
      let usedH = 0;
      positions.forEach(p => { usedH = Math.max(usedH, p.yCm + p.hCm); });

      variants.push({
        id: 'maxrects_baf',
        name: 'Nesting Kompak Otomatis (MaxRects 2D + Rotasi 90°)',
        desc: 'Mengisi celah dan ruang kosong secara otomatis, merotasi kotak/pola horizontal 90° agar berdiri di sisi lengan tanpa menyisakan space.',
        positions,
        usedHeight: Math.round((usedH + margin) * 10) / 10,
        boxW,
        boxH
      });
    }

    // VARIANT 2: Pengisi Celah Maksimal (Pocket-Filler 90°)
    {
      const sorted = [...layoutPolaItems].sort((a, b) => (b.widthCm * b.heightCm) - (a.widthCm * a.heightCm));
      const packer = new LayoutPolaMaxRectsPacker(boxW, boxH, gap, margin, allowRotation, allowRotation90);
      const positions = sorted.map(it => packer.insert(it, 'CP'));
      let usedH = 0;
      positions.forEach(p => { usedH = Math.max(usedH, p.yCm + p.hCm); });

      variants.push({
        id: 'pocket_filler',
        name: 'Pengisi Celah Maksimal (Pocket-Filler 90°)',
        desc: 'Menempelkan pola seketat mungkin ke tepi pola lain dan merapatkan kotak ke celah kosong samping.',
        positions,
        usedHeight: Math.round((usedH + margin) * 10) / 10,
        boxW,
        boxH
      });
    }

    // VARIANT 3: Best Short Side Fit (BSSF) Sudut Padat
    {
      const sorted = [...layoutPolaItems].sort((a, b) => Math.max(b.widthCm, b.heightCm) - Math.max(a.widthCm, a.heightCm));
      const packer = new LayoutPolaMaxRectsPacker(boxW, boxH, gap, margin, allowRotation, allowRotation90);
      const positions = sorted.map(it => packer.insert(it, 'BSSF'));
      let usedH = 0;
      positions.forEach(p => { usedH = Math.max(usedH, p.yCm + p.hCm); });

      variants.push({
        id: 'bssf_tight',
        name: 'Best Short Side Fit (BSSF Sudut Padat)',
        desc: 'Meminimalkan sisa sudut dan lekukan pendek, menghasilkan susunan balok yang sangat rapi dan padat.',
        positions,
        usedHeight: Math.round((usedH + margin) * 10) / 10,
        boxW,
        boxH
      });
    }

    // VARIANT 4: Sejajar Rapi & Pengisi Sisi (Sleeve & Strip Interlock)
    {
      const sorted = [...layoutPolaItems].sort((a, b) => {
        if (Math.abs(b.heightCm - a.heightCm) > 5) return b.heightCm - a.heightCm;
        return b.widthCm - a.widthCm;
      });

      const packer = new LayoutPolaMaxRectsPacker(boxW, boxH, gap, margin, allowRotation, allowRotation90);
      const positions = sorted.map(it => packer.insert(it, 'BAF'));
      let usedH = 0;
      positions.forEach(p => { usedH = Math.max(usedH, p.yCm + p.hCm); });

      variants.push({
        id: 'sleeve_interlock',
        name: 'Sejajar Rapi & Pengisi Sisi (Sleeve & Strip Interlock)',
        desc: 'Menata badan dan lengan secara teratur, lalu menyisipkan kotak dan kerah berdiri di sisa lebar roll.',
        positions,
        usedHeight: Math.round((usedH + margin) * 10) / 10,
        boxW,
        boxH
      });
    }

    // VARIANT 5: Bottom-Left (BLD) Terpadat
    {
      const sorted = [...layoutPolaItems].sort((a, b) => (b.widthCm * b.heightCm) - (a.widthCm * a.heightCm));
      const packer = new LayoutPolaMaxRectsPacker(boxW, boxH, gap, margin, allowRotation, allowRotation90);
      const positions = sorted.map(it => packer.insert(it, 'BL'));
      let usedH = 0;
      positions.forEach(p => { usedH = Math.max(usedH, p.yCm + p.hCm); });

      variants.push({
        id: 'bld_compact',
        name: 'Bottom-Left (BLD) Paling Efisien',
        desc: 'Menempatkan pola dari kiri atas ke bawah secara berurutan dengan rotasi 90° adaptif.',
        positions,
        usedHeight: Math.round((usedH + margin) * 10) / 10,
        boxW,
        boxH
      });
    }

    const totalPatternArea = layoutPolaItems.reduce((acc, it) => acc + (it.widthCm * it.heightCm), 0);
    variants.forEach(v => {
      const boundingArea = boxW * Math.max(1, v.usedHeight);
      v.efficiency = Math.min(100, Math.round((totalPatternArea / boundingArea) * 100));
      v.allFit = v.positions.every(p => (p.xCm + p.wCm <= boxW + 0.5) && (p.yCm + p.hCm <= boxH + 0.5));
    });

    layoutPolaVariants = variants;
    if (layoutPolaCurrentVariantIndex >= variants.length) {
      layoutPolaCurrentVariantIndex = 0;
    }

    updateLayoutStatsAndUI();
    renderLayoutPolaCanvas();
  }

  // Render High-DPI Visualizer Canvas
  function renderLayoutPolaCanvas() {
    if (!layoutPolaCanvas) return;
    const ctx = layoutPolaCanvas.getContext('2d');
    if (!ctx) return;

    const canvasW = layoutPolaCanvas.width;
    const canvasH = layoutPolaCanvas.height;

    // Clear background
    ctx.fillStyle = '#0b0f19';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Subtle background grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvasW; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasH);
      ctx.stroke();
    }
    for (let y = 0; y < canvasH; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasW, y);
      ctx.stroke();
    }

    if (!layoutPolaVariants || layoutPolaVariants.length === 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = '14px Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Belum ada data pola. Klik "Ambil Pola dari CorelDRAW" atau "Muat Contoh".', canvasW / 2, canvasH / 2);
      return;
    }

    const cur = layoutPolaVariants[layoutPolaCurrentVariantIndex];
    if (!cur) return;

    const { boxW, boxH } = getLayoutBoxDimensionsCm();

    // Determine scale to fit container box comfortably on canvas
    const marginPadX = 60;
    const marginPadY = 60;
    const availW = canvasW - marginPadX * 2;
    const availH = canvasH - marginPadY * 2;

    const baseScale = Math.min(availW / boxW, availH / boxH);
    const scale = layoutPolaAutoFit ? baseScale : baseScale * layoutPolaZoomScale;

    const renderBoxW = boxW * scale;
    const renderBoxH = boxH * scale;
    const originX = (canvasW - renderBoxW) / 2;
    const originY = marginPadY / 2;

    // 1. Draw Container Box Background & Border
    ctx.fillStyle = '#111827';
    ctx.fillRect(originX, originY, renderBoxW, renderBoxH);

    // Container border
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2;
    ctx.strokeRect(originX, originY, renderBoxW, renderBoxH);

    // Box dimensions labels
    ctx.fillStyle = '#60a5fa';
    ctx.font = 'bold 11px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${boxW} cm (Lebar Kotak)`, originX + renderBoxW / 2, originY - 8);

    ctx.save();
    ctx.translate(originX - 10, originY + renderBoxH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText(`${boxH} cm (Tinggi Kotak)`, 0, 0);
    ctx.restore();

    // 2. Draw Used Height / Cutline Marker
    const usedY = originY + cur.usedHeight * scale;
    if (cur.usedHeight > 0 && cur.usedHeight <= boxH) {
      ctx.save();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(originX - 15, usedY);
      ctx.lineTo(originX + renderBoxW + 15, usedY);
      ctx.stroke();

      ctx.fillStyle = '#f87171';
      ctx.font = 'bold 10px Segoe UI, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`Panjang Terpakai: ${cur.usedHeight} cm`, originX + renderBoxW + 20, usedY + 3);
      ctx.restore();
    }

    // 3. Draw Pattern Cards
    cur.positions.forEach((p, idx) => {
      const px = originX + p.xCm * scale;
      const py = originY + p.yCm * scale;
      const pw = p.wCm * scale;
      const ph = p.hCm * scale;

      const isHovered = (idx === layoutPolaHoveredIndex);
      const isOutOfBounds = (p.xCm + p.wCm > boxW + 0.1) || (p.yCm + p.hCm > boxH + 0.1);

      // Card Body
      ctx.fillStyle = isOutOfBounds
        ? 'rgba(239, 68, 68, 0.25)'
        : (isHovered ? '#334155' : '#1e293b');
      ctx.strokeStyle = isOutOfBounds
        ? '#ef4444'
        : (isHovered ? '#60a5fa' : '#38bdf8');
      ctx.lineWidth = isHovered ? 2.5 : 1.5;

      // Rounded rectangle
      const radius = Math.min(6, pw / 6, ph / 6);
      ctx.beginPath();
      ctx.roundRect(px, py, pw, ph, radius);
      ctx.fill();
      ctx.stroke();

      // Jersey Silhouette / Icon
      ctx.save();
      ctx.translate(px + pw / 2, py + ph / 2);
      ctx.fillStyle = isHovered ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.08)';
      const iconSize = Math.min(pw * 0.5, ph * 0.4);
      if (iconSize > 15) {
        ctx.beginPath();
        ctx.arc(0, -iconSize * 0.2, iconSize * 0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(-iconSize * 0.4, -iconSize * 0.1, iconSize * 0.8, iconSize * 0.7);
      }
      ctx.restore();

      // Card Text Label (Pola Name & Dimensions)
      ctx.fillStyle = isOutOfBounds ? '#fca5a5' : '#ffffff';
      ctx.textAlign = 'center';
      
      const fontSize = Math.max(9, Math.min(13, pw / 6));
      ctx.font = `bold ${fontSize}px Segoe UI, sans-serif`;
      
      if (ph > 35) {
        ctx.fillText(p.name || `Pola ${idx + 1}`, px + pw / 2, py + ph / 2 - 2);
        ctx.font = `${Math.max(8, fontSize - 2)}px Segoe UI, sans-serif`;
        ctx.fillStyle = isOutOfBounds ? '#fecaca' : '#94a3b8';
        ctx.fillText(`${p.wCm} × ${p.hCm} cm`, px + pw / 2, py + ph / 2 + fontSize);
      } else {
        ctx.fillText(`${p.name || idx + 1} (${p.wCm}×${p.hCm})`, px + pw / 2, py + ph / 2 + 3);
      }

      // If Rotated Badge
      if (p.rotate === 180) {
        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 9px Segoe UI, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('180° ↻', px + pw - 4, py + 12);
      } else if (p.rotate === 90) {
        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 9px Segoe UI, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('90° ↻', px + pw - 4, py + 12);
      }
    });
  }

  // Next / Previous Layout Variant Handlers
  function nextLayoutVariant() {
    if (!layoutPolaVariants || layoutPolaVariants.length === 0) return;
    layoutPolaCurrentVariantIndex = (layoutPolaCurrentVariantIndex + 1) % layoutPolaVariants.length;
    updateLayoutStatsAndUI();
    renderLayoutPolaCanvas();
  }

  function prevLayoutVariant() {
    if (!layoutPolaVariants || layoutPolaVariants.length === 0) return;
    layoutPolaCurrentVariantIndex = (layoutPolaCurrentVariantIndex - 1 + layoutPolaVariants.length) % layoutPolaVariants.length;
    updateLayoutStatsAndUI();
    renderLayoutPolaCanvas();
  }

  if (btnLayoutPolaNext) btnLayoutPolaNext.addEventListener('click', nextLayoutVariant);
  if (btnLayoutPolaQuickNext) btnLayoutPolaQuickNext.addEventListener('click', nextLayoutVariant);
  if (btnLayoutPolaPrev) btnLayoutPolaPrev.addEventListener('click', prevLayoutVariant);

  // Form Inputs Auto-Recalculate
  [numLayoutPolaBoxWidth, numLayoutPolaBoxHeight, selLayoutPolaUnitW, selLayoutPolaUnitH, numLayoutPolaGap, numLayoutPolaMargin, chkLayoutPolaAllowRotation, chkLayoutPolaAllowRotation90].forEach(el => {
    if (el) {
      el.addEventListener('input', () => computeAllLayoutVariants());
      el.addEventListener('change', () => computeAllLayoutVariants());
    }
  });

  // Preset Chips
  document.querySelectorAll('.btn-preset-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const w = btn.getAttribute('data-w');
      const h = btn.getAttribute('data-h');
      if (w && numLayoutPolaBoxWidth) numLayoutPolaBoxWidth.value = w;
      if (h && numLayoutPolaBoxHeight) numLayoutPolaBoxHeight.value = h;
      if (selLayoutPolaUnitW) selLayoutPolaUnitW.value = 'cm';
      if (selLayoutPolaUnitH) selLayoutPolaUnitH.value = 'cm';
      computeAllLayoutVariants();
    });
  });

  if (btnPresetBox1x5) {
    btnPresetBox1x5.addEventListener('click', () => {
      if (numLayoutPolaBoxWidth) numLayoutPolaBoxWidth.value = '100';
      if (numLayoutPolaBoxHeight) numLayoutPolaBoxHeight.value = '500';
      if (selLayoutPolaUnitW) selLayoutPolaUnitW.value = 'cm';
      if (selLayoutPolaUnitH) selLayoutPolaUnitH.value = 'cm';
      computeAllLayoutVariants();
    });
  }

  // Load Sample Patterns Button
  if (btnLayoutPolaLoadSample) {
    btnLayoutPolaLoadSample.addEventListener('click', () => {
      layoutPolaItems = JSON.parse(JSON.stringify(SAMPLE_JERSEY_PATTERNS));
      if (badgeLayoutPolaCount) badgeLayoutPolaCount.innerText = `${layoutPolaItems.length} Pola`;
      if (lblLayoutPolaStatusText) {
        lblLayoutPolaStatusText.innerText = `Memuat contoh simulasi ${layoutPolaItems.length} pola jersey lengkap (depan, belakang, nomor).`;
      }
      computeAllLayoutVariants();
      showToast(`Berhasil memuat contoh ${layoutPolaItems.length} pola jersey!`);
    });
  }

  // Clear / Reset Button
  if (btnLayoutPolaClear) {
    btnLayoutPolaClear.addEventListener('click', () => {
      layoutPolaItems = [];
      layoutPolaVariants = [];
      layoutPolaCurrentVariantIndex = 0;
      if (badgeLayoutPolaCount) badgeLayoutPolaCount.innerText = '0 Pola';
      if (lblLayoutPolaStatusText) {
        lblLayoutPolaStatusText.innerText = 'Pola di-reset. Silakan ambil dari CorelDRAW atau klik "Muat Contoh".';
      }
      updateLayoutStatsAndUI();
      renderLayoutPolaCanvas();
    });
  }

  // Result Modal & Corel Version Dropdown Helpers
  const selLayoutPolaCorelVer = document.getElementById('selLayoutPolaCorelVer');
  if (selLayoutPolaCorelVer) {
    if (window.corelAPI?.getPreferredCorelVersion) {
      window.corelAPI.getPreferredCorelVersion().then((res) => {
        if (res && res.preferredVersion) {
          selLayoutPolaCorelVer.value = res.preferredVersion;
        }
      }).catch(() => {});
    }
    selLayoutPolaCorelVer.addEventListener('change', async () => {
      const chosenVer = selLayoutPolaCorelVer.value;
      if (selTargetCorelVersion) selTargetCorelVersion.value = chosenVer;
      if (window.corelAPI?.setPreferredCorelVersion) {
        await window.corelAPI.setPreferredCorelVersion(chosenVer);
        await updateCorelStatus();
        const selText = selLayoutPolaCorelVer.options[selLayoutPolaCorelVer.selectedIndex].text;
        showToast(`Target CorelDRAW: ${selText}`);
      }
    });
  }

  const layoutPolaResultModal = document.getElementById('layoutPolaResultModal');
  const layoutPolaResultCard = document.getElementById('layoutPolaResultCard');
  const layoutPolaResultIcon = document.getElementById('layoutPolaResultIcon');
  const layoutPolaResultTitle = document.getElementById('layoutPolaResultTitle');
  const layoutPolaResultDesc = document.getElementById('layoutPolaResultDesc');
  const layoutPolaResultStatsRow = document.getElementById('layoutPolaResultStatsRow');
  const lblResultUsedHeight = document.getElementById('lblResultUsedHeight');
  const lblResultEfficiency = document.getElementById('lblResultEfficiency');
  const lblResultFitStatus = document.getElementById('lblResultFitStatus');
  const btnLayoutPolaResultClose = document.getElementById('btnLayoutPolaResultClose');

  function showLayoutPolaResultModal(isSuccess, title, desc, meta = null) {
    if (!layoutPolaResultModal) return;

    if (layoutPolaResultCard) {
      layoutPolaResultCard.className = `layout-pola-modal-card result ${isSuccess ? 'success' : 'error'}`;
    }
    if (layoutPolaResultIcon) {
      layoutPolaResultIcon.className = `layout-pola-result-icon ${isSuccess ? 'success' : 'error'}`;
      layoutPolaResultIcon.innerHTML = isSuccess ? '&check;' : '&times;';
    }
    if (layoutPolaResultTitle) layoutPolaResultTitle.innerText = title;
    if (layoutPolaResultDesc) layoutPolaResultDesc.innerText = desc;

    if (meta && isSuccess) {
      if (layoutPolaResultStatsRow) layoutPolaResultStatsRow.style.display = 'flex';
      if (lblResultUsedHeight) lblResultUsedHeight.innerText = `${meta.usedHeight} cm`;
      if (lblResultEfficiency) lblResultEfficiency.innerText = `${meta.efficiency}%`;
      if (lblResultFitStatus) {
        lblResultFitStatus.innerText = meta.allFit ? 'Semua Muat ✓' : 'Melebihi Kotak ⚠️';
        lblResultFitStatus.style.color = meta.allFit ? '#10b981' : '#ef4444';
      }
    } else {
      if (layoutPolaResultStatsRow) layoutPolaResultStatsRow.style.display = 'none';
    }

    layoutPolaResultModal.style.display = 'flex';
  }

  if (btnLayoutPolaResultClose) {
    btnLayoutPolaResultClose.addEventListener('click', () => {
      if (layoutPolaResultModal) layoutPolaResultModal.style.display = 'none';
    });
  }
  if (layoutPolaResultModal) {
    layoutPolaResultModal.addEventListener('click', (e) => {
      if (e.target === layoutPolaResultModal) {
        layoutPolaResultModal.style.display = 'none';
      }
    });
  }

  // Fetch Selection from CorelDRAW
  if (btnLayoutPolaFetchCorel) {
    btnLayoutPolaFetchCorel.addEventListener('click', async () => {
      try {
        if (!window.corelAPI?.layoutPolaGetSelection) {
          showLayoutPolaResultModal(false, 'API Tidak Tersedia', 'Layanan bridge CorelDRAW tidak terhubung.');
          return;
        }

        btnLayoutPolaFetchCorel.disabled = true;
        btnLayoutPolaFetchCorel.innerText = 'Memeriksa Corel...';

        const res = await window.corelAPI.layoutPolaGetSelection();
        btnLayoutPolaFetchCorel.disabled = false;
        btnLayoutPolaFetchCorel.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px; vertical-align: middle;"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg> Ambil Pola dari CorelDRAW`;

        if (res && res.success && res.items && res.items.length > 0) {
          layoutPolaItems = res.items;
          if (badgeLayoutPolaCount) badgeLayoutPolaCount.innerText = `${layoutPolaItems.length} Pola`;
          if (lblLayoutPolaStatusText) {
            lblLayoutPolaStatusText.innerText = `Berhasil mendeteksi ${layoutPolaItems.length} pola aktif dari dokumen CorelDRAW.`;
          }

          if (res.containerDetected) {
            if (numLayoutPolaBoxWidth) numLayoutPolaBoxWidth.value = res.containerDetected.widthCm;
            if (numLayoutPolaBoxHeight) numLayoutPolaBoxHeight.value = res.containerDetected.heightCm;
            if (selLayoutPolaUnitW) selLayoutPolaUnitW.value = 'cm';
            if (selLayoutPolaUnitH) selLayoutPolaUnitH.value = 'cm';
          }

          computeAllLayoutVariants();
          showLayoutPolaResultModal(
            true,
            'Pola Berhasil Dideteksi!',
            `Berhasil membaca ${layoutPolaItems.length} pola dari CorelDRAW. Silakan tinjau preview susunan dan pilih variasi yang diinginkan.`
          );
        } else {
          showLayoutPolaResultModal(
            false,
            'Pola Tidak Ditemukan',
            res?.message || 'Tidak ada objek pola yang diseleksi di CorelDRAW. Silakan blok pola di CorelDRAW terlebih dahulu lalu klik Ambil Pola.'
          );
        }
      } catch (err) {
        if (btnLayoutPolaFetchCorel) {
          btnLayoutPolaFetchCorel.disabled = false;
          btnLayoutPolaFetchCorel.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px; vertical-align: middle;"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg> Ambil Pola dari CorelDRAW`;
        }
        showLayoutPolaResultModal(false, 'Gagal Membaca CorelDRAW', err.message);
      }
    });
  }

  // Execute Layout in CorelDRAW
  if (btnLayoutPolaExecute) {
    btnLayoutPolaExecute.addEventListener('click', async () => {
      try {
        if (!layoutPolaVariants || layoutPolaVariants.length === 0) {
          showLayoutPolaResultModal(false, 'Belum Ada Pola', 'Silakan ambil pola dari CorelDRAW atau gunakan contoh pola terlebih dahulu.');
          return;
        }

        const curVariant = layoutPolaVariants[layoutPolaCurrentVariantIndex];
        if (!curVariant || !curVariant.positions || curVariant.positions.length === 0) {
          showLayoutPolaResultModal(false, 'Susunan Kosong', 'Data koordinat susunan pola tidak valid.');
          return;
        }

        const { boxW, boxH } = getLayoutBoxDimensionsCm();
        const { gap, margin } = getLayoutGapAndMarginCm();
        const createBox = !!chkLayoutPolaCreateBox?.checked;

        btnLayoutPolaExecute.disabled = true;
        btnLayoutPolaExecute.innerText = 'Menata di Corel...';

        const payload = {
          boxWidthCm: boxW,
          boxHeightCm: boxH,
          createBox,
          gapCm: gap,
          marginCm: margin,
          items: curVariant.positions
        };

        const res = await window.corelAPI.layoutPolaExecute(payload);
        btnLayoutPolaExecute.disabled = false;
        btnLayoutPolaExecute.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px; vertical-align: middle;"><polyline points="20 6 9 17 4 12"/></svg> Terapkan ke CorelDRAW`;

        if (res && res.success) {
          showLayoutPolaResultModal(
            true,
            'Berhasil Ditata ke CorelDRAW!',
            res.message || `Sebanyak ${curVariant.positions.length} pola telah dipindahkan rapi ke dalam lembar cetak CorelDRAW.`,
            { usedHeight: curVariant.usedHeight, efficiency: curVariant.efficiency, allFit: curVariant.allFit }
          );
        } else {
          showLayoutPolaResultModal(
            false,
            'Gagal Menata di CorelDRAW',
            res?.message || 'Terjadi kendala saat memindahkan pola. Pastikan CorelDRAW tidak dalam mode edit teks atau dialog tertutup.'
          );
        }
      } catch (err) {
        if (btnLayoutPolaExecute) {
          btnLayoutPolaExecute.disabled = false;
          btnLayoutPolaExecute.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px; vertical-align: middle;"><polyline points="20 6 9 17 4 12"/></svg> Terapkan ke CorelDRAW`;
        }
        showLayoutPolaResultModal(false, 'Error Eksekusi', err.message);
      }
    });
  }

  // Open Companion Floating Window
  const btnLayoutPolaOpenCompanion = document.getElementById('btnLayoutPolaOpenCompanion');
  if (btnLayoutPolaOpenCompanion) {
    btnLayoutPolaOpenCompanion.addEventListener('click', () => {
      const api = window.electronAPI || window.corelAPI;
      if (api?.corelOpenLayoutPolaTool) {
        api.corelOpenLayoutPolaTool();
      }
    });
  }

  // Canvas Zoom & Fit Controls
  if (btnLayoutPreviewFit) {
    btnLayoutPreviewFit.addEventListener('click', () => {
      layoutPolaAutoFit = true;
      layoutPolaZoomScale = 1.0;
      if (lblLayoutPolaZoomLevel) lblLayoutPolaZoomLevel.innerText = 'Fit to Screen';
      renderLayoutPolaCanvas();
    });
  }

  if (btnLayoutPreviewZoomIn) {
    btnLayoutPreviewZoomIn.addEventListener('click', () => {
      layoutPolaAutoFit = false;
      layoutPolaZoomScale = Math.min(3.0, layoutPolaZoomScale + 0.2);
      if (lblLayoutPolaZoomLevel) lblLayoutPolaZoomLevel.innerText = `${Math.round(layoutPolaZoomScale * 100)}%`;
      renderLayoutPolaCanvas();
    });
  }

  if (btnLayoutPreviewZoomOut) {
    btnLayoutPreviewZoomOut.addEventListener('click', () => {
      layoutPolaAutoFit = false;
      layoutPolaZoomScale = Math.max(0.4, layoutPolaZoomScale - 0.2);
      if (lblLayoutPolaZoomLevel) lblLayoutPolaZoomLevel.innerText = `${Math.round(layoutPolaZoomScale * 100)}%`;
      renderLayoutPolaCanvas();
    });
  }

  // Interactive Hover Tooltip on Canvas
  if (layoutPolaCanvas) {
    layoutPolaCanvas.addEventListener('mousemove', (e) => {
      if (!layoutPolaVariants || layoutPolaVariants.length === 0) return;
      const cur = layoutPolaVariants[layoutPolaCurrentVariantIndex];
      if (!cur) return;

      const rect = layoutPolaCanvas.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left) * (layoutPolaCanvas.width / rect.width);
      const mouseY = (e.clientY - rect.top) * (layoutPolaCanvas.height / rect.height);

      const { boxW, boxH } = getLayoutBoxDimensionsCm();
      const marginPadX = 60;
      const marginPadY = 60;
      const availW = layoutPolaCanvas.width - marginPadX * 2;
      const availH = layoutPolaCanvas.height - marginPadY * 2;
      const baseScale = Math.min(availW / boxW, availH / boxH);
      const scale = layoutPolaAutoFit ? baseScale : baseScale * layoutPolaZoomScale;
      const renderBoxW = boxW * scale;
      const originX = (layoutPolaCanvas.width - renderBoxW) / 2;
      const originY = marginPadY / 2;

      let foundIdx = -1;
      for (let i = 0; i < cur.positions.length; i++) {
        const p = cur.positions[i];
        const px = originX + p.xCm * scale;
        const py = originY + p.yCm * scale;
        const pw = p.wCm * scale;
        const ph = p.hCm * scale;
        if (mouseX >= px && mouseX <= px + pw && mouseY >= py && mouseY <= py + ph) {
          foundIdx = i;
          break;
        }
      }

      if (foundIdx !== layoutPolaHoveredIndex) {
        layoutPolaHoveredIndex = foundIdx;
        renderLayoutPolaCanvas();
      }

      if (foundIdx >= 0 && layoutPolaTooltip) {
        const item = cur.positions[foundIdx];
        layoutPolaTooltip.style.display = 'block';
        layoutPolaTooltip.style.left = `${e.clientX - rect.left + 15}px`;
        layoutPolaTooltip.style.top = `${e.clientY - rect.top + 15}px`;
        layoutPolaTooltip.innerHTML = `
          <strong>${item.name || 'Pola ' + (foundIdx + 1)}</strong><br/>
          Ukuran: ${item.wCm} cm × ${item.hCm} cm<br/>
          Posisi: X=${item.xCm} cm, Y=${item.yCm} cm
          ${item.rotate ? '<br/><span style="color:#f59e0b">Diputar: 180°</span>' : ''}
        `;
      } else if (layoutPolaTooltip) {
        layoutPolaTooltip.style.display = 'none';
      }
    });

    layoutPolaCanvas.addEventListener('mouseleave', () => {
      layoutPolaHoveredIndex = -1;
      if (layoutPolaTooltip) layoutPolaTooltip.style.display = 'none';
      renderLayoutPolaCanvas();
    });
  }

  // Keyboard shortcut when inside view-layout-pola: Left/Right arrow to cycle layouts
  window.addEventListener('keydown', (e) => {
    if (activeView === 'layout-pola') {
      if (e.key === 'ArrowRight') {
        nextLayoutVariant();
        e.preventDefault();
      } else if (e.key === 'ArrowLeft') {
        prevLayoutVariant();
        e.preventDefault();
      }
    }
  });

  // Auto-init with sample on first load
  layoutPolaItems = JSON.parse(JSON.stringify(SAMPLE_JERSEY_PATTERNS));
  if (badgeLayoutPolaCount) badgeLayoutPolaCount.innerText = `${layoutPolaItems.length} Pola`;
  computeAllLayoutVariants();

  // ==========================================
  // 13. Keyboard Shortcuts (Native Desktop)
  // ==========================================
  window.addEventListener('keydown', (e) => {
    // Esc: cancel active automation task, close modals if open, else return to Beranda
    if (e.key === 'Escape') {
      if (btnGlobalCancelTask && btnGlobalCancelTask.style.display !== 'none') {
        triggerCancelOperation();
        e.preventDefault();
        return;
      }
      if (modalOrderComparison && modalOrderComparison.classList.contains('open')) {
        closeOrderComparisonModal();
        e.preventDefault();
        return;
      }
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
