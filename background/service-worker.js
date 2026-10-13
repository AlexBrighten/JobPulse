// background/service-worker.js - Extension lifecycle and badge manager

importScripts('../utils/storage.js');

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('JobPulse installed for the first time.');
    // Check if any jobs exist
    const jobs = await StorageService.getJobs();
    if (jobs.length === 0) {
      // Initialize default resumes
      await StorageService.getResumes();
    }
  }
  updateBadge();
});

chrome.runtime.onStartup.addListener(() => {
  updateBadge();
});

async function updateBadge() {
  try {
    const jobs = await StorageService.getJobs();
    const count = jobs.length;
    chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
    chrome.action.setBadgeBackgroundColor({ color: '#6366f1' });
  } catch (err) {
    console.warn('Failed to update badge:', err);
  }
}

// Listen for storage changes to keep badge synced
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes['jobpulse_applications']) {
    const newJobs = changes['jobpulse_applications'].newValue || [];
    chrome.action.setBadgeText({ text: newJobs.length > 0 ? String(newJobs.length) : '' });
    chrome.action.setBadgeBackgroundColor({ color: '#6366f1' });
  }
});

// Message listener for opening dashboard or direct actions
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'OPEN_DASHBOARD') {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html') });
    sendResponse({ success: true });
    return true;
  }

  if (message.action === 'UPDATE_BADGE') {
    updateBadge();
    sendResponse({ success: true });
    return true;
  }
});
