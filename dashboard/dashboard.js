// dashboard/dashboard.js — Controller for the Notion/Vercel-styled JobPulse Dashboard with local resume file management

// Global WebExtensionBridge for real-time 2-way sync between Vercel web and Chrome Extension
window.WebExtensionBridge = {
  isAvailable: false,
  _pendingRequests: new Map(),
  _requestId: 0,

  init(onConnectCallback, onStorageChangedCallback) {
    if (typeof window === 'undefined') return;

    if (window.location.protocol === 'chrome-extension:') {
      const indicator = document.getElementById('extension-status-badge');
      if (indicator) {
        indicator.classList.remove('hidden');
        indicator.title = 'JobPulse Chrome Extension (Local Sandbox)';
        const text = document.getElementById('extension-status-text');
        if (text) text.textContent = 'Extension Local';
      }
      return;
    }

    window.addEventListener('message', (event) => {
      if (!event.data || event.data.source !== 'jobpulse-extension') return;

      if (event.data.type === 'EXTENSION_DETECTED' || event.data.type === 'PONG') {
        const wasAvailable = this.isAvailable;
        this.isAvailable = true;
        this._updateUI(true);

        // Tell the extension bridge about our Vercel URL
        this.request('SET_VERCEL_URL', { url: window.location.origin }).catch(() => {});

        if (!wasAvailable && typeof onConnectCallback === 'function') {
          onConnectCallback(event.data);
        }
      }

      if (event.data.requestId && this._pendingRequests.has(event.data.requestId)) {
        const { resolve, reject } = this._pendingRequests.get(event.data.requestId);
        this._pendingRequests.delete(event.data.requestId);
        if (event.data.success) {
          resolve(event.data.data);
        } else {
          reject(new Error(event.data.error || 'Extension bridge failed'));
        }
      }

      if (event.data.type === 'STORAGE_CHANGED') {
        if (typeof onStorageChangedCallback === 'function') {
          onStorageChangedCallback(event.data.key, event.data.newValue);
        }
      }
    });

    this.ping();
    setTimeout(() => this.ping(), 300);
    setTimeout(() => this.ping(), 1200);
  },

  ping() {
    window.postMessage({ target: 'jobpulse-extension', action: 'PING' }, '*');
  },

  async request(action, payload = {}) {
    if (!this.isAvailable && action !== 'PING') return null;
    return new Promise((resolve, reject) => {
      const id = ++this._requestId;
      this._pendingRequests.set(id, { resolve, reject });
      window.postMessage({
        target: 'jobpulse-extension',
        action,
        requestId: id,
        payload
      }, '*');
      setTimeout(() => {
        if (this._pendingRequests.has(id)) {
          this._pendingRequests.delete(id);
          reject(new Error('Extension bridge request timed out'));
        }
      }, 6000);
    });
  },

  _updateUI(connected) {
    const indicator = document.getElementById('extension-status-badge');
    const extStatusText = document.getElementById('status-extension-text');
    if (indicator) {
      if (connected) {
        indicator.classList.remove('hidden');
        indicator.title = 'JobPulse Chrome Extension connected. Real-time 2-way sync active.';
        const badgeText = document.getElementById('extension-status-text');
        if (badgeText) badgeText.textContent = 'Extension Synced';
      } else {
        indicator.classList.add('hidden');
      }
    }
    if (extStatusText) {
      extStatusText.textContent = connected ? 'Connected (Live Sync)' : 'Not detected';
      extStatusText.style.color = connected ? '#10b981' : '#a1a1aa';
    }
  }
};
const WebExtensionBridge = window.WebExtensionBridge;

