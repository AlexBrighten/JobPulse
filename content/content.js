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
    chrome.storage.local.get(['jobpulse_resumes'], (res) => {
      const resumes = res.jobpulse_resumes || [
        { id: 'res_1', name: 'Software_Engineer_General.pdf', isDefault: true },
        { id: 'res_2', name: 'Frontend_React_Specialist.pdf', isDefault: false },
        { id: 'res_3', name: 'FullStack_Node_TypeScript.pdf', isDefault: false }
      ];

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
          <label class="jp-form-label">Resume Used</label>
          <select class="jp-select" id="jp-select-resume">
            ${resumes.map(r => `<option value="${escapeHtml(r.name)}" ${r.isDefault ? 'selected' : ''}>${escapeHtml(r.name)}</option>`).join('')}
          </select>
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

      // Event handlers
      document.getElementById('jp-modal-close').onclick = () => modal.remove();
      document.getElementById('jp-btn-dashboard').onclick = () => {
        chrome.runtime.sendMessage({ action: 'OPEN_DASHBOARD' });
        modal.remove();
      };

      document.getElementById('jp-btn-submit').onclick = async () => {
        const title = document.getElementById('jp-input-title').value.trim();
        const company = document.getElementById('jp-input-company').value.trim();
        const resumeName = document.getElementById('jp-select-resume').value;
        const status = document.getElementById('jp-select-status').value;

        if (!title || !company) {
          alert('Please enter both Job Title and Company.');
          return;
        }

        const now = new Date().toISOString();
        const newApp = {
          id: 'job_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          title: title,
          company: company,
          location: job.location || '',
          url: window.location.href,
          platform: job.platform,
          resumeName: resumeName,
          status: status,
          appliedAt: now,
          updatedAt: now,
          salary: '',
          notes: 'Added via in-page quick tracker',
          timeline: [
            { status: status, date: now, note: 'Saved via Quick Tracker' }
          ]
        };

        // Retrieve existing and save
        chrome.storage.local.get(['jobpulse_applications'], (result) => {
          const apps = result.jobpulse_applications || [];
          apps.unshift(newApp);
          chrome.storage.local.set({ jobpulse_applications: apps }, () => {
            modal.remove();
            showSuccessToast(`Saved "${title}" at ${company}!`);
            chrome.runtime.sendMessage({ action: 'UPDATE_BADGE' });
          });
        });
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
