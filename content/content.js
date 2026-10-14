// content/content.js - Content script for auto-detection and in-page quick tracking

(function () {
  // Prevent duplicate injection
  if (window.__JOBPULSE_INJECTED__) return;
  window.__JOBPULSE_INJECTED__ = true;

  // Listen for queries from popup
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === 'GET_PAGE_JOB_INFO') {
        const info = JobParser.extract();
        sendResponse(info);
      }
      return true;
    });
  }

  // Create floating quick-track button
  function initFloatingTracker() {
    // Only show on job detail/apply pages
    const isJobPage = checkIsJobPage();
    if (!isJobPage) return;

    if (document.getElementById('jobpulse-floating-trigger')) return;

    const triggerBtn = document.createElement('div');
    triggerBtn.id = 'jobpulse-floating-trigger';
    triggerBtn.innerHTML = `
      <svg viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
      <span>Track Job</span>
    `;

    triggerBtn.addEventListener('click', () => {
      toggleQuickModal();
    });

    document.body.appendChild(triggerBtn);
  }

  function checkIsJobPage() {
    const url = window.location.href.toLowerCase();
    return (
      url.includes('/jobs/') ||
      url.includes('viewjob') ||
      url.includes('/career') ||
      url.includes('lever.co/') ||
      url.includes('greenhouse.io/') ||
      url.includes('myworkdayjobs.com')
    );
  }

  function toggleQuickModal() {
    const existing = document.getElementById('jobpulse-modal-container');
    if (existing) {
      existing.remove();
      return;
    }

    const job = JobParser.extract();

    // Fetch existing resumes from storage
    StorageService.getResumes().then((resumes) => {
      let uploadedResumeData = null;
      let activeMode = 'saved';

      const modal = document.createElement('div');
      modal.id = 'jobpulse-modal-container';
      modal.innerHTML = `
        <div class="jp-modal-header">
          <div class="jp-modal-title">
            <span>⚡ Save Application</span>
            <span class="jp-badge-platform">${job.platform}</span>
          </div>
          <button class="jp-close-btn" id="jp-modal-close">✕</button>
        </div>

        <div class="jp-form-group">
          <label class="jp-form-label">Job Title</label>
          <input type="text" class="jp-input" id="jp-input-title" value="${escapeHtml(job.title || '')}" placeholder="e.g. Senior Frontend Engineer" />
        </div>

        <div class="jp-form-group">
          <label class="jp-form-label">Company</label>
          <input type="text" class="jp-input" id="jp-input-company" value="${escapeHtml(job.company || '')}" placeholder="e.g. Stripe" />
        </div>

        <div class="jp-form-group">
          <div class="jp-label-row">
            <label class="jp-form-label">Resume Used</label>
            <div class="jp-segment-wrap">
              <button type="button" class="jp-segment-btn active" id="jp-btn-mode-saved">Saved</button>
              <button type="button" class="jp-segment-btn" id="jp-btn-mode-upload">⬆ Upload</button>
            </div>
          </div>
          
          <div id="jp-panel-saved">
            <select class="jp-select" id="jp-select-resume">
              ${resumes.map(r => `<option value="${escapeHtml(r.id)}" ${r.isDefault ? 'selected' : ''}>${escapeHtml(r.name)}${r.hasFile ? ' 📄' : ''}</option>`).join('')}
            </select>
          </div>

          <div id="jp-panel-upload" style="display:none;margin-top:4px;">
            <input type="file" id="jp-file-input" style="display:none;" accept=".pdf,.doc,.docx,.txt,.rtf" />
            <div class="jp-file-dropzone" id="jp-dropzone">
              <span class="jp-file-dropzone-text">Click to choose resume file</span>
              <span class="jp-file-dropzone-sub">PDF, DOCX (stored 100% locally)</span>
            </div>
            <div id="jp-selected-chip" class="jp-file-chip" style="display:none;">
              <div class="jp-file-chip-info">
                <span class="jp-file-badge" id="jp-chip-badge">PDF</span>
                <span class="jp-file-name" id="jp-chip-name">Resume.pdf</span>
                <span class="jp-file-size" id="jp-chip-size">124 KB</span>
              </div>
              <button type="button" class="jp-remove-file" id="jp-chip-remove">✕</button>
            </div>
          </div>
        </div>

        <div class="jp-form-group">
          <label class="jp-form-label">Status</label>
          <select class="jp-select" id="jp-select-status">
            <option value="applied" selected>Applied</option>
            <option value="wishlist">Wishlist / To Apply</option>
            <option value="screening">Recruiter Screening</option>
            <option value="interviewing">Interviewing</option>
            <option value="offer">Offer Received</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <div class="jp-actions">
          <button class="jp-btn-save" id="jp-btn-submit">Save Application</button>
          <button class="jp-btn-view" id="jp-btn-dashboard">Dashboard</button>
        </div>
      `;

      document.body.appendChild(modal);

      // Mode toggling
      const btnModeSaved = document.getElementById('jp-btn-mode-saved');
      const btnModeUpload = document.getElementById('jp-btn-mode-upload');
      const panelSaved = document.getElementById('jp-panel-saved');
      const panelUpload = document.getElementById('jp-panel-upload');
      const fileInput = document.getElementById('jp-file-input');
      const dropzone = document.getElementById('jp-dropzone');
      const selectedChip = document.getElementById('jp-selected-chip');
      const chipBadge = document.getElementById('jp-chip-badge');
      const chipName = document.getElementById('jp-chip-name');
      const chipSize = document.getElementById('jp-chip-size');
      const chipRemove = document.getElementById('jp-chip-remove');

      btnModeSaved.onclick = () => {
        activeMode = 'saved';
        btnModeSaved.classList.add('active');
        btnModeUpload.classList.remove('active');
        panelSaved.style.display = 'block';
        panelUpload.style.display = 'none';
      };

      btnModeUpload.onclick = () => {
        activeMode = 'upload';
        btnModeUpload.classList.add('active');
        btnModeSaved.classList.remove('active');
        panelUpload.style.display = 'block';
        panelSaved.style.display = 'none';
      };

      dropzone.onclick = () => fileInput.click();

      fileInput.onchange = (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const ext = file.name.split('.').pop().toUpperCase();
        chipBadge.textContent = ext.length <= 4 ? ext : 'DOC';
        chipName.textContent = file.name;
        chipSize.textContent = StorageService.formatFileSize(file.size);

        const reader = new FileReader();
        reader.onload = (evt) => {
          uploadedResumeData = {
            name: file.name,
            originalFileName: file.name,
            fileType: file.type || 'application/octet-stream',
            fileSize: file.size,
            dataUrl: evt.target.result
          };
          dropzone.style.display = 'none';
          selectedChip.style.display = 'flex';
        };
        reader.readAsDataURL(file);
      };

      chipRemove.onclick = (e) => {
        e.stopPropagation();
        uploadedResumeData = null;
        fileInput.value = '';
        selectedChip.style.display = 'none';
        dropzone.style.display = 'block';
      };

      // Event handlers
      document.getElementById('jp-modal-close').onclick = () => modal.remove();
      document.getElementById('jp-btn-dashboard').onclick = () => {
        chrome.runtime.sendMessage({ action: 'OPEN_DASHBOARD' });
        modal.remove();
      };

      document.getElementById('jp-btn-submit').onclick = async () => {
        const title = document.getElementById('jp-input-title').value.trim();
        const company = document.getElementById('jp-input-company').value.trim();
        const status = document.getElementById('jp-select-status').value;

        if (!title || !company) {
          alert('Please enter both Job Title and Company.');
          return;
        }

        let resumeId = '';
        let resumeName = '';
        let resumeHasFile = false;

        if (activeMode === 'upload') {
          if (!uploadedResumeData) {
            alert('Please choose a resume file to upload, or switch to "Saved".');
            return;
          }
          resumeName = uploadedResumeData.name;
          resumeHasFile = true;
        } else {
          resumeId = document.getElementById('jp-select-resume').value;
          const matched = resumes.find(r => r.id === resumeId);
          resumeName = matched ? matched.name : 'Default Resume';
          resumeHasFile = matched ? !!matched.hasFile : false;
        }

        const now = new Date().toISOString();
        const newApp = {
          title: title,
          company: company,
          location: job.location || '',
          url: window.location.href,
          platform: job.platform,
          resumeId: resumeId,
          resumeName: resumeName,
          resumeHasFile: resumeHasFile,
          uploadedResume: uploadedResumeData,
          status: status,
          appliedAt: now,
          salary: '',
          notes: 'Added via in-page quick tracker',
          jobDescription: job.jobDescription || '',
          timeline: [
            { status: status, date: now, note: `Saved via Quick Tracker (${resumeName})` }
          ]
        };

        const submitBtn = document.getElementById('jp-btn-submit');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';

        try {
          await StorageService.saveJob(newApp);
          modal.remove();
          showSuccessToast(`Saved "${title}" at ${company} & resume stored locally!`);
          chrome.runtime.sendMessage({ action: 'UPDATE_BADGE' });
        } catch (err) {
          console.error('Save error:', err);
          submitBtn.disabled = false;
          submitBtn.textContent = 'Save Application';
          alert('Failed to save application');
        }
      };
    });
  }

  function showSuccessToast(message) {
    const toast = document.createElement('div');
    toast.className = 'jp-toast-success';
    toast.innerHTML = `✓ ${escapeHtml(message)}`;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3500);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Observe URL changes for Single Page Apps (like LinkedIn, Indeed)
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      setTimeout(initFloatingTracker, 1200);
    }
  }).observe(document, { subtree: true, childList: true });

  // Initial trigger
  setTimeout(initFloatingTracker, 1500);
})();
