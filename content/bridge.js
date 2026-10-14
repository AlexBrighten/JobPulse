// content/bridge.js — Chrome Extension <-> Vercel Hosted Dashboard Live Bridge
// Injected into https://*.vercel.app/* and localhost to provide seamless real-time 2-way sync
// between the local Chrome extension storage and the hosted web dashboard.

(function () {
  'use strict';

  if (window.__JOBPULSE_BRIDGE_INJECTED__) return;
  window.__JOBPULSE_BRIDGE_INJECTED__ = true;

  const EXTENSION_VERSION = '3.0.0';

  // Mark presence in DOM for synchronous checks
  try {
    document.documentElement.setAttribute('data-jobpulse-extension', 'true');
    document.documentElement.setAttribute('data-jobpulse-version', EXTENSION_VERSION);
  } catch (e) {}

  // Announce extension presence to the web page
  function announcePresence() {
    window.postMessage({
      source: 'jobpulse-extension',
      type: 'EXTENSION_DETECTED',
      version: EXTENSION_VERSION,
      timestamp: Date.now()
    }, '*');
  }

  // Periodic announcement on startup to catch page listener attachment
  announcePresence();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', announcePresence);
  }
  setTimeout(announcePresence, 300);
  setTimeout(announcePresence, 1000);

  // Listen for messages dispatched by the Vercel-hosted dashboard
  window.addEventListener('message', async (event) => {
    // Only accept messages explicitly targeted to JobPulse Extension
    if (!event.data || event.data.target !== 'jobpulse-extension') return;

    const { action, requestId, payload } = event.data;

    const reply = (success, data = null, error = null) => {
      window.postMessage({
        source: 'jobpulse-extension',
        target: 'jobpulse-web',
        requestId,
        success,
        data,
        error: error ? (error.message || String(error)) : null
      }, '*');
    };

    try {
      switch (action) {
        case 'PING': {
          reply(true, {
            version: EXTENSION_VERSION,
            isExtension: true,
            storageAvailable: typeof chrome !== 'undefined' && !!(chrome.storage && chrome.storage.local)
          });
          break;
        }

        case 'SET_VERCEL_URL': {
          if (payload && payload.url && typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.set({ jobpulse_vercel_url: payload.url }, () => {
              reply(true, { url: payload.url });
            });
          } else {
            reply(true);
          }
          break;
        }

        case 'GET_ALL_DATA': {
          if (typeof StorageService === 'undefined') {
            return reply(false, null, new Error('StorageService not loaded in extension bridge'));
          }
          const [jobs, resumes, settings] = await Promise.all([
            StorageService.getJobs(),
            StorageService.getResumes(),
            StorageService.getSettings()
          ]);
          reply(true, { jobs, resumes, settings });
          break;
        }

        case 'SAVE_JOB': {
          if (!payload || !payload.job) {
            return reply(false, null, new Error('Missing job payload'));
          }
          const saved = await StorageService.saveJob(payload.job);
          reply(true, saved);
          break;
        }

        case 'UPDATE_JOB_STATUS': {
          if (!payload || !payload.jobId || !payload.status) {
            return reply(false, null, new Error('Missing jobId or status'));
          }
          const updated = await StorageService.updateJobStatus(payload.jobId, payload.status, payload.note || '');
          reply(true, updated);
          break;
        }

        case 'DELETE_JOB': {
          if (!payload || !payload.jobId) {
            return reply(false, null, new Error('Missing jobId'));
          }
          await StorageService.deleteJob(payload.jobId);
          reply(true, { deletedId: payload.jobId });
          break;
        }

        case 'GET_RESUME_FILE': {
          if (!payload || !payload.idOrName) {
            return reply(false, null, new Error('Missing resume identifier'));
          }
          const fileRecord = await StorageService.getResumeFile(payload.idOrName);
          reply(true, fileRecord);
          break;
        }

        case 'SAVE_RESUME': {
          if (!payload || !payload.resume) {
            return reply(false, null, new Error('Missing resume metadata'));
          }
          const res = await StorageService.saveResume(payload.resume, payload.fileData || null);
          reply(true, res);
          break;
        }

        case 'DELETE_RESUME': {
          if (!payload || !payload.resumeId) {
            return reply(false, null, new Error('Missing resumeId'));
          }
          await StorageService.deleteResume(payload.resumeId);
          reply(true, { deletedId: payload.resumeId });
          break;
        }

        case 'CLEAR_ALL_DATA': {
          await StorageService.clearAll();
          reply(true);
          break;
        }

        default: {
          reply(false, null, new Error(`Unknown action: ${action}`));
        }
      }
    } catch (err) {
      console.error('[JobPulse Bridge] Error handling action', action, err);
      reply(false, null, err);
    }
  });

  // Listen to chrome.storage.onChanged and broadcast to the web page in real time
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local') {
        if (changes['jobpulse_applications']) {
          window.postMessage({
            source: 'jobpulse-extension',
            target: 'jobpulse-web',
            type: 'STORAGE_CHANGED',
            key: 'jobpulse_applications',
            newValue: changes['jobpulse_applications'].newValue
          }, '*');
        }
        if (changes['jobpulse_resumes']) {
          window.postMessage({
            source: 'jobpulse-extension',
            target: 'jobpulse-web',
            type: 'STORAGE_CHANGED',
            key: 'jobpulse_resumes',
            newValue: changes['jobpulse_resumes'].newValue
          }, '*');
        }
        if (changes['jobpulse_settings']) {
          window.postMessage({
            source: 'jobpulse-extension',
            target: 'jobpulse-web',
            type: 'STORAGE_CHANGED',
            key: 'jobpulse_settings',
            newValue: changes['jobpulse_settings'].newValue
          }, '*');
        }
      }
    });
  }
})();