document.addEventListener('DOMContentLoaded', async () => {

  /* ═══════════════════════════════════════
     STATE
     ═══════════════════════════════════════ */

  let jobs = [];
  let resumes = [];
  let currentTab = 'overview';
  let viewMode = 'kanban';
  let searchQuery = '';
  let filterStatus = 'all';
  let filterResume = 'all';

  // Modal resume state
  let modalResumeMode = 'saved'; // 'saved' | 'upload'
  let modalUploadedResume = null; // { name, fileType, fileSize, dataUrl }

  // Add resume modal state
  let addResumeUploadedFile = null;

  // Active preview object
  let activePreviewBlobUrl = null;
  let activePreviewResumeId = null;

  /* ═══════════════════════════════════════
     DOM REFS
     ═══════════════════════════════════════ */

  // Nav
  const navBtns = document.querySelectorAll('.nav-btn');
  const tabs = document.querySelectorAll('.tab');
  const pageTitle = document.getElementById('page-title');
  const pageSub = document.getElementById('page-subtitle');

  // Topbar actions
  const btnAdd = document.getElementById('btn-add-job-main');
  const btnDataMenu = document.getElementById('btn-data-menu');
  const dataDropdown = document.getElementById('data-dropdown');
  const btnExportCsv = document.getElementById('btn-export-csv');
  const btnExportJson = document.getElementById('btn-export-json');
  const fileImport = document.getElementById('file-import-json');
  const btnClearAll = document.getElementById('btn-clear-all');
  const btnLoadDemo = document.getElementById('btn-load-demo');
  const toast = document.getElementById('toast');

  // Overview
  const kpiTotal = document.getElementById('kpi-total-applied');
  const kpiReplies = document.getElementById('kpi-total-replies');
  const kpiRate = document.getElementById('kpi-response-rate');
  const kpiInterviews = document.getElementById('kpi-interviews');
  const kpiOffers = document.getElementById('kpi-offers');
  const donutBox = document.getElementById('status-donut-chart');
  const legendBox = document.getElementById('status-legend');
  const barBox = document.getElementById('resume-snapshot-chart');
  const recentTbody = document.getElementById('recent-apps-tbody');
  const btnViewAll = document.getElementById('btn-view-all-apps');

  // Applications
  const searchInput = document.getElementById('app-search-input');
  const filterStatusSel = document.getElementById('filter-status-select');
  const filterResumeSel = document.getElementById('filter-resume-select');
  const btnKanban = document.getElementById('view-toggle-kanban');
  const btnTable = document.getElementById('view-toggle-table');
  const kanbanEl = document.getElementById('kanban-view');
  const tableEl = document.getElementById('table-view');
  const allTbody = document.getElementById('all-apps-tbody');

  // Resumes
  const btnAddResume = document.getElementById('btn-add-resume-matrix');
  const resumeGrid = document.getElementById('resume-cards-grid');
  const resumeTbody = document.getElementById('resume-matrix-tbody');

  // Job modal
  const jobModal = document.getElementById('job-modal');
  const modalHeading = document.getElementById('modal-heading');
  const modalForm = document.getElementById('modal-job-form');
  const mId = document.getElementById('modal-job-id');
  const mTitle = document.getElementById('modal-job-title');
  const mCompany = document.getElementById('modal-job-company');
  const mLocation = document.getElementById('modal-job-location');
  const mPlatform = document.getElementById('modal-job-platform');
  const mResume = document.getElementById('modal-job-resume');
  const mStatus = document.getElementById('modal-job-status');
  const mDatetime = document.getElementById('modal-job-datetime');
  const mSalary = document.getElementById('modal-job-salary');
  const mUrl = document.getElementById('modal-job-url');
  const mFollowup = document.getElementById('modal-job-followup');
  const mContactName = document.getElementById('modal-job-contact-name');
  const mContactEmail = document.getElementById('modal-job-contact-email');
  const mNotes = document.getElementById('modal-job-notes');
  const mTimelineSection = document.getElementById('modal-timeline-section');
  const mTimelineList = document.getElementById('modal-timeline-list');
  const btnDeleteJob = document.getElementById('btn-delete-job');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnCancelModal = document.getElementById('btn-cancel-modal');

  // Job Modal Resume Upload & Mode Elements
  const modalResumeModeSaved = document.getElementById('modal-resume-mode-saved');
  const modalResumeModeUpload = document.getElementById('modal-resume-mode-upload');
  const modalResumeSavedPanel = document.getElementById('modal-resume-saved-panel');
  const modalResumeUploadPanel = document.getElementById('modal-resume-upload-panel');
  const modalResumeFileChip = document.getElementById('modal-resume-file-chip');
  const modalResumeFileText = document.getElementById('modal-resume-file-text');
  const btnModalViewResume = document.getElementById('btn-modal-view-resume');
  const modalResumeFileInput = document.getElementById('modal-resume-file-input');
  const modalResumeDropzone = document.getElementById('modal-resume-dropzone');
  const modalResumeSelectedChip = document.getElementById('modal-resume-selected-chip');
  const modalChipBadge = document.getElementById('modal-chip-badge');
  const modalChipName = document.getElementById('modal-chip-name');
  const modalChipSize = document.getElementById('modal-chip-size');
  const btnModalRemoveFile = document.getElementById('btn-modal-remove-file');

  // Resume modal
  const resumeModal = document.getElementById('resume-modal');
  const resumeForm = document.getElementById('form-add-resume');
  const inputResName = document.getElementById('input-resume-name');
  const inputResumeFile = document.getElementById('input-resume-file');
  const dropzoneAddResume = document.getElementById('dropzone-add-resume');
  const addResumeSelectedChip = document.getElementById('add-resume-selected-chip');
  const addChipBadge = document.getElementById('add-chip-badge');
  const addChipName = document.getElementById('add-chip-name');
  const addChipSize = document.getElementById('add-chip-size');
  const btnAddRemoveFile = document.getElementById('btn-add-remove-file');
  const checkDefault = document.getElementById('check-resume-default');
  const btnCloseResModal = document.getElementById('btn-close-resume-modal');
  const btnCancelResModal = document.getElementById('btn-cancel-resume-modal');

  // Resume Preview modal
  const resumePreviewModal = document.getElementById('resume-preview-modal');
  const previewModalTitle = document.getElementById('preview-modal-title');
  const previewModalMeta = document.getElementById('preview-modal-meta');
  const btnPreviewDownload = document.getElementById('btn-preview-download');
  const btnPreviewNewTab = document.getElementById('btn-preview-new-tab');
  const btnClosePreviewModal = document.getElementById('btn-close-preview-modal');
  const previewPdfContainer = document.getElementById('preview-pdf-container');
  const previewPdfIframe = document.getElementById('preview-pdf-iframe');
  const previewFallbackContainer = document.getElementById('preview-fallback-container');
  const previewFallbackFilename = document.getElementById('preview-fallback-filename');
  const previewFallbackInfo = document.getElementById('preview-fallback-info');
  const btnFallbackDownload = document.getElementById('btn-fallback-download');

  // Theme Segmented Control
  const themeBtnLight = document.getElementById('theme-btn-light');
  const themeBtnDark = document.getElementById('theme-btn-dark');
  const themeBtnSystem = document.getElementById('theme-btn-system');

  // Google Auth & Cloud Sync Card
  const authLoggedOutState = document.getElementById('auth-logged-out-state');
  const authLoggedInState = document.getElementById('auth-logged-in-state');
  const btnGoogleSignin = document.getElementById('btn-google-signin');
  const btnGoogleSignout = document.getElementById('btn-google-signout');
  const userAvatarImg = document.getElementById('user-avatar-img');
  const userDisplayName = document.getElementById('user-display-name');
  const userEmailText = document.getElementById('user-email-text');

  // Recruiter Email Hub & Topbar
  const btnScanEmailsTopbar = document.getElementById('btn-scan-emails-topbar');
  const btnScanInboxLive = document.getElementById('btn-scan-inbox-live');
  const emailPasteInput = document.getElementById('email-paste-input');
  const emailSenderInput = document.getElementById('email-sender-input');
  const btnAnalyzePastedEmail = document.getElementById('btn-analyze-pasted-email');
  const emailAnalysisResult = document.getElementById('email-analysis-result');
  const resultStatusBadge = document.getElementById('result-status-badge');
  const resultCompanyName = document.getElementById('result-company-name');
  const resultSummaryText = document.getElementById('result-summary-text');
  const btnApplyEmailStatus = document.getElementById('btn-apply-email-status');
  const btnApplyStatusLabel = document.getElementById('btn-apply-status-label');
  const btnAddEmailToCalendar = document.getElementById('btn-add-email-to-calendar');
  const selectTemplateJob = document.getElementById('select-template-job');
  const templatesListContainer = document.getElementById('templates-list-container');
  const detectionsFeedEmpty = document.getElementById('detections-feed-empty');
  const detectionsFeedList = document.getElementById('detections-feed-list');

  // Job Modal Skills Matcher & Calendar
  const btnModalAddCalendar = document.getElementById('btn-modal-add-calendar');
  const jdScoreBadge = document.getElementById('jd-score-badge');
  const btnReanalyzeModalSkills = document.getElementById('btn-reanalyze-modal-skills');
  const btnToggleJdAccordion = document.getElementById('btn-toggle-jd-accordion');
  const jdToggleText = document.getElementById('jd-toggle-text');
  const jdToggleChevron = document.getElementById('jd-toggle-chevron');
  const jdAccordionBody = document.getElementById('jd-accordion-body');
  const skillsGaugeNumber = document.getElementById('skills-gauge-number');
  const skillsGaugeDesc = document.getElementById('skills-gauge-desc');
  const modalMatchedCount = document.getElementById('modal-matched-count');
  const modalMatchedChips = document.getElementById('modal-matched-chips');
  const modalMissingCount = document.getElementById('modal-missing-count');
  const modalMissingChips = document.getElementById('modal-missing-chips');
  const modalJobDescription = document.getElementById('modal-job-description');

  let currentSettings = { theme: 'system', userSkills: [] };
  let currentAnalysisResult = null;
  let detectionsHistory = [];

  /* ═══════════════════════════════════════
     INIT
     ═══════════════════════════════════════ */

  currentSettings = await StorageService.getSettings();
  initTheme(currentSettings.theme);
  initAuthAndSync();
  initWebExtensionBridge();
  initCloudSettingsModal();
  initEmailHub();
  initJobModalFeatures();
  await refresh();

  /* ═══════════════════════════════════════
     THEME ENGINE
     ═══════════════════════════════════════ */

  function initTheme(theme = 'system') {
    applyTheme(theme);

    if (themeBtnLight) themeBtnLight.addEventListener('click', () => setTheme('light'));
    if (themeBtnDark) themeBtnDark.addEventListener('click', () => setTheme('dark'));
    if (themeBtnSystem) themeBtnSystem.addEventListener('click', () => setTheme('system'));

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (currentSettings.theme === 'system') {
        applyTheme('system');
      }
    });
  }

  async function setTheme(theme) {
    currentSettings.theme = theme;
    await StorageService.updateSettings({ theme });
    applyTheme(theme);
    notify(`Theme set to ${cap(theme)}`);
  }

  function applyTheme(theme) {
    if (themeBtnLight) themeBtnLight.classList.toggle('active', theme === 'light');
    if (themeBtnDark) themeBtnDark.classList.toggle('active', theme === 'dark');
    if (themeBtnSystem) themeBtnSystem.classList.toggle('active', theme === 'system');

    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  /* ═══════════════════════════════════════
     WEB EXTENSION BRIDGE
     ═══════════════════════════════════════ */

  function initWebExtensionBridge() {
    WebExtensionBridge.init(
      async (extensionInfo) => {
        // Connected to Chrome Extension! Merge latest data
        try {
          const extData = await WebExtensionBridge.request('GET_ALL_DATA');
          if (extData && Array.isArray(extData.jobs)) {
            const localJobs = await StorageService.getJobs();
            const jobMap = new Map();
            for (const j of localJobs) jobMap.set(j.id, j);
            for (const ej of extData.jobs) {
              const existing = jobMap.get(ej.id);
              if (!existing || new Date(ej.updatedAt || 0) > new Date(existing.updatedAt || 0)) {
                jobMap.set(ej.id, ej);
              }
            }
            const merged = Array.from(jobMap.values())
              .sort((a, b) => new Date(b.appliedAt || 0) - new Date(a.appliedAt || 0));
            await StorageService.set(STORAGE_KEYS.JOBS, merged);
            jobs = merged;
            renderTab();
            notify('✓ Connected to Chrome Extension: Synced latest applications!');
          }
        } catch (e) {
          console.warn('Bridge initial sync warning:', e);
        }
      },
      async (storageKey, newValue) => {
        // Live updates from Chrome Extension
        if (storageKey === 'jobpulse_applications' && Array.isArray(newValue)) {
          jobs = newValue;
          renderTab();
          notify('✓ Applications updated live from Chrome Extension');
        }
      }
    );
  }

  /* ═══════════════════════════════════════
     CLOUD SYNC & FIREBASE SETTINGS MODAL
     ═══════════════════════════════════════ */

  function initCloudSettingsModal() {
    const modal = document.getElementById('cloud-settings-modal');
    const btnGear = document.getElementById('btn-cloud-settings-gear');
    const btnGearAuth = document.getElementById('btn-cloud-settings-gear-auth');
    const btnClose = document.getElementById('btn-close-cloud-modal');
    const btnCancel = document.getElementById('btn-cancel-cloud-settings');
    const btnSave = document.getElementById('btn-save-cloud-settings');

    const statusEnvText = document.getElementById('status-env-text');
    const statusExtensionText = document.getElementById('status-extension-text');
    const statusFirebaseText = document.getElementById('status-firebase-text');

    const inputApiKey = document.getElementById('setting-fb-api-key');
    const inputAuthDomain = document.getElementById('setting-fb-auth-domain');
    const inputProjectId = document.getElementById('setting-fb-project-id');
    const inputStorageBucket = document.getElementById('setting-fb-storage-bucket');
    const inputAppId = document.getElementById('setting-fb-app-id');

    function openModal() {
      if (!modal) return;
      modal.classList.remove('hidden');

      const isExt = window.location.protocol === 'chrome-extension:';
      if (statusEnvText) {
        statusEnvText.textContent = isExt ? 'Chrome Extension' : (window.location.hostname || 'Vercel Web');
      }
      if (statusExtensionText) {
        if (isExt) {
          statusExtensionText.textContent = 'Native Host';
          statusExtensionText.style.color = '#10b981';
        } else if (WebExtensionBridge.isAvailable) {
          statusExtensionText.textContent = 'Connected (Live Sync)';
          statusExtensionText.style.color = '#10b981';
        } else {
          statusExtensionText.textContent = 'Not detected';
          statusExtensionText.style.color = '#a1a1aa';
        }
      }
      if (statusFirebaseText) {
        const hasFb = FirebaseSync.isInitialized;
        statusFirebaseText.textContent = hasFb
          ? (FirebaseSync.currentUser ? `Synced (${FirebaseSync.currentUser.email})` : 'Configured (Ready to Sign In)')
          : 'Not Configured';
        statusFirebaseText.style.color = hasFb ? '#10b981' : '#f59e0b';
      }

      // Pre-fill existing config if available
      const cfg = (typeof window !== 'undefined' && window.FIREBASE_CONFIG) ? window.FIREBASE_CONFIG : null;
      if (cfg) {
        if (inputApiKey && cfg.apiKey && cfg.apiKey !== 'YOUR_FIREBASE_API_KEY') inputApiKey.value = cfg.apiKey;
        if (inputAuthDomain && cfg.authDomain) inputAuthDomain.value = cfg.authDomain;
        if (inputProjectId && cfg.projectId) inputProjectId.value = cfg.projectId;
        if (inputStorageBucket && cfg.storageBucket) inputStorageBucket.value = cfg.storageBucket;
        if (inputAppId && cfg.appId) inputAppId.value = cfg.appId;
      }
    }

    function closeModal() {
      if (modal) modal.classList.add('hidden');
    }

    if (btnGear) btnGear.addEventListener('click', openModal);
    if (btnGearAuth) btnGearAuth.addEventListener('click', openModal);
    if (btnClose) btnClose.addEventListener('click', closeModal);
    if (btnCancel) btnCancel.addEventListener('click', closeModal);
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });
    }

    if (btnSave) {
      btnSave.addEventListener('click', async () => {
        const apiKey = inputApiKey ? inputApiKey.value.trim() : '';
        const authDomain = inputAuthDomain ? inputAuthDomain.value.trim() : '';
        const projectId = inputProjectId ? inputProjectId.value.trim() : '';
        const storageBucket = inputStorageBucket ? inputStorageBucket.value.trim() : '';
        const appId = inputAppId ? inputAppId.value.trim() : '';

        if (!apiKey) {
          notify('Please enter a Firebase API Key', true);
          return;
        }

        const newCfg = {
          apiKey,
          authDomain,
          projectId,
          storageBucket,
          appId,
          messagingSenderId: '',
          measurementId: ''
        };

        try {
          localStorage.setItem('jobpulse_firebase_config', JSON.stringify(newCfg));
          window.FIREBASE_CONFIG = newCfg;
          notify('Firebase settings saved. Initializing cloud sync...');
          closeModal();
          await FirebaseSync.init();
          updateAuthUI(FirebaseSync.currentUser);
        } catch (e) {
          notify('Failed to save settings: ' + e.message, true);
        }
      });
    }
  }

  /* ═══════════════════════════════════════
     GOOGLE AUTH & FIRESTORE SYNC
     ═══════════════════════════════════════ */

  async function initAuthAndSync() {
    if (typeof FirebaseSync === 'undefined') return;

    await FirebaseSync.init();
    updateAuthUI(FirebaseSync.currentUser);

    FirebaseSync.onEvent((event) => {
      if (event.type === 'AUTH_CHANGED') {
        updateAuthUI(event.user);
      } else if (event.type === 'JOBS_UPDATED') {
        jobs = event.jobs;
        renderTab();
      }
    });

    if (btnGoogleSignin) {
      btnGoogleSignin.addEventListener('click', async () => {
        // If inside Chrome Extension protocol, open hosted Vercel dashboard to authenticate
        if (window.location.protocol === 'chrome-extension:') {
          const vercelUrl = await StorageService.get('jobpulse_vercel_url');
          if (vercelUrl) {
            notify('Opening hosted Vercel dashboard for Google Sign-In...');
            window.open(vercelUrl, '_blank');
            return;
          } else {
            notify('Google Sign-In requires a web domain (Vercel). Opening settings...', true);
            const modal = document.getElementById('cloud-settings-modal');
            if (modal) modal.classList.remove('hidden');
            return;
          }
        }

        try {
          btnGoogleSignin.disabled = true;
          btnGoogleSignin.innerHTML = '<span>Signing in...</span>';
          const user = await FirebaseSync.signInWithGoogle();
          notify(`Welcome back, ${user.displayName || user.email}! Applications synced.`);
          await refresh();
        } catch (err) {
          console.error(err);
          if (err && (err.code === 'auth/unauthorized-domain' || err.friendlyMessage)) {
            notify(err.friendlyMessage || ('Domain unauthorized: ' + err.message), true);
            const modal = document.getElementById('cloud-settings-modal');
            if (modal) modal.classList.remove('hidden');
          } else if (err && err.code === 'auth/not-configured') {
            notify('Firebase credentials not configured yet. Opening settings...');
            const modal = document.getElementById('cloud-settings-modal');
            if (modal) modal.classList.remove('hidden');
          } else {
            notify('Sign-in cancelled or failed: ' + (err.message || ''), true);
          }
        } finally {
          btnGoogleSignin.disabled = false;
          btnGoogleSignin.innerHTML = `<svg viewBox="0 0 24 24" class="google-logo"><path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/><path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/></svg><span>Sign in with Google</span>`;
        }
      });
    }

    if (btnGoogleSignout) {
      btnGoogleSignout.addEventListener('click', async () => {
        await FirebaseSync.signOut();
        updateAuthUI(null);
        notify('Signed out of cloud sync. Local data preserved.');
      });
    }
  }

  function updateAuthUI(user) {
    if (!authLoggedOutState || !authLoggedInState) return;
    if (user) {
      authLoggedOutState.classList.add('hidden');
      authLoggedInState.classList.remove('hidden');
      if (userAvatarImg) userAvatarImg.src = user.photoURL || 'https://www.gravatar.com/avatar/?d=mp';
      if (userDisplayName) userDisplayName.textContent = user.displayName || 'Google User';
      if (userEmailText) userEmailText.textContent = user.email || '';
    } else {
      authLoggedOutState.classList.remove('hidden');
      authLoggedInState.classList.add('hidden');
    }
  }

  /* ═══════════════════════════════════════
     RECRUITER EMAILS & CALENDAR HUB
     ═══════════════════════════════════════ */

  function initEmailHub() {
    if (btnScanEmailsTopbar) {
      btnScanEmailsTopbar.addEventListener('click', () => {
        switchTab('emails');
        if (emailPasteInput) emailPasteInput.focus();
      });
    }

    if (btnScanInboxLive) {
      btnScanInboxLive.addEventListener('click', async () => {
        if (!FirebaseSync.currentUser) {
          notify('Sign in with Google below to scan your live Gmail inbox.', true);
          return;
        }
        notify('Scanning inbox for recruiter communications...');
      });
    }

    if (btnAnalyzePastedEmail) {
      btnAnalyzePastedEmail.addEventListener('click', () => {
        const text = (emailPasteInput ? emailPasteInput.value : '').trim();
        const sender = (emailSenderInput ? emailSenderInput.value : '').trim();
        if (!text) return notify('Please paste an email snippet first', true);

        if (typeof EmailTracker === 'undefined') return;
        const res = EmailTracker.classifyEmail(text, jobs, sender);
        currentAnalysisResult = res;

        if (emailAnalysisResult) {
          emailAnalysisResult.classList.remove('hidden');
          resultStatusBadge.textContent = cap(res.suggestedStatus);
          resultCompanyName.textContent = res.detectedCompany || 'Unknown Company';
          resultSummaryText.textContent = res.summary;
          btnApplyStatusLabel.textContent = cap(res.suggestedStatus);
        }
      });
    }

    if (btnApplyEmailStatus) {
      btnApplyEmailStatus.addEventListener('click', async () => {
        if (!currentAnalysisResult || !currentAnalysisResult.jobId) {
          return notify('No matching application identified to update.', true);
        }
        await StorageService.updateJobStatus(
          currentAnalysisResult.jobId,
          currentAnalysisResult.suggestedStatus,
          `Detected recruiter communication: "${currentAnalysisResult.matchedQuotes.join(', ') || 'status update'}"`
        );
        notify(`✓ Updated ${currentAnalysisResult.detectedCompany} to ${cap(currentAnalysisResult.suggestedStatus)}!`);
        
        detectionsHistory.unshift({
          ...currentAnalysisResult,
          id: 'det_' + Date.now(),
          timestamp: new Date().toISOString()
        });
        renderDetectionsFeed();

        if (emailAnalysisResult) emailAnalysisResult.classList.add('hidden');
        if (emailPasteInput) emailPasteInput.value = '';
        await refresh();
      });
    }

    if (btnAddEmailToCalendar) {
      btnAddEmailToCalendar.addEventListener('click', () => {
        if (!currentAnalysisResult) return;
        if (typeof CalendarService !== 'undefined') {
          CalendarService.openGoogleCalendarEvent({
            title: `${currentAnalysisResult.detectedCompany || 'Job'} Interview / Discussion`,
            description: currentAnalysisResult.summary,
            startTime: Date.now() + 24 * 60 * 60 * 1000
          });
        }
      });
    }

    if (selectTemplateJob) {
      selectTemplateJob.addEventListener('change', () => {
        const selectedId = selectTemplateJob.value;
        const j = jobs.find(x => x.id === selectedId) || jobs[0];
        renderTemplates(j);
      });
    }
  }

  function renderEmailsTab() {
    if (selectTemplateJob) {
      selectTemplateJob.innerHTML = jobs.map(j => 
        `<option value="${esc(j.id)}">${esc(j.company)} — ${esc(j.title)} (${cap(j.status)})</option>`
      ).join('') || '<option value="">No applications tracked yet</option>';

      const selectedId = selectTemplateJob.value;
      const j = jobs.find(x => x.id === selectedId) || jobs[0];
      renderTemplates(j);
    }
    renderDetectionsFeed();
  }

  function renderTemplates(job) {
    if (!templatesListContainer || typeof EmailTracker === 'undefined') return;
    const templates = EmailTracker.getEmailTemplates(job || {});

    templatesListContainer.innerHTML = templates.map(t => `
      <div class="template-card">
        <div class="template-card-header">
          <span class="template-card-title">${esc(t.name)}</span>
          <button type="button" class="btn-copy-template" data-sub="${esc(t.subject)}" data-body="${esc(t.body)}">
            📋 Copy
          </button>
        </div>
        <div class="template-preview-text"><strong>Subject:</strong> ${esc(t.subject)}\n${esc(t.body)}</div>
      </div>
    `).join('');

    templatesListContainer.querySelectorAll('.btn-copy-template').forEach(btn => {
      btn.addEventListener('click', () => {
        const text = `Subject: ${btn.dataset.sub}\n\n${btn.dataset.body}`;
        navigator.clipboard.writeText(text);
        notify('Email template copied to clipboard!');
      });
    });
  }

  function renderDetectionsFeed() {
    if (!detectionsFeedEmpty || !detectionsFeedList) return;
    if (detectionsHistory.length === 0) {
      detectionsFeedEmpty.classList.remove('hidden');
      detectionsFeedList.classList.add('hidden');
    } else {
      detectionsFeedEmpty.classList.add('hidden');
      detectionsFeedList.classList.remove('hidden');
      detectionsFeedList.innerHTML = detectionsHistory.map(d => `
        <div class="detection-item">
          <div class="detection-left">
            <div class="detection-badges">
              <span class="result-badge status-${d.suggestedStatus}">${cap(d.suggestedStatus)}</span>
              <span class="detection-company">${esc(d.detectedCompany)}</span>
            </div>
            <div class="detection-snippet">${esc(d.summary)}</div>
            <div class="detection-date">${fmtDate(d.timestamp)}</div>
          </div>
        </div>
      `).join('');
    }
  }

  /* ═══════════════════════════════════════
     SKILLS MATCHER & JOB MODAL FEATURES
     ═══════════════════════════════════════ */

  function initJobModalFeatures() {
    if (btnToggleJdAccordion) {
      btnToggleJdAccordion.addEventListener('click', () => {
        const isHidden = jdAccordionBody ? jdAccordionBody.classList.contains('hidden') : false;
        toggleJdAccordion(isHidden);
      });
    }

    if (btnReanalyzeModalSkills) {
      btnReanalyzeModalSkills.addEventListener('click', () => {
        const text = modalJobDescription ? modalJobDescription.value : '';
        renderModalSkillsMatch(text);
      });
    }

    if (modalJobDescription) {
      modalJobDescription.addEventListener('input', () => {
        renderModalSkillsMatch(modalJobDescription.value);
      });
    }

    if (btnModalAddCalendar) {
      btnModalAddCalendar.addEventListener('click', () => {
        const title = mTitle.value.trim() || 'Job';
        const company = mCompany.value.trim() || 'Company';
        const followUp = mFollowup.value;
        if (!followUp) {
          return notify('Please select a follow-up date first', true);
        }
        if (typeof CalendarService !== 'undefined') {
          CalendarService.openGoogleCalendarEvent({
            title: `${company} — ${title} Interview / Follow-up`,
            description: `Follow-up on application for ${title} at ${company}.\nNotes: ${mNotes.value.trim()}`,
            startTime: followUp
          });
        }
      });
    }
  }

  function toggleJdAccordion(open) {
    if (!jdAccordionBody) return;
    if (open) {
      jdAccordionBody.classList.remove('hidden');
      if (jdToggleText) jdToggleText.textContent = 'Hide Details';
      if (jdToggleChevron) jdToggleChevron.style.transform = 'rotate(180deg)';
    } else {
      jdAccordionBody.classList.add('hidden');
      if (jdToggleText) jdToggleText.textContent = 'Show Details';
      if (jdToggleChevron) jdToggleChevron.style.transform = 'rotate(0deg)';
    }
  }

  function renderModalSkillsMatch(jdText = '') {
    if (typeof SkillsMatcher === 'undefined') return;

    const userSkills = currentSettings.userSkills || [
      'React', 'JavaScript', 'TypeScript', 'Node.js', 'HTML', 'CSS', 'Tailwind',
      'Next.js', 'Git', 'REST API', 'GraphQL', 'Docker', 'AWS', 'PostgreSQL'
    ];

    const match = SkillsMatcher.matchSkills(jdText, userSkills);

    if (jdScoreBadge) {
      if (match.jdKeywords.length > 0) {
        jdScoreBadge.textContent = `${match.score}% Match`;
        jdScoreBadge.classList.remove('hidden');
      } else {
        jdScoreBadge.classList.add('hidden');
      }
    }

    if (skillsGaugeNumber) {
      skillsGaugeNumber.textContent = `${match.score}%`;
    }

    if (skillsGaugeDesc) {
      skillsGaugeDesc.textContent = match.jdKeywords.length > 0
        ? `${match.matched.length} of ${match.jdKeywords.length} skills matched from job description`
        : 'Paste or scrape job description to extract technical skills';
    }

    if (modalMatchedCount) modalMatchedCount.textContent = match.matched.length;
    if (modalMissingCount) modalMissingCount.textContent = match.missing.length;

    if (modalMatchedChips) {
      modalMatchedChips.innerHTML = match.matched.length > 0
        ? match.matched.map(kw => `<span class="skill-chip skill-chip-matched">✓ ${esc(kw.skill)}</span>`).join('')
        : '<span class="skills-empty-note">No matched skills detected</span>';
    }

    if (modalMissingChips) {
      modalMissingChips.innerHTML = match.missing.length > 0
        ? match.missing.map(kw => `<span class="skill-chip skill-chip-missing">+ ${esc(kw.skill)}</span>`).join('')
        : '<span class="skills-empty-note">None missing</span>';
    }
  }

  /* ═══════════════════════════════════════
     NAVIGATION
     ═══════════════════════════════════════ */

  navBtns.forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
  btnViewAll.addEventListener('click', () => switchTab('applications'));

  function switchTab(id) {
    currentTab = id;
    navBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === id));
    tabs.forEach(t => t.classList.toggle('active', t.id === `tab-${id}`));

    const titles = {
      overview: ['Overview', 'Track your job search pipeline and resume performance'],
      applications: ['Applications', 'Manage every role across all job boards with attached resumes'],
      resumes: ['Resume Analytics', 'A/B test different resume versions & access locally stored files'],
      emails: ['Recruiter Email Intelligence', 'Detect replies, track interview invitations, and send follow-ups']
    };
    const [t, s] = titles[id] || titles.overview;
    pageTitle.textContent = t;
    pageSub.textContent = s;

    renderTab();
  }

  /* ═══════════════════════════════════════
     VIEW MODE TOGGLE
     ═══════════════════════════════════════ */

  btnKanban.addEventListener('click', () => setView('kanban'));
  btnTable.addEventListener('click', () => setView('table'));

  function setView(mode) {
    viewMode = mode;
    btnKanban.classList.toggle('active', mode === 'kanban');
    btnTable.classList.toggle('active', mode === 'table');
    kanbanEl.classList.toggle('hidden', mode !== 'kanban');
    tableEl.classList.toggle('hidden', mode !== 'table');
    renderTab();
  }

  /* ═══════════════════════════════════════
     DATA REFRESH
     ═══════════════════════════════════════ */

  async function refresh() {
    jobs = await StorageService.getJobs();
    resumes = await StorageService.getResumes();
    populateResumeFilters();
    renderTab();
  }

  function populateResumeFilters() {
    const opts = resumes.map(r => `<option value="${esc(r.name)}">${esc(r.name)}${r.hasFile ? ' 📄' : ''}</option>`).join('');
    filterResumeSel.innerHTML = `<option value="all">All resumes</option>` + opts;
    
    mResume.innerHTML = resumes.map(r =>
      `<option value="${esc(r.id)}">${esc(r.name)}${r.isDefault ? ' (default)' : ''}${r.hasFile ? ' 📄' : ''}</option>`
    ).join('');
  }

  function renderTab() {
    if (currentTab === 'overview') renderOverview();
    else if (currentTab === 'applications') renderApplications();
    else if (currentTab === 'resumes') renderResumes();
    else if (currentTab === 'emails') renderEmailsTab();
  }

  /* ═══════════════════════════════════════
     OVERVIEW
     ═══════════════════════════════════════ */

  function renderOverview() {
    const total = jobs.length;
    const replied = jobs.filter(j => ['screening','interviewing','offer'].includes(j.status)).length;
    const interviews = jobs.filter(j => j.status === 'interviewing').length;
    const offers = jobs.filter(j => j.status === 'offer').length;
    const rate = total > 0 ? Math.round((replied / total) * 100) : 0;

    kpiTotal.textContent = total;
    kpiReplies.textContent = replied;
    kpiRate.textContent = `${rate}%`;
    kpiInterviews.textContent = interviews;
    kpiOffers.textContent = offers;

    renderDonut();
    renderBars();
    renderRecent();
  }

  function renderDonut() {
    const counts = { applied: 0, screening: 0, interviewing: 0, offer: 0, rejected: 0, ghosted: 0, wishlist: 0 };
    jobs.forEach(j => { if (counts[j.status] !== undefined) counts[j.status]++; else counts.applied++; });
    const total = jobs.length;
    const colors = {
      applied: '#2563eb', screening: '#0891b2', interviewing: '#7c3aed',
      offer: '#16a34a', rejected: '#dc2626', ghosted: '#a3a3a3', wishlist: '#737373'
    };

    if (total === 0) {
      donutBox.innerHTML = `<svg viewBox="0 0 100 100" width="140" height="140"><circle cx="50" cy="50" r="38" fill="none" stroke="#f0f0f0" stroke-width="12"/><text x="50" y="55" text-anchor="middle" fill="#a3a3a3" font-size="11" font-weight="500">No data</text></svg>`;
      legendBox.innerHTML = `<span style="color:var(--text-3);font-size:12px">Add applications to see your pipeline</span>`;
      return;
    }

    const R = 38, C = 2 * Math.PI * R;
    let offset = 0, circles = '', legend = '';
    const order = ['applied','screening','interviewing','offer','rejected','ghosted','wishlist'];

    order.forEach(key => {
      const n = counts[key];
      if (n === 0) return;
      const pct = n / total;
      circles += `<circle cx="50" cy="50" r="${R}" fill="none" stroke="${colors[key]}" stroke-width="12" stroke-dasharray="${pct*C} ${C}" stroke-dashoffset="${-offset}" transform="rotate(-90 50 50)"/>`;
      offset += pct * C;
      legend += `<div class="legend-row"><div class="legend-left"><span class="legend-dot" style="background:${colors[key]}"></span><span>${cap(key)}</span></div><span class="legend-count">${n}</span></div>`;
    });

    donutBox.innerHTML = `<svg viewBox="0 0 100 100" width="140" height="140"><circle cx="50" cy="50" r="${R}" fill="none" stroke="#f0f0f0" stroke-width="12"/>${circles}<text x="50" y="46" text-anchor="middle" fill="#171717" font-size="18" font-weight="700">${total}</text><text x="50" y="58" text-anchor="middle" fill="#a3a3a3" font-size="8" font-weight="500">TOTAL</text></svg>`;
    legendBox.innerHTML = legend;
  }

  function renderBars() {
    if (jobs.length === 0 || resumes.length === 0) {
      barBox.innerHTML = `<div style="color:var(--text-3);font-size:12px;text-align:center;padding:20px">No resume data yet</div>`;
      return;
    }
    const stats = getResumeStats();
    barBox.innerHTML = stats.slice(0, 4).map(s => {
      return `<div class="bar-row"><div class="bar-header"><span class="bar-name" title="${esc(s.name)}">${esc(s.name)}${s.hasFile ? ' 📄' : ''}</span><span class="bar-stat">${s.replies}/${s.total} — ${s.rate}%</span></div><div class="bar-track"><div class="bar-fill" style="width:${s.rate}%"></div></div></div>`;
    }).join('');
  }

  function renderRecent() {
    const recent = jobs.slice(0, 5);
    if (recent.length === 0) {
      recentTbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-3);padding:32px">No applications yet. Click "New application" or load sample data.</td></tr>`;
      return;
    }
    recentTbody.innerHTML = recent.map(j => {
      const res = resumes.find(r => r.id === j.resumeId || r.name === j.resumeName);
      const hasFile = j.resumeHasFile || (res && res.hasFile);
      return `
        <tr>
          <td><div class="td-position"><span class="td-title">${esc(j.title)}</span><span class="td-company">${esc(j.company)}${j.location ? ' · ' + esc(j.location) : ''}</span></div></td>
          <td>
            <div style="display:flex;align-items:center;gap:6px">
              <span class="badge badge-resume ${hasFile ? 'badge-has-file' : ''}" data-resume="${esc(j.resumeId || j.resumeName)}" title="${hasFile ? 'Click to preview resume' : esc(j.resumeName)}">${hasFile ? '📄 ' : ''}${esc(j.resumeName)}</span>
              ${hasFile ? `<button type="button" class="btn-icon-sm btn-quick-dl" data-resume="${esc(j.resumeId || j.resumeName)}" title="Download stored resume"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg></button>` : ''}
            </div>
          </td>
          <td><span class="badge badge-platform">${esc(j.platform || 'Direct')}</span></td>
          <td style="white-space:nowrap">${fmtDate(j.appliedAt)}</td>
          <td><span class="badge status-${j.status}">${cap(j.status)}</span></td>
          <td><button class="btn-icon-sm btn-edit-job" data-id="${j.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button></td>
        </tr>
      `;
    }).join('');

    bindEdits(recentTbody);
    bindResumeClicks(recentTbody);
  }

  /* ═══════════════════════════════════════
     APPLICATIONS
     ═══════════════════════════════════════ */

  searchInput.addEventListener('input', e => { searchQuery = e.target.value.toLowerCase().trim(); renderApplications(); });
  filterStatusSel.addEventListener('change', e => { filterStatus = e.target.value; renderApplications(); });
  filterResumeSel.addEventListener('change', e => { filterResume = e.target.value; renderApplications(); });

  function filtered() {
    return jobs.filter(j => {
      const sMatch = !searchQuery || j.title.toLowerCase().includes(searchQuery) || j.company.toLowerCase().includes(searchQuery) || (j.notes && j.notes.toLowerCase().includes(searchQuery));
      const stMatch = filterStatus === 'all' || j.status === filterStatus;
      const rMatch = filterResume === 'all' || j.resumeName === filterResume;
      return sMatch && stMatch && rMatch;
    });
  }

  function renderApplications() {
    const list = filtered();
    if (viewMode === 'kanban') renderKanban(list);
    else renderTable(list);
  }

  /* ─── Kanban ─── */
  function renderKanban(list) {
    const cols = [
      { id: 'wishlist', title: 'Wishlist' },
      { id: 'applied', title: 'Applied' },
      { id: 'screening', title: 'Screening' },
      { id: 'interviewing', title: 'Interviewing' },
      { id: 'offer', title: 'Offer' },
      { id: 'rejected', title: 'Rejected' }
    ];

    kanbanEl.innerHTML = cols.map(col => {
      const items = list.filter(j => col.id === 'rejected' ? (j.status === 'rejected' || j.status === 'ghosted') : j.status === col.id);
      const cards = items.map(j => {
        const res = resumes.find(r => r.id === j.resumeId || r.name === j.resumeName);
        let skillsBadge = '';
        if (j.jobDescription && typeof SkillsMatcher !== 'undefined') {
          const match = SkillsMatcher.matchSkills(j.jobDescription, currentSettings.userSkills);
          if (match && match.jdKeywords.length > 0) {
            skillsBadge = `<span class="badge" style="background:var(--green-bg);color:var(--green-fg);border:1px solid rgba(34,197,94,0.3);font-size:10px;font-weight:600;" title="Skills Match: ${match.matched.length}/${match.jdKeywords.length} keywords">⚡ ${match.score}% Match</span>`;
          }
        }

        return `
          <div class="k-card" data-id="${j.id}" draggable="true">
            <div class="k-card-top">
              <div>
                <div class="k-card-title">${esc(j.title)}</div>
                <div class="k-card-company">${esc(j.company)}</div>
              </div>
            </div>
            <div class="k-card-tags">
              <span class="badge badge-resume ${hasFile ? 'badge-has-file btn-preview-resume-card' : ''}" data-resume="${esc(j.resumeId || j.resumeName)}" title="${hasFile ? 'Click to preview stored resume' : esc(j.resumeName)}">${hasFile ? '📄 ' : ''}${esc(j.resumeName)}</span>
              <span class="badge badge-platform">${esc(j.platform || 'Direct')}</span>
              ${skillsBadge}
            </div>
            <div class="k-card-footer">
              <span>${fmtDate(j.appliedAt)}</span>
              ${j.salary ? `<span class="k-card-salary">${esc(j.salary)}</span>` : ''}
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="k-col" data-col="${col.id}">
          <div class="k-col-head">
            <span class="k-col-title">${col.title}</span>
            <span class="k-col-count">${items.length}</span>
          </div>
          <div class="k-cards" data-status="${col.id}">
            ${cards || `<div class="k-empty">No items</div>`}
          </div>
        </div>
      `;
    }).join('');

    initDragDrop();
    bindResumeClicks(kanbanEl);
  }

  function initDragDrop() {
    kanbanEl.querySelectorAll('.k-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.badge-has-file')) return;
        openModal(card.dataset.id);
      });
      card.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', card.dataset.id);
        card.style.opacity = '0.4';
      });
      card.addEventListener('dragend', () => { card.style.opacity = '1'; });
    });

    kanbanEl.querySelectorAll('.k-cards').forEach(zone => {
      zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
      zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
      zone.addEventListener('drop', async e => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        const id = e.dataTransfer.getData('text/plain');
        const status = zone.dataset.status;
        if (id && status) {
          await StorageService.updateJobStatus(id, status, `Moved to ${status} via board`);
          notify(`Status → ${cap(status)}`);
          await refresh();
        }
      });
    });
  }

  /* ─── Table ─── */
  function renderTable(list) {
    if (list.length === 0) {
      allTbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-3);padding:32px">No applications match your filters</td></tr>`;
      return;
    }
    allTbody.innerHTML = list.map(j => {
      const res = resumes.find(r => r.id === j.resumeId || r.name === j.resumeName);
      const hasFile = j.resumeHasFile || (res && res.hasFile);

      return `
        <tr>
          <td><div class="td-position"><span class="td-title">${esc(j.title)}</span><span class="td-company">${esc(j.company)}${j.location ? ' · '+esc(j.location) : ''}</span></div></td>
          <td>
            <div style="display:flex;align-items:center;gap:6px">
              <span class="badge badge-resume ${hasFile ? 'badge-has-file' : ''}" data-resume="${esc(j.resumeId || j.resumeName)}" title="${hasFile ? 'Click to preview resume' : esc(j.resumeName)}">${hasFile ? '📄 ' : ''}${esc(j.resumeName)}</span>
              ${hasFile ? `<button type="button" class="btn-file-action btn-download-job-resume" data-resume="${esc(j.resumeId || j.resumeName)}" title="Download stored resume"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:11px;height:11px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> Download</button>` : ''}
            </div>
          </td>
          <td><span class="badge badge-platform">${esc(j.platform || 'Direct')}</span></td>
          <td style="white-space:nowrap">${fmtDate(j.appliedAt)}</td>
          <td>
            <select class="inline-status-sel" data-id="${j.id}">
              ${['wishlist','applied','screening','interviewing','offer','rejected','ghosted'].map(s => `<option value="${s}" ${j.status===s?'selected':''}>${cap(s)}</option>`).join('')}
            </select>
          </td>
          <td>${esc(j.salary || '—')}</td>
          <td>
            <div style="display:flex;gap:4px">
              <button class="btn-icon-sm btn-edit-job" data-id="${j.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
              ${j.url ? `<a href="${esc(j.url)}" target="_blank" class="btn-icon-sm"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    allTbody.querySelectorAll('.inline-status-sel').forEach(sel => {
      sel.addEventListener('change', async () => {
        await StorageService.updateJobStatus(sel.dataset.id, sel.value);
        notify('Status updated');
        await refresh();
      });
    });

    bindEdits(allTbody);
    bindResumeClicks(allTbody);
  }

  function bindEdits(container) {
    container.querySelectorAll('.btn-edit-job').forEach(b =>
      b.addEventListener('click', () => openModal(b.dataset.id))
    );
  }

  function bindResumeClicks(container) {
    // Click on badge with file to preview
    container.querySelectorAll('.badge-has-file').forEach(badge => {
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        openResumePreview(badge.dataset.resume);
      });
    });

    // Click on quick download
    container.querySelectorAll('.btn-quick-dl, .btn-download-job-resume').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await StorageService.downloadResume(btn.dataset.resume);
          notify('Downloading resume...');
        } catch (err) {
          notify('Resume file not found', true);
        }
      });
    });
  }

  /* ═══════════════════════════════════════
     RESUMES TAB
     ═══════════════════════════════════════ */

  function renderResumes() {
    const stats = getResumeStats();

    resumeGrid.innerHTML = stats.map((s, i) => {
      const isTop = i === 0 && s.total >= 2 && s.rate > 0;
      return `
        <div class="res-card ${isTop ? 'top-performer' : ''}">
          <div class="res-card-head">
            <div style="flex: 1; min-width: 0;">
              <div class="res-name" title="${esc(s.name)}">${esc(s.name)}</div>
              <div style="margin-top: 4px; display: flex; gap: 6px; align-items: center;">
                <span class="res-meta">${s.isDefault ? 'Default' : 'Variant'}</span>
                ${s.hasFile ? `<span class="res-file-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:11px;height:11px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg> ${s.fileType === 'application/pdf' ? 'PDF' : 'DOC'} · ${StorageService.formatFileSize(s.fileSize)}</span>` : `<span class="res-file-badge no-file">Text tag</span>`}
              </div>
            </div>
            ${isTop ? '<span class="res-top-tag">Best performer</span>' : ''}
          </div>
          <div class="res-metrics">
            <div class="rm-item"><span class="rm-label">Sent</span><span class="rm-val">${s.total}</span></div>
            <div class="rm-item"><span class="rm-label">Rate</span><span class="rm-val ${s.rate > 20 ? 'rm-val-green' : ''}">${s.rate}%</span></div>
          </div>
          <div class="res-footer" style="flex-wrap:wrap;gap:8px;">
            <div style="display:flex;gap:6px;align-items:center;">
              ${s.hasFile ? `<button type="button" class="btn-file-action btn-preview-res-card" data-id="${s.id}">📄 View / Download</button>` : `<button type="button" class="btn-file-action btn-attach-file-res" data-id="${s.id}">⬆ Attach file</button>`}
            </div>
            <div style="display:flex;gap:8px;align-items:center;margin-left:auto;">
              ${!s.isDefault ? `<button class="btn-link btn-set-default" data-id="${s.id}">Set default</button>` : '<span style="font-size:11px;color:var(--blue);font-weight:500">Default</span>'}
              <button class="btn-link btn-delete-res" style="color:var(--red);" data-id="${s.id}">Delete</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    resumeGrid.querySelectorAll('.btn-set-default').forEach(b => {
      b.addEventListener('click', async () => {
        await StorageService.setDefaultResume(b.dataset.id);
        notify('Default resume updated');
        await refresh();
      });
    });

    resumeGrid.querySelectorAll('.btn-preview-res-card').forEach(b => {
      b.addEventListener('click', () => openResumePreview(b.dataset.id));
    });

    resumeGrid.querySelectorAll('.btn-attach-file-res').forEach(b => {
      b.addEventListener('click', () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.pdf,.doc,.docx,.txt,.rtf';
        fileInput.onchange = async (e) => {
          const file = e.target.files && e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = async (evt) => {
            await StorageService.saveResumeFile(b.dataset.id, {
              name: file.name,
              fileType: file.type,
              fileSize: file.size,
              dataUrl: evt.target.result
            });
            notify(`Attached ${file.name} to resume variant!`);
            await refresh();
          };
          reader.readAsDataURL(file);
        };
        fileInput.click();
      });
    });

    resumeGrid.querySelectorAll('.btn-delete-res').forEach(b => {
      b.addEventListener('click', async () => {
        if (confirm('Delete this resume variant and its stored local file?')) {
          await StorageService.deleteResume(b.dataset.id);
          notify('Resume deleted');
          await refresh();
        }
      });
    });

    resumeTbody.innerHTML = stats.map(s => `
      <tr>
        <td><strong>${esc(s.name)}</strong></td>
        <td>
          ${s.hasFile ? `<span class="res-file-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:11px;height:11px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg> ${StorageService.formatFileSize(s.fileSize)}</span>` : '<span style="color:var(--text-3);font-size:12px;">No file</span>'}
        </td>
        <td>${s.total}</td>
        <td style="color:var(--green);font-weight:600">${s.replies}</td>
        <td style="color:var(--red)">${s.rejected}</td>
        <td style="color:var(--amber);font-weight:600">${s.offers}</td>
        <td><strong style="color:${s.rate >= 20 ? 'var(--green)' : 'var(--text-1)'}">${s.rate}%</strong></td>
        <td>
          <div style="display:flex;gap:4px;">
            ${s.hasFile ? `<button type="button" class="btn-file-action btn-preview-res-table" data-id="${s.id}">Preview</button><button type="button" class="btn-file-action btn-dl-res-table" data-id="${s.id}">Download</button>` : ''}
            ${s.isDefault ? '<span class="badge status-applied" style="margin-left:4px;">Default</span>' : ''}
          </div>
        </td>
      </tr>
    `).join('');

    resumeTbody.querySelectorAll('.btn-preview-res-table').forEach(b => {
      b.addEventListener('click', () => openResumePreview(b.dataset.id));
    });

    resumeTbody.querySelectorAll('.btn-dl-res-table').forEach(b => {
      b.addEventListener('click', async () => {
        try {
          await StorageService.downloadResume(b.dataset.id);
          notify('Downloading resume...');
        } catch {
          notify('File not found', true);
        }
      });
    });
  }

  function getResumeStats() {
    return resumes.map(r => {
      const sent = jobs.filter(j => j.resumeId === r.id || j.resumeName === r.name);
      const replies = sent.filter(j => ['screening','interviewing','offer'].includes(j.status)).length;
      const offers = sent.filter(j => j.status === 'offer').length;
      const rejected = sent.filter(j => j.status === 'rejected').length;
      const total = sent.length;
      return {
        id: r.id,
        name: r.name,
        hasFile: !!r.hasFile,
        fileSize: r.fileSize || 0,
        fileType: r.fileType || '',
        isDefault: !!r.isDefault,
        total,
        replies,
        offers,
        rejected,
        rate: total > 0 ? Math.round((replies/total)*100) : 0
      };
    }).sort((a,b) => b.rate - a.rate || b.total - a.total);
  }

  /* ═══════════════════════════════════════
     JOB MODAL (APPLICATION DETAILS)
     ═══════════════════════════════════════ */

  btnAdd.addEventListener('click', () => openModal());
  btnCloseModal.addEventListener('click', () => jobModal.classList.add('hidden'));
  btnCancelModal.addEventListener('click', () => jobModal.classList.add('hidden'));
  jobModal.addEventListener('click', e => { if (e.target === jobModal) jobModal.classList.add('hidden'); });

  // Mode toggles inside Job Modal
  modalResumeModeSaved.addEventListener('click', () => switchJobModalResumeMode('saved'));
  modalResumeModeUpload.addEventListener('click', () => switchJobModalResumeMode('upload'));

  function switchJobModalResumeMode(mode) {
    modalResumeMode = mode;
    if (mode === 'saved') {
      modalResumeModeSaved.classList.add('active');
      modalResumeModeUpload.classList.remove('active');
      modalResumeSavedPanel.classList.remove('hidden');
      modalResumeUploadPanel.classList.add('hidden');
    } else {
      modalResumeModeUpload.classList.add('active');
      modalResumeModeSaved.classList.remove('active');
      modalResumeUploadPanel.classList.remove('hidden');
      modalResumeSavedPanel.classList.add('hidden');
    }
  }

  // Update chip when dropdown changes
  mResume.addEventListener('change', updateModalResumeChip);

  function updateModalResumeChip() {
    const selId = mResume.value;
    const res = resumes.find(r => r.id === selId);
    if (res && res.hasFile) {
      modalResumeFileChip.classList.remove('hidden');
      modalResumeFileText.textContent = `Stored locally (${StorageService.formatFileSize(res.fileSize)})`;
    } else {
      modalResumeFileChip.classList.add('hidden');
    }
  }

  btnModalViewResume.addEventListener('click', () => {
    const selId = mResume.value;
    if (selId) openResumePreview(selId);
  });

  // Dropzone in Job Modal
  modalResumeDropzone.addEventListener('click', () => modalResumeFileInput.click());

  ['dragenter', 'dragover'].forEach(name => {
    modalResumeDropzone.addEventListener(name, (e) => {
      e.preventDefault();
      modalResumeDropzone.classList.add('drag-active');
    });
  });

  ['dragleave', 'drop'].forEach(name => {
    modalResumeDropzone.addEventListener(name, (e) => {
      e.preventDefault();
      modalResumeDropzone.classList.remove('drag-active');
    });
  });

  modalResumeDropzone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files && files.length > 0) handleJobModalFile(files[0]);
  });

  modalResumeFileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) handleJobModalFile(e.target.files[0]);
  });

  function handleJobModalFile(file) {
    if (!file) return;
    const ext = file.name.split('.').pop().toUpperCase();
    modalChipBadge.textContent = ext.length <= 4 ? ext : 'DOC';
    modalChipName.textContent = file.name;
    modalChipSize.textContent = `${StorageService.formatFileSize(file.size)} · Ready to store locally`;

    const reader = new FileReader();
    reader.onload = (evt) => {
      modalUploadedResume = {
        name: file.name,
        originalFileName: file.name,
        fileType: file.type || 'application/octet-stream',
        fileSize: file.size,
        dataUrl: evt.target.result
      };
      modalResumeDropzone.classList.add('hidden');
      modalResumeSelectedChip.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  }

  btnModalRemoveFile.addEventListener('click', () => {
    resetJobModalUpload();
  });

  function resetJobModalUpload() {
    modalUploadedResume = null;
    modalResumeFileInput.value = '';
    modalResumeSelectedChip.classList.add('hidden');
    modalResumeDropzone.classList.remove('hidden');
  }

  function openModal(id = null) {
    switchJobModalResumeMode('saved');
    resetJobModalUpload();

    if (id) {
      const j = jobs.find(x => x.id === id);
      if (!j) return;
      modalHeading.textContent = `${j.company} — ${j.title}`;
      mId.value = j.id;
      mTitle.value = j.title;
      mCompany.value = j.company;
      mLocation.value = j.location || '';
      mPlatform.value = j.platform || '';
      
      // Match resume
      const resMatch = resumes.find(r => r.id === j.resumeId || r.name === j.resumeName);
      if (resMatch) {
        mResume.value = resMatch.id;
      } else if (mResume.options.length > 0) {
        mResume.selectedIndex = 0;
      }

      mStatus.value = j.status;
      mDatetime.value = toLocalISO(j.appliedAt);
      mSalary.value = j.salary || '';
      mUrl.value = j.url || '';
      mFollowup.value = j.followUpDate || '';
      mContactName.value = j.contactName || '';
      mContactEmail.value = j.contactEmail || '';
      mNotes.value = j.notes || '';
      btnDeleteJob.classList.remove('hidden');

      if (modalJobDescription) modalJobDescription.value = j.jobDescription || '';
      renderModalSkillsMatch(j.jobDescription || '');
      toggleJdAccordion(false);

      mTimelineSection.classList.remove('hidden');
      const tl = j.timeline || [];
      mTimelineList.innerHTML = tl.map(t => `
        <div class="tl-entry">
          <span><span class="tl-entry-status">${cap(t.status)}</span> — ${esc(t.note || '')}</span>
          <span class="tl-entry-date">${fmtDate(t.date)}</span>
        </div>
      `).join('') || '<div style="color:var(--text-3);font-size:12px">No timeline entries</div>';

      updateModalResumeChip();
    } else {
      modalHeading.textContent = 'New application';
      mId.value = '';
      mTitle.value = '';
      mCompany.value = '';
      mLocation.value = '';
      mPlatform.value = '';
      mStatus.value = 'applied';
      mDatetime.value = toLocalISO(new Date().toISOString());
      mSalary.value = '';
      mUrl.value = '';
      mFollowup.value = '';
      mContactName.value = '';
      mContactEmail.value = '';
      mNotes.value = '';
      if (modalJobDescription) modalJobDescription.value = '';
      renderModalSkillsMatch('');
      toggleJdAccordion(false);
      btnDeleteJob.classList.add('hidden');
      mTimelineSection.classList.add('hidden');

      const defRes = resumes.find(r => r.isDefault) || resumes[0];
      if (defRes) mResume.value = defRes.id;
      updateModalResumeChip();
    }
    jobModal.classList.remove('hidden');
  }

  modalForm.addEventListener('submit', async e => {
    e.preventDefault();
    const id = mId.value;
    const existing = id ? jobs.find(j => j.id === id) : null;

    let resumeId = '';
    let resumeName = '';
    let resumeHasFile = false;
    let uploadedResumePayload = null;

    if (modalResumeMode === 'upload') {
      if (!modalUploadedResume) {
        return notify('Please select a resume file to upload, or switch to "Saved"', true);
      }
      uploadedResumePayload = modalUploadedResume;
      resumeName = modalUploadedResume.name;
      resumeHasFile = true;
    } else {
      resumeId = mResume.value;
      const resObj = resumes.find(r => r.id === resumeId);
      resumeName = resObj ? resObj.name : 'Default Resume';
      resumeHasFile = resObj ? !!resObj.hasFile : false;
    }

    const data = {
      id: id || undefined,
      title: mTitle.value.trim(),
      company: mCompany.value.trim(),
      location: mLocation.value.trim(),
      platform: mPlatform.value.trim() || StorageService.detectPlatform(mUrl.value.trim()),
      resumeId: resumeId,
      resumeName: resumeName,
      resumeHasFile: resumeHasFile,
      uploadedResume: uploadedResumePayload,
      status: mStatus.value,
      appliedAt: new Date(mDatetime.value).toISOString(),
      salary: mSalary.value.trim(),
      url: mUrl.value.trim(),
      followUpDate: mFollowup.value,
      contactName: mContactName.value.trim(),
      contactEmail: mContactEmail.value.trim(),
      notes: mNotes.value.trim(),
      jobDescription: modalJobDescription ? modalJobDescription.value.trim() : '',
      timeline: existing ? existing.timeline : undefined
    };

    if (existing && existing.status !== data.status) {
      if (!data.timeline) data.timeline = [];
      data.timeline.push({ status: data.status, date: new Date().toISOString(), note: `Status → ${data.status}` });
    }

    await StorageService.saveJob(data);
    jobModal.classList.add('hidden');
    notify(id ? 'Application updated' : (uploadedResumePayload ? '✓ Application saved & resume stored locally!' : 'Application tracked'));
    await refresh();
  });

  btnDeleteJob.addEventListener('click', async () => {
    const id = mId.value;
    if (!id) return;
    if (confirm('Delete this application?')) {
      await StorageService.deleteJob(id);
      jobModal.classList.add('hidden');
      notify('Application deleted');
      await refresh();
    }
  });

  /* ═══════════════════════════════════════
     RESUME MODAL (UPLOAD TO LIBRARY)
     ═══════════════════════════════════════ */

  btnAddResume.addEventListener('click', () => {
    inputResName.value = '';
    checkDefault.checked = false;
    resetAddResumeUpload();
    resumeModal.classList.remove('hidden');
  });

  btnCloseResModal.addEventListener('click', () => resumeModal.classList.add('hidden'));
  btnCancelResModal.addEventListener('click', () => resumeModal.classList.add('hidden'));
  resumeModal.addEventListener('click', e => { if (e.target === resumeModal) resumeModal.classList.add('hidden'); });

  dropzoneAddResume.addEventListener('click', () => inputResumeFile.click());

  inputResumeFile.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleAddResumeFile(e.target.files[0]);
    }
  });

  function handleAddResumeFile(file) {
    if (!file) return;
    const ext = file.name.split('.').pop().toUpperCase();
    addChipBadge.textContent = ext.length <= 4 ? ext : 'DOC';
    addChipName.textContent = file.name;
    addChipSize.textContent = `${StorageService.formatFileSize(file.size)} · Ready to store`;
    if (!inputResName.value.trim()) {
      inputResName.value = file.name;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      addResumeUploadedFile = {
        name: file.name,
        originalFileName: file.name,
        fileType: file.type || 'application/octet-stream',
        fileSize: file.size,
        dataUrl: evt.target.result
      };
      dropzoneAddResume.classList.add('hidden');
      addResumeSelectedChip.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  }

  btnAddRemoveFile.addEventListener('click', () => {
    resetAddResumeUpload();
  });

  function resetAddResumeUpload() {
    addResumeUploadedFile = null;
    inputResumeFile.value = '';
    addResumeSelectedChip.classList.add('hidden');
    dropzoneAddResume.classList.remove('hidden');
  }

  resumeForm.addEventListener('submit', async e => {
    e.preventDefault();
    const name = inputResName.value.trim();
    if (!name) return;
    await StorageService.addResume(name, checkDefault.checked, addResumeUploadedFile);
    resumeModal.classList.add('hidden');
    notify(`Saved "${name}" to local resume library!`);
    await refresh();
  });

  /* ═══════════════════════════════════════
     RESUME PREVIEW MODAL
     ═══════════════════════════════════════ */

  async function openResumePreview(idOrName) {
    try {
      const res = await StorageService.getResumeBlobUrl(idOrName);
      if (!res || !res.url) {
        return notify('No local resume file stored for this variant.', true);
      }

      if (activePreviewBlobUrl && activePreviewBlobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(activePreviewBlobUrl);
      }
      activePreviewBlobUrl = res.url;
      activePreviewResumeId = idOrName;

      previewModalTitle.textContent = res.file.originalFileName || res.file.name || 'Resume Document';
      previewModalMeta.textContent = `${StorageService.formatFileSize(res.file.fileSize)} · Stored 100% locally on your machine`;

      const isPdf = (res.file.fileType && res.file.fileType.includes('pdf')) || (res.file.name && res.file.name.toLowerCase().endsWith('.pdf'));

      if (isPdf) {
        previewFallbackContainer.classList.add('hidden');
        previewPdfContainer.classList.remove('hidden');
        previewPdfIframe.src = res.url;
      } else {
        previewPdfContainer.classList.add('hidden');
        previewFallbackContainer.classList.remove('hidden');
        previewFallbackFilename.textContent = res.file.name;
        previewFallbackInfo.textContent = `File type: ${res.file.fileType || 'Document'} (${StorageService.formatFileSize(res.file.fileSize)}). Click Download to open on your device.`;
      }

      resumePreviewModal.classList.remove('hidden');
    } catch (err) {
      console.error(err);
      notify('Failed to load resume file', true);
    }
  }

  btnPreviewDownload.addEventListener('click', async () => {
    if (activePreviewResumeId) {
      await StorageService.downloadResume(activePreviewResumeId);
      notify('Downloading resume...');
    }
  });

  btnFallbackDownload.addEventListener('click', async () => {
    if (activePreviewResumeId) {
      await StorageService.downloadResume(activePreviewResumeId);
      notify('Downloading resume...');
    }
  });

  btnPreviewNewTab.addEventListener('click', () => {
    if (activePreviewBlobUrl) {
      window.open(activePreviewBlobUrl, '_blank');
    }
  });

  btnClosePreviewModal.addEventListener('click', () => {
    resumePreviewModal.classList.add('hidden');
    previewPdfIframe.src = '';
  });

  resumePreviewModal.addEventListener('click', (e) => {
    if (e.target === resumePreviewModal) {
      resumePreviewModal.classList.add('hidden');
      previewPdfIframe.src = '';
    }
  });

  /* ═══════════════════════════════════════
     DATA MANAGEMENT
     ═══════════════════════════════════════ */

  btnDataMenu.addEventListener('click', () => dataDropdown.classList.toggle('hidden'));
  document.addEventListener('click', e => {
    if (!document.getElementById('data-dropdown-wrap').contains(e.target)) dataDropdown.classList.add('hidden');
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      jobModal.classList.add('hidden');
      resumeModal.classList.add('hidden');
      resumePreviewModal.classList.add('hidden');
      previewPdfIframe.src = '';
      dataDropdown.classList.add('hidden');
    }
  });

  btnExportCsv.addEventListener('click', () => {
    dataDropdown.classList.add('hidden');
    if (jobs.length === 0) return notify('No data to export', true);
    const headers = ['Title','Company','Location','Platform','Resume','Has Stored File','Status','Applied At','Salary','URL','Contact','Email','Notes'];
    const rows = jobs.map(j => [
      j.title,
      j.company,
      j.location,
      j.platform,
      j.resumeName,
      j.resumeHasFile ? 'Yes' : 'No',
      j.status,
      j.appliedAt,
      j.salary,
      j.url,
      j.contactName,
      j.contactEmail,
      j.notes
    ].map(v => `"${String(v||'').replace(/"/g,'""')}"`).join(','));
    download([headers.join(','), ...rows].join('\n'), `jobpulse_${new Date().toISOString().slice(0,10)}.csv`, 'text/csv');
    notify('CSV exported');
  });

  btnExportJson.addEventListener('click', async () => {
    dataDropdown.classList.add('hidden');
    const data = await StorageService.exportData(true);
    download(JSON.stringify(data, null, 2), `jobpulse_full_backup_${new Date().toISOString().slice(0,10)}.json`, 'application/json');
    notify('JSON backup with stored resume files exported');
  });

  fileImport.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const imported = JSON.parse(await file.text());
      await StorageService.importData(imported);
      notify('Backup and resumes imported!');
      await refresh();
    } catch (err) { alert('Import error: ' + err.message); }
    dataDropdown.classList.add('hidden');
    fileImport.value = '';
  });

  btnClearAll.addEventListener('click', async () => {
    dataDropdown.classList.add('hidden');
    if (confirm('This will erase all applications and resume records. Continue?')) {
      await StorageService.set('jobpulse_applications', []);
      notify('All data cleared');
      await refresh();
    }
  });

  btnLoadDemo.addEventListener('click', async () => {
    if (jobs.length > 0 && !confirm('Replace current data with 8 sample applications and pre-seeded resume PDFs?')) return;
    await StorageService.loadSampleData();
    notify('Sample data loaded with downloadable resume files!');
    await refresh();
  });

  /* ═══════════════════════════════════════
     UTILITIES
     ═══════════════════════════════════════ */

  function fmtDate(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  }

  function toLocalISO(iso) {
    try {
      const d = new Date(iso);
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    } catch { return ''; }
  }

  function esc(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

  function notify(msg, isError = false) {
    toast.textContent = msg;
    toast.className = `toast${isError ? ' toast-error' : ''}`;
    setTimeout(() => toast.classList.add('hidden'), 3000);
  }

  function download(content, name, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
});
