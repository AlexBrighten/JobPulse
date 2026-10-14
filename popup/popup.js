// popup/popup.js - Controller for extension popup interface with local resume file upload & storage

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const jobForm = document.getElementById('job-form');
  const titleInput = document.getElementById('job-title');
  const companyInput = document.getElementById('job-company');
  const locationInput = document.getElementById('job-location');
  const resumeSelect = document.getElementById('job-resume');
  const statusSelect = document.getElementById('job-status');
  const datetimeInput = document.getElementById('job-datetime');
  const salaryInput = document.getElementById('job-salary');
  const urlInput = document.getElementById('job-url');
  const notesInput = document.getElementById('job-notes');
  const detectedBanner = document.getElementById('detected-banner');
  const detectedText = document.getElementById('detected-source-text');
  const btnRescan = document.getElementById('btn-rescan');
  const btnDashboard = document.getElementById('btn-open-dashboard');
  const toast = document.getElementById('toast');

  // Resume Mode Toggle & Dropzone Elements
  const btnModeSaved = document.getElementById('btn-mode-saved');
  const btnModeUpload = document.getElementById('btn-mode-upload');
  const panelSaved = document.getElementById('panel-resume-saved');
  const panelUpload = document.getElementById('panel-resume-upload');
  const savedFileInfo = document.getElementById('saved-resume-file-info');
  const savedChipText = document.getElementById('saved-resume-chip-text');
  const btnDownloadSelectedResume = document.getElementById('btn-download-selected-resume');

  const uploadDropzone = document.getElementById('popup-upload-dropzone');
  const fileInput = document.getElementById('popup-resume-file-input');
  const dropzoneIdle = document.getElementById('dropzone-idle-state');
  const dropzoneSelected = document.getElementById('dropzone-selected-state');
  const selectedFileBadge = document.getElementById('selected-file-badge');
  const selectedFileName = document.getElementById('selected-file-name');
  const selectedFileSize = document.getElementById('selected-file-size');
  const btnRemoveSelectedFile = document.getElementById('btn-remove-selected-file');
  const checkPopupSetDefault = document.getElementById('check-popup-set-default');

  // Mini stats elements
  const miniTotal = document.getElementById('mini-stat-total');
  const miniReplies = document.getElementById('mini-stat-replies');
  const miniRate = document.getElementById('mini-stat-rate');

  const btnToggleTheme = document.getElementById('btn-toggle-theme');

  let currentPlatform = 'Other';
  let activeResumeMode = 'saved'; // 'saved' | 'upload'
  let uploadedResumeState = null;  // { name, fileType, fileSize, dataUrl }
  let cachedResumes = [];
  let currentJobDescription = '';
  let currentTheme = 'system';

  // 1. Initialize Theme
  await initPopupTheme();

  // 2. Initialize Date & Time to current local time (YYYY-MM-DDTHH:mm)
  initDateTime();

  // 3. Load Resumes
  await loadResumes();

  // 4. Update Mini Stats
  await updateMiniStats();

  // 5. Auto-detect from active tab
  await scanActiveTab();

  // ─── Theme Switching ───
  async function initPopupTheme() {
    const settings = await StorageService.getSettings();
    currentTheme = settings.theme || 'system';
    applyPopupTheme(currentTheme);

    if (btnToggleTheme) {
      btnToggleTheme.addEventListener('click', async () => {
        const newTheme = (document.documentElement.getAttribute('data-theme') === 'dark') ? 'light' : 'dark';
        await StorageService.updateSettings({ theme: newTheme });
        applyPopupTheme(newTheme);
      });
    }
  }

  function applyPopupTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  // ─── Mode Switching ───
  btnModeSaved.addEventListener('click', () => switchResumeMode('saved'));
  btnModeUpload.addEventListener('click', () => switchResumeMode('upload'));

  function switchResumeMode(mode) {
    activeResumeMode = mode;
    if (mode === 'saved') {
      btnModeSaved.classList.add('active');
      btnModeUpload.classList.remove('active');
      panelSaved.classList.remove('hidden');
      panelUpload.classList.add('hidden');
    } else {
      btnModeUpload.classList.add('active');
      btnModeSaved.classList.remove('active');
      panelUpload.classList.remove('hidden');
      panelSaved.classList.add('hidden');
    }
  }

  // ─── Saved Resume Selection & Download ───
  resumeSelect.addEventListener('change', updateSavedFileInfo);

  function updateSavedFileInfo() {
    const selId = resumeSelect.value;
    const res = cachedResumes.find(r => r.id === selId);
    if (res && res.hasFile) {
      savedFileInfo.classList.remove('hidden');
      const sizeStr = StorageService.formatFileSize(res.fileSize);
      savedChipText.textContent = `Stored locally (${sizeStr})`;
    } else {
      savedFileInfo.classList.add('hidden');
    }
  }

  btnDownloadSelectedResume.addEventListener('click', async (e) => {
    e.stopPropagation();
    const selId = resumeSelect.value;
    try {
      await StorageService.downloadResume(selId);
      showToast('Downloading stored resume...');
    } catch (err) {
      showToast('Resume file not found in local storage.', 'error');
    }
  });

  // ─── File Upload Dropzone Handling ───
  uploadDropzone.addEventListener('click', (e) => {
    if (e.target.closest('#btn-remove-selected-file')) return;
    fileInput.click();
  });

  // Drag and Drop
  ['dragenter', 'dragover'].forEach(eventName => {
    uploadDropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      uploadDropzone.classList.add('drag-active');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    uploadDropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      uploadDropzone.classList.remove('drag-active');
    });
  });

  uploadDropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files && files.length > 0) {
      handleFileSelected(files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
  });

  function handleFileSelected(file) {
    if (!file) return;

    // Validate size (max 20MB)
    if (file.size > 20 * 1024 * 1024) {
      showToast('File size exceeds 20MB limit.', 'error');
      return;
    }

    const ext = file.name.split('.').pop().toUpperCase();
    selectedFileBadge.textContent = ext.length <= 4 ? ext : 'DOC';
    selectedFileName.textContent = file.name;
    selectedFileSize.textContent = `${StorageService.formatFileSize(file.size)} · Ready to save locally`;

    const reader = new FileReader();
    reader.onload = (evt) => {
      uploadedResumeState = {
        name: file.name,
        originalFileName: file.name,
        fileType: file.type || 'application/octet-stream',
        fileSize: file.size,
        dataUrl: evt.target.result
      };
      dropzoneIdle.classList.add('hidden');
      dropzoneSelected.classList.remove('hidden');
      showToast('Resume ready to save locally!');
    };
    reader.onerror = () => {
      showToast('Failed to read file.', 'error');
    };
    reader.readAsDataURL(file);
  }

  btnRemoveSelectedFile.addEventListener('click', (e) => {
    e.stopPropagation();
    resetUploadDropzone();
  });

  function resetUploadDropzone() {
    uploadedResumeState = null;
    fileInput.value = '';
    dropzoneSelected.classList.add('hidden');
    dropzoneIdle.classList.remove('hidden');
    checkPopupSetDefault.checked = false;
  }

  // ─── Dashboard Navigation ───
  btnDashboard.addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.runtime) {
      chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html') });
    } else {
      window.open('../dashboard/dashboard.html', '_blank');
    }
  });

  btnRescan.addEventListener('click', scanActiveTab);

  // ─── Form Submission ───
  jobForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = titleInput.value.trim();
    const company = companyInput.value.trim();

    if (!title || !company) {
      showToast('Please specify Job Title and Company.', 'error');
      return;
    }

    // Determine resume linkage
    let resumeId = '';
    let resumeName = '';
    let resumeHasFile = false;
    let uploadedResumePayload = null;

    if (activeResumeMode === 'upload') {
      if (!uploadedResumeState) {
        showToast('Please select a resume file to upload, or switch to "Saved".', 'error');
        return;
      }
      uploadedResumePayload = {
        ...uploadedResumeState,
        isDefault: checkPopupSetDefault.checked
      };
      resumeName = uploadedResumeState.name;
      resumeHasFile = true;
    } else {
      const selOpt = resumeSelect.selectedOptions[0];
      resumeId = resumeSelect.value;
      const resObj = cachedResumes.find(r => r.id === resumeId);
      resumeName = resObj ? resObj.name : (selOpt ? selOpt.textContent : 'Default Resume');
      resumeHasFile = resObj ? !!resObj.hasFile : false;
    }

    const jobData = {
      title: title,
      company: company,
      location: locationInput.value.trim(),
      url: urlInput.value.trim(),
      platform: currentPlatform || StorageService.detectPlatform(urlInput.value),
      resumeId: resumeId,
      resumeName: resumeName,
      resumeHasFile: resumeHasFile,
      uploadedResume: uploadedResumePayload,
      status: statusSelect.value,
      appliedAt: new Date(datetimeInput.value).toISOString(),
      salary: salaryInput.value.trim(),
      notes: notesInput.value.trim(),
      jobDescription: currentJobDescription || '',
      timeline: [
        {
          status: statusSelect.value,
          date: new Date(datetimeInput.value).toISOString(),
          note: `Applied and logged via JobPulse extension (${resumeName})`
        }
      ]
    };

    const submitBtn = document.getElementById('btn-submit-job');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Saving & Storing Locally...</span>';

    try {
      const savedJob = await StorageService.saveJob(jobData);
      
      const successMsg = uploadedResumePayload
        ? `✓ Applied to ${company} & resume stored locally!`
        : `✓ Tracked "${title}" at ${company}!`;
      showToast(successMsg);
      submitBtn.innerHTML = '<span>Saved! ✓</span>';

      await loadResumes(savedJob.resumeId);
      await updateMiniStats();

      // Reset form fields
      setTimeout(() => {
        titleInput.value = '';
        companyInput.value = '';
        locationInput.value = '';
        salaryInput.value = '';
        notesInput.value = '';
        statusSelect.value = 'applied';
        resetUploadDropzone();
        switchResumeMode('saved');
        initDateTime();
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }, 1200);

    } catch (err) {
      console.error(err);
      showToast('Error saving job application', 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  });

  // Helper Functions
  function initDateTime() {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localISOTime = new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
    datetimeInput.value = localISOTime;
  }

  async function loadResumes(selectIdOrName = null) {
    cachedResumes = await StorageService.getResumes();
    resumeSelect.innerHTML = '';
    
    cachedResumes.forEach(res => {
      const opt = document.createElement('option');
      opt.value = res.id;
      opt.textContent = res.name + (res.isDefault ? ' (Default)' : '') + (res.hasFile ? ' 📄' : '');
      if (selectIdOrName ? (res.id === selectIdOrName || res.name === selectIdOrName) : res.isDefault) {
        opt.selected = true;
      }
      resumeSelect.appendChild(opt);
    });

    updateSavedFileInfo();
  }

  async function updateMiniStats() {
    const jobs = await StorageService.getJobs();
    const total = jobs.length;
    const replies = jobs.filter(j => ['screening', 'interviewing', 'offer'].includes(j.status)).length;
    const rate = total > 0 ? Math.round((replies / total) * 100) : 0;

    miniTotal.textContent = total;
    miniReplies.textContent = replies;
    miniRate.textContent = `${rate}%`;
  }

  async function scanActiveTab() {
    detectedText.textContent = 'Scanning tab for job details...';

    if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.tabs.query) {
      detectedText.textContent = 'Browser preview mode';
      return;
    }

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url) {
        detectedText.textContent = 'No active webpage detected';
        return;
      }

      urlInput.value = tab.url;
      currentPlatform = StorageService.detectPlatform(tab.url);

      chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_JOB_INFO' }, (response) => {
        if (chrome.runtime.lastError || !response) {
          parseFromTabMeta(tab);
        } else {
          if (response.title) titleInput.value = response.title;
          if (response.company) companyInput.value = response.company;
          if (response.location) locationInput.value = response.location;
          if (response.platform) currentPlatform = response.platform;
          if (response.jobDescription) currentJobDescription = response.jobDescription;

          detectedText.textContent = `Auto-detected from ${currentPlatform}`;
        }
      });
    } catch (err) {
      console.warn('Scan tab error:', err);
      detectedText.textContent = 'Ready for manual entry';
    }
  }

  function parseFromTabMeta(tab) {
    const title = tab.title || '';
    currentPlatform = StorageService.detectPlatform(tab.url);

    if (tab.url.includes('linkedin.com')) {
      const parts = title.split(' hiring ');
      if (parts.length > 1) {
        companyInput.value = parts[0].trim();
        titleInput.value = parts[1].split(' in ')[0].replace(/\|.*$/, '').trim();
      } else {
        titleInput.value = title.split(' | ')[0].trim();
      }
      detectedText.textContent = 'Auto-detected from LinkedIn';
    } else if (tab.url.includes('indeed.com')) {
      const parts = title.split(' - ');
      if (parts.length >= 2) {
        titleInput.value = parts[0].trim();
        companyInput.value = parts[1].trim();
      }
      detectedText.textContent = 'Auto-detected from Indeed';
    } else {
      if (title) {
        titleInput.value = title.split(/[-–|]/)[0].trim();
      }
      detectedText.textContent = `Detected site: ${currentPlatform}`;
    }
  }

  function showToast(msg, type = 'success') {
    toast.textContent = msg;
    toast.className = `toast ${type === 'error' ? 'toast-error' : ''}`;
    toast.classList.remove('hidden');

    setTimeout(() => {
      toast.classList.add('hidden');
    }, 2800);
  }
});
