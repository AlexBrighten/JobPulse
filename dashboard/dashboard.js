// dashboard/dashboard.js - Application and Resume Analytics Controller

document.addEventListener('DOMContentLoaded', async () => {
  // State
  let applications = [];
  let resumes = [];
  let currentTab = 'overview';
  let viewMode = 'kanban'; // 'kanban' or 'table'
  let searchQuery = '';
  let filterStatus = 'all';
  let filterResume = 'all';

  // DOM Elements - Navigation & Topbar
  const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const pageTitle = document.getElementById('page-title');
  const pageSubtitle = document.getElementById('page-subtitle');
  const btnAddJobMain = document.getElementById('btn-add-job-main');
  const btnDataMenu = document.getElementById('btn-data-menu');
  const dataDropdown = document.getElementById('data-dropdown');
  const btnExportCsv = document.getElementById('btn-export-csv');
  const btnExportJson = document.getElementById('btn-export-json');
  const fileImportJson = document.getElementById('file-import-json');
  const btnClearAll = document.getElementById('btn-clear-all');
  const btnLoadDemo = document.getElementById('btn-load-demo');
  const toast = document.getElementById('toast');

  // DOM Elements - Overview Tab
  const kpiTotalApplied = document.getElementById('kpi-total-applied');
  const kpiTotalReplies = document.getElementById('kpi-total-replies');
  const kpiResponseRate = document.getElementById('kpi-response-rate');
  const kpiInterviews = document.getElementById('kpi-interviews');
  const kpiOffers = document.getElementById('kpi-offers');
  const statusDonutChart = document.getElementById('status-donut-chart');
  const statusLegend = document.getElementById('status-legend');
  const resumeSnapshotChart = document.getElementById('resume-snapshot-chart');
  const recentAppsTbody = document.getElementById('recent-apps-tbody');
  const btnViewAllApps = document.getElementById('btn-view-all-apps');

  // DOM Elements - Applications Tab
  const appSearchInput = document.getElementById('app-search-input');
  const filterStatusSelect = document.getElementById('filter-status-select');
  const filterResumeSelect = document.getElementById('filter-resume-select');
  const viewToggleKanban = document.getElementById('view-toggle-kanban');
  const viewToggleTable = document.getElementById('view-toggle-table');
  const kanbanView = document.getElementById('kanban-view');
  const tableView = document.getElementById('table-view');
  const allAppsTbody = document.getElementById('all-apps-tbody');

  // DOM Elements - Resumes Tab
  const btnAddResumeMatrix = document.getElementById('btn-add-resume-matrix');
  const resumeCardsGrid = document.getElementById('resume-cards-grid');
  const resumeMatrixTbody = document.getElementById('resume-matrix-tbody');

  // DOM Elements - Modals
  const jobModal = document.getElementById('job-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnCancelModal = document.getElementById('btn-cancel-modal');
  const modalJobForm = document.getElementById('modal-job-form');
  const modalHeading = document.getElementById('modal-heading');
  const modalJobId = document.getElementById('modal-job-id');
  const modalJobTitle = document.getElementById('modal-job-title');
  const modalJobCompany = document.getElementById('modal-job-company');
  const modalJobLocation = document.getElementById('modal-job-location');
  const modalJobPlatform = document.getElementById('modal-job-platform');
  const modalJobResume = document.getElementById('modal-job-resume');
  const modalJobStatus = document.getElementById('modal-job-status');
  const modalJobDatetime = document.getElementById('modal-job-datetime');
  const modalJobSalary = document.getElementById('modal-job-salary');
  const modalJobUrl = document.getElementById('modal-job-url');
  const modalJobFollowup = document.getElementById('modal-job-followup');
  const modalJobContactName = document.getElementById('modal-job-contact-name');
  const modalJobContactEmail = document.getElementById('modal-job-contact-email');
  const modalJobNotes = document.getElementById('modal-job-notes');
  const modalTimelineSection = document.getElementById('modal-timeline-section');
  const modalTimelineList = document.getElementById('modal-timeline-list');
  const btnDeleteJob = document.getElementById('btn-delete-job');

  const resumeModal = document.getElementById('resume-modal');
  const btnCloseResumeModal = document.getElementById('btn-close-resume-modal');
  const btnCancelResumeModal = document.getElementById('btn-cancel-resume-modal');
  const formAddResume = document.getElementById('form-add-resume');
  const inputResumeName = document.getElementById('input-resume-name');
  const checkResumeDefault = document.getElementById('check-resume-default');

  // 1. Initial Load
  await refreshData();

  // 2. Tab Navigation
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tab = item.getAttribute('data-tab');
      switchTab(tab);
    });
  });

  btnViewAllApps.addEventListener('click', () => switchTab('applications'));

  function switchTab(tabId) {
    currentTab = tabId;
    navItems.forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId));
    tabPanes.forEach(pane => pane.classList.toggle('active', pane.id === `tab-${tabId}`));

    if (tabId === 'overview') {
      pageTitle.textContent = 'Application Analytics';
      pageSubtitle.textContent = 'Track your career search pipeline and resume conversion rates';
      renderOverviewTab();
    } else if (tabId === 'applications') {
      pageTitle.textContent = 'Job Applications Pipeline';
      pageSubtitle.textContent = 'Manage every role you applied for across all job boards';
      renderApplicationsTab();
    } else if (tabId === 'resumes') {
      pageTitle.textContent = 'Resume Performance Matrix';
      pageSubtitle.textContent = 'A/B test different resume versions to maximize interview callbacks';
      renderResumesTab();
    }
  }

  // 3. View Mode Toggle (Kanban / Table)
  viewToggleKanban.addEventListener('click', () => {
    viewMode = 'kanban';
    viewToggleKanban.classList.add('active');
    viewToggleTable.classList.remove('active');
    kanbanView.classList.remove('hidden');
    tableView.classList.add('hidden');
    renderApplicationsTab();
  });

  viewToggleTable.addEventListener('click', () => {
    viewMode = 'table';
    viewToggleTable.classList.add('active');
    viewToggleKanban.classList.remove('active');
    tableView.classList.remove('hidden');
    kanbanView.classList.add('hidden');
    renderApplicationsTab();
  });

  // 4. Data Refresh & Synchronization
  async function refreshData() {
    applications = await StorageService.getJobs();
    resumes = await StorageService.getResumes();

    populateFilterResumes();
    renderOverviewTab();
    renderApplicationsTab();
    renderResumesTab();
  }

  function populateFilterResumes() {
    const resumeOptions = resumes.map(r => `<option value="${escapeHtml(r.name)}">${escapeHtml(r.name)}</option>`).join('');
    filterResumeSelect.innerHTML = `<option value="all">All Resumes</option>` + resumeOptions;

    // Also populate modal resume select
    modalJobResume.innerHTML = resumes.map(r => `<option value="${escapeHtml(r.name)}">${escapeHtml(r.name)} ${r.isDefault ? '(Default)' : ''}</option>`).join('');
  }

  // 5. Render Overview Tab
  function renderOverviewTab() {
    const total = applications.length;
    const replies = applications.filter(j => ['screening', 'interviewing', 'offer'].includes(j.status)).length;
    const interviews = applications.filter(j => j.status === 'interviewing').length;
    const offers = applications.filter(j => j.status === 'offer').length;
    const rate = total > 0 ? Math.round((replies / total) * 100) : 0;

    kpiTotalApplied.textContent = total;
    kpiTotalReplies.textContent = replies;
    kpiResponseRate.textContent = `${rate}%`;
    kpiInterviews.textContent = interviews;
    kpiOffers.textContent = offers;

    renderStatusDonutChart();
    renderResumeSnapshotChart();
    renderRecentAppsTable();
  }

  // Render SVG Donut Chart for Statuses
  function renderStatusDonutChart() {
    const statusCounts = {
      applied: 0,
      screening: 0,
      interviewing: 0,
      offer: 0,
      rejected: 0,
      ghosted: 0,
      wishlist: 0
    };

    applications.forEach(j => {
      const s = j.status || 'applied';
      if (statusCounts[s] !== undefined) statusCounts[s]++;
      else statusCounts.applied++;
    });

    const total = applications.length;
    const colorMap = {
      applied: '#6366f1',
      screening: '#38bdf8',
      interviewing: '#a855f7',
      offer: '#10b981',
      rejected: '#f43f5e',
      ghosted: '#64748b',
      wishlist: '#94a3b8'
    };

    if (total === 0) {
      statusDonutChart.innerHTML = `
        <svg viewBox="0 0 100 100" width="140" height="140">
          <circle cx="50" cy="50" r="38" fill="none" stroke="#1e293b" stroke-width="14" />
          <text x="50" y="55" text-anchor="middle" fill="#64748b" font-size="12" font-weight="600">No Data</text>
        </svg>
      `;
      statusLegend.innerHTML = '<span style="color: #64748b; font-size: 12px;">No applications added yet.</span>';
      return;
    }

    // SVG Donut calculation
    const radius = 38;
    const circumference = 2 * Math.PI * radius;
    let accumulatedOffset = 0;
    let svgCircles = '';
    let legendHtml = '';

    const statusesOrder = ['applied', 'screening', 'interviewing', 'offer', 'rejected', 'ghosted', 'wishlist'];

    statusesOrder.forEach(key => {
      const count = statusCounts[key];
      if (count > 0) {
        const percent = count / total;
        const strokeDasharray = `${percent * circumference} ${circumference}`;
        const strokeDashoffset = -accumulatedOffset;
        accumulatedOffset += percent * circumference;

        svgCircles += `
          <circle cx="50" cy="50" r="${radius}" fill="none" stroke="${colorMap[key]}" stroke-width="14"
            stroke-dasharray="${strokeDasharray}" stroke-dashoffset="${strokeDashoffset}"
            transform="rotate(-90 50 50)" style="transition: stroke-dasharray 0.5s ease;" />
        `;

        legendHtml += `
          <div class="legend-item">
            <div class="legend-left">
              <span class="legend-dot" style="background-color: ${colorMap[key]}"></span>
              <span style="text-transform: capitalize;">${key}</span>
            </div>
            <span class="legend-count">${count} (${Math.round(percent * 100)}%)</span>
          </div>
        `;
      }
    });

    statusDonutChart.innerHTML = `
      <svg viewBox="0 0 100 100" width="140" height="140">
        <circle cx="50" cy="50" r="${radius}" fill="none" stroke="#1e293b" stroke-width="14" />
        ${svgCircles}
        <text x="50" y="47" text-anchor="middle" fill="#ffffff" font-size="16" font-weight="700">${total}</text>
        <text x="50" y="60" text-anchor="middle" fill="#94a3b8" font-size="8" font-weight="600" text-transform="uppercase">TOTAL</text>
      </svg>
    `;
    statusLegend.innerHTML = legendHtml;
  }

  // Render Top Resumes Bar Snapshot
  function renderResumeSnapshotChart() {
    if (resumes.length === 0 || applications.length === 0) {
      resumeSnapshotChart.innerHTML = '<div style="color:#64748b; text-align:center; padding: 20px;">No resume data yet.</div>';
      return;
    }

    const stats = calculateResumeStats();

    let html = '';
    stats.slice(0, 4).forEach(item => {
      const rate = item.total > 0 ? Math.round((item.replies / item.total) * 100) : 0;
      html += `
        <div class="resume-bar-row">
          <div class="resume-bar-header">
            <span class="resume-bar-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
            <span class="resume-bar-stats">${item.replies} replies / ${item.total} apps (${rate}%)</span>
          </div>
          <div class="resume-progress-track">
            <div class="resume-progress-fill" style="width: ${rate}%;"></div>
          </div>
        </div>
      `;
    });

    resumeSnapshotChart.innerHTML = html;
  }

  // Render Recent Applications Table (first 5)
  function renderRecentAppsTable() {
    const recent = applications.slice(0, 5);
    if (recent.length === 0) {
      recentAppsTbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: #64748b; padding: 28px;">
            No applications logged yet. Click "Add Application" or "Load Demo Data" to get started!
          </td>
        </tr>
      `;
      return;
    }

    recentAppsTbody.innerHTML = recent.map(job => `
      <tr>
        <td>
          <div class="td-job-info">
            <span class="job-title-strong">${escapeHtml(job.title)}</span>
            <span class="job-company-sub">${escapeHtml(job.company)} ${job.location ? '• ' + escapeHtml(job.location) : ''}</span>
          </div>
        </td>
        <td>
          <span class="badge-resume" title="${escapeHtml(job.resumeName)}">${escapeHtml(job.resumeName)}</span>
        </td>
        <td>
          <span class="badge-platform">${escapeHtml(job.platform || 'Direct')}</span>
        </td>
        <td>${formatDateTime(job.appliedAt)}</td>
        <td>
          <span class="badge-status status-${job.status}">${escapeHtml(job.status)}</span>
        </td>
        <td>
          <button class="btn-action-icon btn-edit-job" data-id="${job.id}" title="Edit / View Details">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
        </td>
      </tr>
    `).join('');

    bindTableActionEvents(recentAppsTbody);
  }

  // 6. Render Applications Tab (Kanban & Table)
  function renderApplicationsTab() {
    const filtered = getFilteredApplications();

    if (viewMode === 'kanban') {
      renderKanbanBoard(filtered);
    } else {
      renderFullTableView(filtered);
    }
  }

  function getFilteredApplications() {
    return applications.filter(job => {
      // Search
      const searchMatch = !searchQuery ||
        job.title.toLowerCase().includes(searchQuery) ||
        job.company.toLowerCase().includes(searchQuery) ||
        (job.notes && job.notes.toLowerCase().includes(searchQuery));

      // Status filter
      const statusMatch = filterStatus === 'all' || job.status === filterStatus;

      // Resume filter
      const resumeMatch = filterResume === 'all' || job.resumeName === filterResume;

      return searchMatch && statusMatch && resumeMatch;
    });
  }

  // Render Kanban Board
  function renderKanbanBoard(jobsList) {
    const columns = [
      { id: 'wishlist', title: 'Wishlist / Target', icon: '📌', color: '#94a3b8' },
      { id: 'applied', title: 'Applied', icon: '🚀', color: '#6366f1' },
      { id: 'screening', title: 'Screening', icon: '📞', color: '#38bdf8' },
      { id: 'interviewing', title: 'Interviewing', icon: '💼', color: '#a855f7' },
      { id: 'offer', title: 'Offer Received', icon: '🎉', color: '#10b981' },
      { id: 'rejected', title: 'Rejected / Ghosted', icon: '❌', color: '#f43f5e' }
    ];

    kanbanView.innerHTML = columns.map(col => {
      // In rejected column, include both 'rejected' and 'ghosted'
      const colJobs = jobsList.filter(j => col.id === 'rejected' ? (j.status === 'rejected' || j.status === 'ghosted') : (j.status === col.id));

      const cardsHtml = colJobs.map(job => `
        <div class="kanban-card" data-id="${job.id}" draggable="true">
          <div class="kanban-card-top">
            <div>
              <div class="k-card-title">${escapeHtml(job.title)}</div>
              <div class="k-card-company">${escapeHtml(job.company)}</div>
            </div>
            <span class="badge-status status-${job.status}" style="font-size: 10px;">${escapeHtml(job.status)}</span>
          </div>

          <div class="k-card-tags">
            <span class="badge-resume" title="${escapeHtml(job.resumeName)}">${escapeHtml(job.resumeName)}</span>
            <span class="badge-platform">${escapeHtml(job.platform || 'Direct')}</span>
          </div>

          <div class="k-card-footer">
            <span>${formatDateTime(job.appliedAt)}</span>
            ${job.salary ? `<span class="k-card-salary">${escapeHtml(job.salary)}</span>` : ''}
          </div>
        </div>
      `).join('');

      return `
        <div class="kanban-col" data-col-id="${col.id}">
          <div class="kanban-col-header">
            <div class="col-header-left">
              <span>${col.icon}</span>
              <span>${col.title}</span>
            </div>
            <span class="col-count-pill">${colJobs.length}</span>
          </div>
          <div class="kanban-cards-list" data-status="${col.id}">
            ${cardsHtml.length > 0 ? cardsHtml : '<div style="color: #475569; font-size: 12px; text-align: center; padding: 20px;">No cards</div>'}
          </div>
        </div>
      `;
    }).join('');

    // Attach card click & drag-and-drop events
    initKanbanDragAndDrop();
  }

  function initKanbanDragAndDrop() {
    const cards = kanbanView.querySelectorAll('.kanban-card');
    const dropZones = kanbanView.querySelectorAll('.kanban-cards-list');

    cards.forEach(card => {
      card.addEventListener('click', (e) => {
        // Prevent click if dragging
        const id = card.getAttribute('data-id');
        openJobModal(id);
      });

      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', card.getAttribute('data-id'));
        card.style.opacity = '0.5';
      });

      card.addEventListener('dragend', () => {
        card.style.opacity = '1';
      });
    });

    dropZones.forEach(zone => {
      zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.style.background = 'rgba(99, 102, 241, 0.1)';
      });

      zone.addEventListener('dragleave', () => {
        zone.style.background = 'transparent';
      });

      zone.addEventListener('drop', async (e) => {
        e.preventDefault();
        zone.style.background = 'transparent';
        const jobId = e.dataTransfer.getData('text/plain');
        const targetStatus = zone.getAttribute('data-status');

        if (jobId && targetStatus) {
          await StorageService.updateJobStatus(jobId, targetStatus, `Moved to ${targetStatus} via Kanban board`);
          showToast(`Status updated to ${targetStatus}!`);
          await refreshData();
        }
      });
    });
  }

  // Render Full Table View
  function renderFullTableView(jobsList) {
    if (jobsList.length === 0) {
      allAppsTbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: #64748b; padding: 32px;">
            No applications match your filter.
          </td>
        </tr>
      `;
      return;
    }

    allAppsTbody.innerHTML = jobsList.map(job => `
      <tr>
        <td>
          <div class="td-job-info">
            <span class="job-title-strong">${escapeHtml(job.title)}</span>
            <span class="job-company-sub">${escapeHtml(job.company)} ${job.location ? '• ' + escapeHtml(job.location) : ''}</span>
          </div>
        </td>
        <td>
          <span class="badge-resume" title="${escapeHtml(job.resumeName)}">${escapeHtml(job.resumeName)}</span>
        </td>
        <td>
          <span class="badge-platform">${escapeHtml(job.platform || 'Direct')}</span>
        </td>
        <td>${formatDateTime(job.appliedAt)}</td>
        <td>
          <select class="form-select inline-status-select" data-id="${job.id}" style="padding: 3px 6px; font-size: 11px; width: auto;">
            <option value="wishlist" ${job.status === 'wishlist' ? 'selected' : ''}>Wishlist</option>
            <option value="applied" ${job.status === 'applied' ? 'selected' : ''}>Applied</option>
            <option value="screening" ${job.status === 'screening' ? 'selected' : ''}>Screening</option>
            <option value="interviewing" ${job.status === 'interviewing' ? 'selected' : ''}>Interviewing</option>
            <option value="offer" ${job.status === 'offer' ? 'selected' : ''}>Offer</option>
            <option value="rejected" ${job.status === 'rejected' ? 'selected' : ''}>Rejected</option>
            <option value="ghosted" ${job.status === 'ghosted' ? 'selected' : ''}>Ghosted</option>
          </select>
        </td>
        <td>${escapeHtml(job.salary || '—')}</td>
        <td>
          <div style="display: flex; gap: 6px;">
            <button class="btn-action-icon btn-edit-job" data-id="${job.id}" title="Edit / View Details">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            ${job.url ? `
              <a href="${escapeHtml(job.url)}" target="_blank" class="btn-action-icon" title="Open Job Posting">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
              </a>
            ` : ''}
          </div>
        </td>
      </tr>
    `).join('');

    // Attach inline status change listeners
    allAppsTbody.querySelectorAll('.inline-status-select').forEach(sel => {
      sel.addEventListener('change', async (e) => {
        const jobId = sel.getAttribute('data-id');
        const newStatus = sel.value;
        await StorageService.updateJobStatus(jobId, newStatus);
        showToast('Status updated!');
        await refreshData();
      });
    });

    bindTableActionEvents(allAppsTbody);
  }

  function bindTableActionEvents(container) {
    container.querySelectorAll('.btn-edit-job').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.getAttribute('data-id');
        openJobModal(id);
      });
    });
  }

  // Search & Filter event listeners
  appSearchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    renderApplicationsTab();
  });

  filterStatusSelect.addEventListener('change', (e) => {
    filterStatus = e.target.value;
    renderApplicationsTab();
  });

  filterResumeSelect.addEventListener('change', (e) => {
    filterResume = e.target.value;
    renderApplicationsTab();
  });

  // 7. Render Resumes Tab
  function renderResumesTab() {
    const stats = calculateResumeStats();

    // Render Cards
    resumeCardsGrid.innerHTML = stats.map((item, index) => {
      const isTop = index === 0 && item.total >= 2 && item.rate > 0;
      return `
        <div class="resume-stat-card ${isTop ? 'top-performer' : ''}">
          ${isTop ? '<span class="top-badge">🏆 Highest Callback</span>' : ''}
          <div>
            <span class="resume-card-name">${escapeHtml(item.name)}</span>
            <span style="font-size: 11px; color: #94a3b8; display: block; margin-top: 2px;">
              ${item.isDefault ? '⭐ Default Resume Profile' : 'Custom Variant'}
            </span>
          </div>

          <div class="resume-card-metrics">
            <div class="rc-metric-box">
              <span class="rc-metric-lbl">Total Applied</span>
              <span class="rc-metric-val">${item.total}</span>
            </div>
            <div class="rc-metric-box">
              <span class="rc-metric-lbl">Response Rate</span>
              <span class="rc-metric-val ${item.rate > 20 ? 'text-emerald' : 'text-violet'}">${item.rate}%</span>
            </div>
          </div>

          <div class="resume-card-footer">
            <span style="font-size: 11.5px; color: #94a3b8;">${item.replies} callbacks (${item.offers} offers)</span>
            ${!item.isDefault ? `
              <button class="btn-ghost-sm btn-set-default" data-id="${item.id}">Set Default</button>
            ` : '<span style="font-size: 11px; color: #818cf8; font-weight: 600;">Active Default</span>'}
          </div>
        </div>
      `;
    }).join('');

    // Attach Set Default handlers
    resumeCardsGrid.querySelectorAll('.btn-set-default').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        await StorageService.setDefaultResume(id);
        showToast('Default resume updated!');
        await refreshData();
      });
    });

    // Render Breakdown Table
    resumeMatrixTbody.innerHTML = stats.map(item => `
      <tr>
        <td><strong>${escapeHtml(item.name)}</strong></td>
        <td>${item.total}</td>
        <td><span class="text-emerald font-bold">${item.replies}</span></td>
        <td><span class="text-danger">${item.rejected}</span></td>
        <td><span class="text-amber">${item.offers}</span></td>
        <td><strong style="color: ${item.rate >= 20 ? '#34d399' : '#a78bfa'};">${item.rate}%</strong></td>
        <td>${item.isDefault ? '<span class="badge-status status-applied">Default</span>' : '<span style="color:#64748b; font-size:11px;">Alternative</span>'}</td>
      </tr>
    `).join('');
  }

  function calculateResumeStats() {
    return resumes.map(res => {
      const sent = applications.filter(j => j.resumeName === res.name);
      const total = sent.length;
      const replies = sent.filter(j => ['screening', 'interviewing', 'offer'].includes(j.status)).length;
      const offers = sent.filter(j => j.status === 'offer').length;
      const rejected = sent.filter(j => j.status === 'rejected').length;
      const rate = total > 0 ? Math.round((replies / total) * 100) : 0;

      return {
        id: res.id,
        name: res.name,
        isDefault: !!res.isDefault,
        total,
        replies,
        offers,
        rejected,
        rate
      };
    }).sort((a, b) => b.rate - a.rate || b.total - a.total);
  }

  // 8. Application Detail / Edit Modal
  btnAddJobMain.addEventListener('click', () => openJobModal());

  function openJobModal(jobId = null) {
    if (jobId) {
      const job = applications.find(j => j.id === jobId);
      if (!job) return;

      modalHeading.textContent = `Edit Application: ${job.company}`;
      modalJobId.value = job.id;
      modalJobTitle.value = job.title;
      modalJobCompany.value = job.company;
      modalJobLocation.value = job.location || '';
      modalJobPlatform.value = job.platform || '';
      modalJobResume.value = job.resumeName;
      modalJobStatus.value = job.status;
      modalJobDatetime.value = toLocalISO(job.appliedAt);
      modalJobSalary.value = job.salary || '';
      modalJobUrl.value = job.url || '';
      modalJobFollowup.value = job.followUpDate || '';
      modalJobContactName.value = job.contactName || '';
      modalJobContactEmail.value = job.contactEmail || '';
      modalJobNotes.value = job.notes || '';

      btnDeleteJob.classList.remove('hidden');

      // Timeline entries
      modalTimelineSection.classList.remove('hidden');
      const timeline = job.timeline || [];
      modalTimelineList.innerHTML = timeline.map(t => `
        <div class="timeline-entry">
          <span><strong>${escapeHtml(t.status)}</strong>: ${escapeHtml(t.note || '')}</span>
          <span style="color: #64748b;">${formatDateTime(t.date)}</span>
        </div>
      `).join('') || '<div style="color: #64748b;">No timeline entries recorded yet.</div>';

    } else {
      modalHeading.textContent = 'Add New Job Application';
      modalJobId.value = '';
      modalJobTitle.value = '';
      modalJobCompany.value = '';
      modalJobLocation.value = '';
      modalJobPlatform.value = 'LinkedIn';
      modalJobStatus.value = 'applied';
      modalJobDatetime.value = toLocalISO(new Date().toISOString());
      modalJobSalary.value = '';
      modalJobUrl.value = '';
      modalJobFollowup.value = '';
      modalJobContactName.value = '';
      modalJobContactEmail.value = '';
      modalJobNotes.value = '';

      btnDeleteJob.classList.add('hidden');
      modalTimelineSection.classList.add('hidden');
    }

    jobModal.classList.remove('hidden');
  }

  btnCloseModal.addEventListener('click', () => jobModal.classList.add('hidden'));
  btnCancelModal.addEventListener('click', () => jobModal.classList.add('hidden'));

  modalJobForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = modalJobId.value;
    const existing = id ? applications.find(j => j.id === id) : null;

    const jobData = {
      id: id || undefined,
      title: modalJobTitle.value.trim(),
      company: modalJobCompany.value.trim(),
      location: modalJobLocation.value.trim(),
      platform: modalJobPlatform.value.trim(),
      resumeName: modalJobResume.value,
      status: modalJobStatus.value,
      appliedAt: new Date(modalJobDatetime.value).toISOString(),
      salary: modalJobSalary.value.trim(),
      url: modalJobUrl.value.trim(),
      followUpDate: modalJobFollowup.value,
      contactName: modalJobContactName.value.trim(),
      contactEmail: modalJobContactEmail.value.trim(),
      notes: modalJobNotes.value.trim(),
      timeline: existing ? existing.timeline : undefined
    };

    if (existing && existing.status !== jobData.status) {
      if (!jobData.timeline) jobData.timeline = [];
      jobData.timeline.push({
        status: jobData.status,
        date: new Date().toISOString(),
        note: `Status changed from ${existing.status} to ${jobData.status}`
      });
    }

    await StorageService.saveJob(jobData);
    jobModal.classList.add('hidden');
    showToast(id ? 'Application updated!' : 'New application tracked!');
    await refreshData();
  });

  btnDeleteJob.addEventListener('click', async () => {
    const id = modalJobId.value;
    if (!id) return;
    if (confirm('Are you sure you want to delete this job application?')) {
      await StorageService.deleteJob(id);
      jobModal.classList.add('hidden');
      showToast('Application deleted.');
      await refreshData();
    }
  });

  // 9. Add Resume Modal
  btnAddResumeMatrix.addEventListener('click', () => {
    inputResumeName.value = '';
    checkResumeDefault.checked = false;
    resumeModal.classList.remove('hidden');
  });

  btnCloseResumeModal.addEventListener('click', () => resumeModal.classList.add('hidden'));
  btnCancelResumeModal.addEventListener('click', () => resumeModal.classList.add('hidden'));

  formAddResume.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = inputResumeName.value.trim();
    const isDefault = checkResumeDefault.checked;
    if (!name) return;

    await StorageService.addResume(name, isDefault);
    resumeModal.classList.add('hidden');
    showToast(`Added resume "${name}"!`);
    await refreshData();
  });

  // 10. Data Import / Export & Sample Generator
  btnDataMenu.addEventListener('click', () => {
    dataDropdown.classList.toggle('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!btnDataMenu.contains(e.target) && !dataDropdown.contains(e.target)) {
      dataDropdown.classList.add('hidden');
    }
  });

  btnExportCsv.addEventListener('click', () => {
    exportToCsv();
    dataDropdown.classList.add('hidden');
  });

  btnExportJson.addEventListener('click', async () => {
    const data = await StorageService.exportData();
    downloadBlob(JSON.stringify(data, null, 2), `jobpulse_backup_${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
    dataDropdown.classList.add('hidden');
    showToast('Exported JSON backup!');
  });

  fileImportJson.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const imported = JSON.parse(text);
      await StorageService.importData(imported);
      showToast('Data imported successfully!');
      await refreshData();
    } catch (err) {
      alert('Error importing file: ' + err.message);
    }
    dataDropdown.classList.add('hidden');
    fileImportJson.value = '';
  });

  btnClearAll.addEventListener('click', async () => {
    dataDropdown.classList.add('hidden');
    if (confirm('Warning: This will erase all tracked applications and reset resumes. Are you sure?')) {
      await StorageService.set('jobpulse_applications', []);
      showToast('All data erased.');
      await refreshData();
    }
  });

  btnLoadDemo.addEventListener('click', async () => {
    if (applications.length > 0) {
      if (!confirm('This will replace your current data with 8 realistic demo job applications across various stages (Interviewing, Offers, Screenings). Continue?')) {
        return;
      }
    }
    await StorageService.loadSampleData();
    showToast('✨ Loaded 8 realistic demo applications!');
    await refreshData();
  });

  function exportToCsv() {
    if (applications.length === 0) {
      showToast('No applications to export', 'error');
      return;
    }

    const headers = ['Title', 'Company', 'Location', 'Platform', 'Resume Used', 'Status', 'Applied At', 'Salary', 'URL', 'Contact Name', 'Contact Email', 'Notes'];
    const rows = applications.map(j => [
      escapeCsv(j.title),
      escapeCsv(j.company),
      escapeCsv(j.location),
      escapeCsv(j.platform),
      escapeCsv(j.resumeName),
      escapeCsv(j.status),
      escapeCsv(j.appliedAt),
      escapeCsv(j.salary),
      escapeCsv(j.url),
      escapeCsv(j.contactName),
      escapeCsv(j.contactEmail),
      escapeCsv(j.notes)
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    downloadBlob(csvContent, `jobpulse_applications_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8;');
    showToast('CSV downloaded successfully!');
  }

  function escapeCsv(val) {
    if (!val) return '""';
    return `"${String(val).replace(/"/g, '""')}"`;
  }

  function downloadBlob(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // 11. Utilities
  function formatDateTime(isoString) {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return isoString;
    }
  }

  function toLocalISO(isoString) {
    try {
      const d = new Date(isoString);
      const tzOffset = d.getTimezoneOffset() * 60000;
      return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
    } catch (e) {
      return '';
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function showToast(msg, type = 'success') {
    toast.textContent = msg;
    toast.style.background = type === 'error' ? '#991b1b' : '#065f46';
    toast.style.borderColor = type === 'error' ? '#ef4444' : '#10b981';
    toast.classList.remove('hidden');

    setTimeout(() => {
      toast.classList.add('hidden');
    }, 3000);
  }
});
