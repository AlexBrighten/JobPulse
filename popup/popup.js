// popup/popup.js - Controller for extension popup interface

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
  const btnAddResumeQuick = document.getElementById('btn-add-resume-quick');
  const quickResumeBox = document.getElementById('quick-resume-box');
  const newResumeInput = document.getElementById('new-resume-input');
  const btnSaveNewResume = document.getElementById('btn-save-new-resume');
  const btnCancelNewResume = document.getElementById('btn-cancel-new-resume');
  const toast = document.getElementById('toast');

  // Mini stats elements
  const miniTotal = document.getElementById('mini-stat-total');
  const miniReplies = document.getElementById('mini-stat-replies');
  const miniRate = document.getElementById('mini-stat-rate');

  let currentPlatform = 'Other';

  // 1. Initialize Date & Time to current local time (YYYY-MM-DDTHH:mm)
  initDateTime();

  // 2. Load Resumes
  await loadResumes();

  // 3. Update Mini Stats
  await updateMiniStats();

  // 4. Auto-detect from active tab
  await scanActiveTab();

  // Event Listeners
  btnRescan.addEventListener('click', scanActiveTab);

  btnDashboard.addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.runtime) {
      chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html') });
    } else {
      window.open('../dashboard/dashboard.html', '_blank');
    }
  });

  // Quick Resume adding
  btnAddResumeQuick.addEventListener('click', () => {
    quickResumeBox.classList.toggle('hidden');
    if (!quickResumeBox.classList.contains('hidden')) {
      newResumeInput.focus();
    }
  });

  btnCancelNewResume.addEventListener('click', () => {
    quickResumeBox.classList.add('hidden');
    newResumeInput.value = '';
  });

  btnSaveNewResume.addEventListener('click', async () => {
    const val = newResumeInput.value.trim();
    if (!val) return;
    const added = await StorageService.addResume(val);
    if (added) {
      await loadResumes(added.name);
      quickResumeBox.classList.add('hidden');
      newResumeInput.value = '';
      showToast('Resume variant added!');
    }
  });

  // Form Submission
  jobForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = titleInput.value.trim();
    const company = companyInput.value.trim();

    if (!title || !company) {
      showToast('Please specify Job Title and Company.', 'error');
      return;
    }

    const jobData = {
      title: title,
      company: company,
      location: locationInput.value.trim(),
      url: urlInput.value.trim(),
      platform: currentPlatform || StorageService.detectPlatform(urlInput.value),
      resumeName: resumeSelect.value,
      status: statusSelect.value,
      appliedAt: new Date(datetimeInput.value).toISOString(),
      salary: salaryInput.value.trim(),
      notes: notesInput.value.trim(),
      timeline: [
        {
          status: statusSelect.value,
          date: new Date(datetimeInput.value).toISOString(),
          note: 'Applied and logged via JobPulse extension'
        }
      ]
    };

    const submitBtn = document.getElementById('btn-submit-job');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Saving...</span>';

    try {
      await StorageService.saveJob(jobData);
      showToast(`✓ Tracked "${title}" at ${company}!`);
      submitBtn.innerHTML = '<span>Saved! ✓</span>';

      await updateMiniStats();

      // Reset form fields except resume
      setTimeout(() => {
        titleInput.value = '';
        companyInput.value = '';
        locationInput.value = '';
        salaryInput.value = '';
        notesInput.value = '';
        statusSelect.value = 'applied';
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
    // Offset for local timezone
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localISOTime = new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
    datetimeInput.value = localISOTime;
  }

  async function loadResumes(selectName = null) {
    const resumes = await StorageService.getResumes();
    resumeSelect.innerHTML = '';
    resumes.forEach(res => {
      const opt = document.createElement('option');
      opt.value = res.name;
      opt.textContent = res.name + (res.isDefault ? ' (Default)' : '');
      if (selectName ? (res.name === selectName) : res.isDefault) {
        opt.selected = true;
      }
      resumeSelect.appendChild(opt);
    });
  }

  async function updateMiniStats() {
    const jobs = await StorageService.getJobs();
    const total = jobs.length;
    // Replies: interview, offer, screening
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

      // Try sending message to content script
      chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_JOB_INFO' }, (response) => {
        if (chrome.runtime.lastError || !response) {
          // Content script may not be running on this tab, fallback to tab metadata
          parseFromTabMeta(tab);
        } else {
          // Content script extracted details
          if (response.title) titleInput.value = response.title;
          if (response.company) companyInput.value = response.company;
          if (response.location) locationInput.value = response.location;
          if (response.platform) currentPlatform = response.platform;

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
    toast.style.background = type === 'error' ? '#991b1b' : '#065f46';
    toast.style.borderColor = type === 'error' ? '#ef4444' : '#10b981';
    toast.classList.remove('hidden');

    setTimeout(() => {
      toast.classList.add('hidden');
    }, 2800);
  }
});
