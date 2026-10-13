// utils/storage.js - Unified storage manager with chrome.storage.local, IndexedDB for resume files, and localStorage fallback

function generateSamplePdfDataUrl(title, applicant = 'Candidate') {
  const content = `BT /F1 18 Tf 50 720 Td (${title}) Tj ET\nBT /F1 11 Tf 50 680 Td (Applicant: ${applicant} | Tracked via JobPulse Application Tracker) Tj ET\nBT /F1 10 Tf 50 640 Td (Profile: Highly skilled software engineer with verified technical experience.) Tj ET\nBT /F1 10 Tf 50 610 Td (Core Skills: JavaScript, TypeScript, React, Node.js, Cloud Services, System Design) Tj ET\nBT /F1 10 Tf 50 580 Td (Stored Locally: This resume file is stored 100% locally on your machine.) Tj ET`;
  const streamLen = content.length;
  const pdfStr = `%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n4 0 obj << /Length ${streamLen} >>\nstream\n${content}\nendstream\nendobj\n5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000261 00000 n \n0000000370 00000 n \ntrailer << /Size 6 /Root 1 0 R >>\nstartxref\n450\n%%EOF`;
  return 'data:application/pdf;base64,' + (typeof btoa !== 'undefined' ? btoa(pdfStr) : Buffer.from(pdfStr).toString('base64'));
}

const DEFAULT_RESUMES = [
  {
    id: 'res_1',
    name: 'Software_Engineer_General.pdf',
    originalFileName: 'Software_Engineer_General.pdf',
    fileType: 'application/pdf',
    fileSize: 124500,
    hasFile: true,
    isDefault: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'res_2',
    name: 'Frontend_React_Specialist.pdf',
    originalFileName: 'Frontend_React_Specialist.pdf',
    fileType: 'application/pdf',
    fileSize: 138200,
    hasFile: true,
    isDefault: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'res_3',
    name: 'FullStack_Node_TypeScript.pdf',
    originalFileName: 'FullStack_Node_TypeScript.pdf',
    fileType: 'application/pdf',
    fileSize: 145900,
    hasFile: true,
    isDefault: false,
    createdAt: new Date().toISOString()
  }
];

const STORAGE_KEYS = {
  JOBS: 'jobpulse_applications',
  RESUMES: 'jobpulse_resumes',
  SETTINGS: 'jobpulse_settings'
};

// ---------------- LOCAL RESUME FILE STORE (IndexedDB + Storage Backup) ----------------
const ResumeFileStore = {
  dbName: 'JobPulse_DB',
  dbVersion: 1,
  storeName: 'resume_files',
  _dbPromise: null,

  async getDB() {
    if (typeof indexedDB === 'undefined') return null;
    if (this._dbPromise) return this._dbPromise;

    this._dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(this.dbName, this.dbVersion);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName, { keyPath: 'id' });
          }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => {
          console.warn('IndexedDB open error:', e);
          resolve(null);
        };
      } catch (e) {
        console.warn('IndexedDB unsupported or blocked:', e);
        resolve(null);
      }
    });
    return this._dbPromise;
  },

  async saveFile(fileRecord) {
    if (!fileRecord || !fileRecord.id) return null;

    // 1. Save in IndexedDB (fast, handles large Blobs and DataURLs)
    try {
      const db = await this.getDB();
      if (db) {
        await new Promise((resolve, reject) => {
          const tx = db.transaction(this.storeName, 'readwrite');
          const store = tx.objectStore(this.storeName);
          const req = store.put(fileRecord);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      }
    } catch (err) {
      console.warn('IDB saveFile error:', err);
    }

    // 2. Also mirror to chrome.storage.local or localStorage for redundancy
    const storageKey = 'jobpulse_file_' + fileRecord.id;
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await new Promise((resolve) => {
        chrome.storage.local.set({ [storageKey]: fileRecord }, resolve);
      });
    } else if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(storageKey, JSON.stringify(fileRecord));
      } catch (e) {
        console.warn('LocalStorage save error:', e);
      }
    }

    return fileRecord;
  },

  async getFile(id) {
    if (!id) return null;

    // 1. Try IndexedDB first
    try {
      const db = await this.getDB();
      if (db) {
        const file = await new Promise((resolve) => {
          const tx = db.transaction(this.storeName, 'readonly');
          const store = tx.objectStore(this.storeName);
          const req = store.get(id);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
        });
        if (file && file.dataUrl) return file;
      }
    } catch (err) {
      console.warn('IDB getFile error:', err);
    }

    // 2. Fallback to chrome.storage.local
    const storageKey = 'jobpulse_file_' + id;
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const res = await new Promise((resolve) => {
        chrome.storage.local.get([storageKey], (result) => resolve(result[storageKey] || null));
      });
      if (res && res.dataUrl) return res;
    }

    // 3. Fallback to localStorage
    if (typeof localStorage !== 'undefined') {
      try {
        const item = localStorage.getItem(storageKey);
        if (item) {
          const parsed = JSON.parse(item);
          if (parsed && parsed.dataUrl) return parsed;
        }
      } catch (e) {}
    }

    return null;
  },

  async deleteFile(id) {
    if (!id) return;

    try {
      const db = await this.getDB();
      if (db) {
        await new Promise((resolve) => {
          const tx = db.transaction(this.storeName, 'readwrite');
          const store = tx.objectStore(this.storeName);
          const req = store.delete(id);
          req.onsuccess = () => resolve();
          req.onerror = () => resolve();
        });
      }
    } catch (e) {}

    const storageKey = 'jobpulse_file_' + id;
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await new Promise((resolve) => {
        chrome.storage.local.remove([storageKey], resolve);
      });
    }
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(storageKey);
      } catch (e) {}
    }
  },

  async getAllFiles() {
    try {
      const db = await this.getDB();
      if (db) {
        return new Promise((resolve) => {
          const tx = db.transaction(this.storeName, 'readonly');
          const store = tx.objectStore(this.storeName);
          const req = store.getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
        });
      }
    } catch (e) {}
    return [];
  }
};

const StorageService = {
  fileStore: ResumeFileStore,

  isExtension() {
    return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  },

  async get(key, defaultValue = null) {
    if (this.isExtension()) {
      return new Promise((resolve) => {
        chrome.storage.local.get([key], (result) => {
          if (chrome.runtime.lastError) {
            console.warn('Storage get error:', chrome.runtime.lastError);
            resolve(defaultValue);
          } else {
            resolve(result[key] !== undefined ? result[key] : defaultValue);
          }
        });
      });
    } else if (typeof localStorage !== 'undefined') {
      try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
      } catch (e) {
        console.error('LocalStorage parse error:', e);
        return defaultValue;
      }
    } else {
      return defaultValue;
    }
  },

  async set(key, value) {
    if (this.isExtension()) {
      return new Promise((resolve) => {
        chrome.storage.local.set({ [key]: value }, () => {
          if (chrome.runtime.lastError) {
            console.error('Storage set error:', chrome.runtime.lastError);
          }
          resolve();
        });
      });
    } else if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        console.error('LocalStorage set error:', e);
      }
    }
  },

  // ---------------- APPLICATIONS ----------------
  async getJobs() {
    const jobs = await this.get(STORAGE_KEYS.JOBS, []);
    return Array.isArray(jobs) ? jobs : [];
  },

  async getJobById(id) {
    const jobs = await this.getJobs();
    return jobs.find(j => j.id === id) || null;
  },

  async saveJob(jobData) {
    const jobs = await this.getJobs();
    const resumes = await this.getResumes();
    const now = new Date().toISOString();

    let resumeId = jobData.resumeId || '';
    let resumeName = (jobData.resumeName || '').trim();
    let resumeHasFile = !!jobData.resumeHasFile;

    // Handle uploaded file attached directly when applying!
    if (jobData.uploadedResume && jobData.uploadedResume.dataUrl) {
      const added = await this.addResume(
        jobData.uploadedResume.name || resumeName || 'Uploaded_Resume.pdf',
        !!jobData.uploadedResume.isDefault,
        jobData.uploadedResume
      );
      if (added) {
        resumeId = added.id;
        resumeName = added.name;
        resumeHasFile = true;
      }
    } else if (!resumeId && resumeName) {
      // Find matching resume by name to populate resumeId & resumeHasFile
      const matched = resumes.find(r => r.name.toLowerCase() === resumeName.toLowerCase());
      if (matched) {
        resumeId = matched.id;
        resumeHasFile = !!matched.hasFile;
        matched.lastUsedAt = now;
        await this.set(STORAGE_KEYS.RESUMES, resumes);
      }
    } else if (resumeId) {
      const matched = resumes.find(r => r.id === resumeId);
      if (matched) {
        resumeName = matched.name;
        resumeHasFile = !!matched.hasFile;
        matched.lastUsedAt = now;
        await this.set(STORAGE_KEYS.RESUMES, resumes);
      }
    }

    if (!resumeName) {
      const defaultRes = resumes.find(r => r.isDefault) || resumes[0];
      resumeName = defaultRes ? defaultRes.name : 'Default Resume';
      resumeId = defaultRes ? defaultRes.id : '';
      resumeHasFile = defaultRes ? !!defaultRes.hasFile : false;
    }
    
    const newJob = {
      id: jobData.id || ('job_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)),
      title: (jobData.title || 'Untitled Position').trim(),
      company: (jobData.company || 'Unknown Company').trim(),
      location: (jobData.location || '').trim(),
      url: (jobData.url || '').trim(),
      platform: (jobData.platform || this.detectPlatform(jobData.url)).trim(),
      resumeId: resumeId,
      resumeName: resumeName,
      resumeHasFile: resumeHasFile,
      status: jobData.status || 'applied', // wishlist, applied, screening, interviewing, offer, rejected, ghosted
      appliedAt: jobData.appliedAt || now,
      updatedAt: now,
      salary: (jobData.salary || '').trim(),
      notes: (jobData.notes || '').trim(),
      contactName: (jobData.contactName || '').trim(),
      contactEmail: (jobData.contactEmail || '').trim(),
      followUpDate: jobData.followUpDate || '',
      timeline: jobData.timeline && Array.isArray(jobData.timeline) ? jobData.timeline : [
        {
          status: jobData.status || 'applied',
          date: jobData.appliedAt || now,
          note: 'Application created'
        }
      ]
    };

    const existingIndex = jobs.findIndex(j => j.id === newJob.id);
    if (existingIndex >= 0) {
      jobs[existingIndex] = { ...jobs[existingIndex], ...newJob, updatedAt: now };
    } else {
      jobs.unshift(newJob);
    }

    await this.set(STORAGE_KEYS.JOBS, jobs);
    this.updateExtensionBadge(jobs.length);
    return newJob;
  },

  async updateJobStatus(id, newStatus, note = '') {
    const jobs = await this.getJobs();
    const job = jobs.find(j => j.id === id);
    if (!job) return null;

    const now = new Date().toISOString();
    const oldStatus = job.status;
    job.status = newStatus;
    job.updatedAt = now;

    if (!job.timeline) job.timeline = [];
    job.timeline.push({
      status: newStatus,
      date: now,
      note: note || `Changed status from ${oldStatus} to ${newStatus}`
    });

    await this.set(STORAGE_KEYS.JOBS, jobs);
    return job;
  },

  async deleteJob(id) {
    let jobs = await this.getJobs();
    jobs = jobs.filter(j => j.id !== id);
    await this.set(STORAGE_KEYS.JOBS, jobs);
    this.updateExtensionBadge(jobs.length);
    return true;
  },

  // ---------------- RESUMES & LOCAL FILES ----------------
  async getResumes() {
    let resumes = await this.get(STORAGE_KEYS.RESUMES, null);
    if (!resumes || !Array.isArray(resumes) || resumes.length === 0) {
      resumes = DEFAULT_RESUMES;
      await this.set(STORAGE_KEYS.RESUMES, resumes);

      // Pre-seed sample PDF files for the default resumes so they are immediately viewable & downloadable
      for (const r of resumes) {
        const samplePdf = generateSamplePdfDataUrl(r.name.replace('.pdf', ' Resume'));
        await ResumeFileStore.saveFile({
          id: r.id,
          name: r.name,
          originalFileName: r.originalFileName || r.name,
          fileType: r.fileType || 'application/pdf',
          fileSize: r.fileSize || 120000,
          dataUrl: samplePdf,
          uploadedAt: r.createdAt
        });
      }
    }
    return resumes;
  },

  async getResumeById(id) {
    const resumes = await this.getResumes();
    return resumes.find(r => r.id === id) || null;
  },

  async getResumeByName(name) {
    if (!name) return null;
    const resumes = await this.getResumes();
    return resumes.find(r => r.name.toLowerCase() === name.toLowerCase()) || null;
  },

  async addResume(name, isDefault = false, fileData = null) {
    const resumes = await this.getResumes();
    const cleanName = (name || '').trim();
    if (!cleanName) return null;

    if (isDefault) {
      resumes.forEach(r => r.isDefault = false);
    }

    const id = 'res_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const now = new Date().toISOString();

    let hasFile = false;
    let fileSize = 0;
    let fileType = '';
    let originalFileName = cleanName;

    if (fileData && fileData.dataUrl) {
      hasFile = true;
      fileSize = fileData.fileSize || fileData.size || 0;
      fileType = fileData.fileType || fileData.type || 'application/pdf';
      originalFileName = fileData.originalFileName || fileData.name || cleanName;

      await ResumeFileStore.saveFile({
        id: id,
        name: cleanName,
        originalFileName: originalFileName,
        fileType: fileType,
        fileSize: fileSize,
        dataUrl: fileData.dataUrl,
        uploadedAt: now
      });
    }

    const newResume = {
      id: id,
      name: cleanName,
      originalFileName: originalFileName,
      fileType: fileType,
      fileSize: fileSize,
      hasFile: hasFile,
      isDefault: isDefault || resumes.length === 0,
      createdAt: now,
      lastUsedAt: now
    };

    resumes.push(newResume);
    await this.set(STORAGE_KEYS.RESUMES, resumes);
    return newResume;
  },

  async saveResumeFile(id, fileData) {
    const resumes = await this.getResumes();
    const resume = resumes.find(r => r.id === id);
    if (!resume || !fileData || !fileData.dataUrl) return null;

    const now = new Date().toISOString();
    resume.hasFile = true;
    resume.fileSize = fileData.fileSize || fileData.size || 0;
    resume.fileType = fileData.fileType || fileData.type || 'application/pdf';
    resume.originalFileName = fileData.originalFileName || fileData.name || resume.name;
    resume.uploadedAt = now;

    await ResumeFileStore.saveFile({
      id: id,
      name: resume.name,
      originalFileName: resume.originalFileName,
      fileType: resume.fileType,
      fileSize: resume.fileSize,
      dataUrl: fileData.dataUrl,
      uploadedAt: now
    });

    await this.set(STORAGE_KEYS.RESUMES, resumes);
    return resume;
  },

  async getResumeFile(id) {
    return await ResumeFileStore.getFile(id);
  },

  async deleteResume(id) {
    let resumes = await this.getResumes();
    resumes = resumes.filter(r => r.id !== id);
    if (resumes.length > 0 && !resumes.some(r => r.isDefault)) {
      resumes[0].isDefault = true;
    }
    await this.set(STORAGE_KEYS.RESUMES, resumes);
    await ResumeFileStore.deleteFile(id);
    return resumes;
  },

  async setDefaultResume(id) {
    const resumes = await this.getResumes();
    resumes.forEach(r => {
      r.isDefault = (r.id === id);
    });
    await this.set(STORAGE_KEYS.RESUMES, resumes);
    return resumes;
  },

  // ---------------- FILE HELPERS: PREVIEW & DOWNLOAD ----------------
  dataUrlToBlob(dataUrl) {
    try {
      const arr = dataUrl.split(',');
      const mime = (arr[0].match(/:(.*?);/) || [])[1] || 'application/octet-stream';
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new Blob([u8arr], { type: mime });
    } catch (e) {
      console.error('Error converting dataUrl to Blob:', e);
      return null;
    }
  },

  formatFileSize(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
  },

  async downloadResume(idOrName) {
    let file = null;
    let resume = await this.getResumeById(idOrName);
    if (!resume) {
      resume = await this.getResumeByName(idOrName);
    }
    if (resume) {
      file = await this.getResumeFile(resume.id);
    } else {
      file = await this.getResumeFile(idOrName);
    }

    if (!file || !file.dataUrl) {
      throw new Error('Resume file content not found in local storage.');
    }

    const blob = this.dataUrlToBlob(file.dataUrl);
    const blobUrl = blob ? URL.createObjectURL(blob) : file.dataUrl;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = file.originalFileName || file.name || 'resume.pdf';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
      if (blob) URL.revokeObjectURL(blobUrl);
    }, 1500);
    return true;
  },

  async getResumeBlobUrl(idOrName) {
    let file = null;
    let resume = await this.getResumeById(idOrName);
    if (!resume) {
      resume = await this.getResumeByName(idOrName);
    }
    if (resume) {
      file = await this.getResumeFile(resume.id);
    } else {
      file = await this.getResumeFile(idOrName);
    }

    if (!file || !file.dataUrl) return null;
    const blob = this.dataUrlToBlob(file.dataUrl);
    if (!blob) return file.dataUrl;
    return {
      url: URL.createObjectURL(blob),
      file: file,
      blob: blob
    };
  },

  // ---------------- UTILS & PLATFORM DETECTOR ----------------
  detectPlatform(url = '') {
    if (!url) return 'Direct / Company';
    const lower = url.toLowerCase();
    if (lower.includes('linkedin.com')) return 'LinkedIn';
    if (lower.includes('indeed.com')) return 'Indeed';
    if (lower.includes('glassdoor.com')) return 'Glassdoor';
    if (lower.includes('greenhouse.io')) return 'Greenhouse';
    if (lower.includes('lever.co')) return 'Lever';
    if (lower.includes('workday.com') || lower.includes('myworkdayjobs.com')) return 'Workday';
    if (lower.includes('wellfound.com') || lower.includes('angel.co')) return 'Wellfound';
    if (lower.includes('ziprecruiter.com')) return 'ZipRecruiter';
    if (lower.includes('dice.com')) return 'Dice';
    return 'Other';
  },

  updateExtensionBadge(count) {
    if (typeof chrome !== 'undefined' && chrome.action && chrome.action.setBadgeText) {
      chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
      chrome.action.setBadgeBackgroundColor({ color: '#6366f1' });
    }
  },

  // ---------------- SAMPLE DATA GENERATOR ----------------
  async loadSampleData() {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    // Seed default resumes & their local files
    await this.set(STORAGE_KEYS.RESUMES, DEFAULT_RESUMES);
    for (const r of DEFAULT_RESUMES) {
      const samplePdf = generateSamplePdfDataUrl(r.name.replace('.pdf', '').replace(/_/g, ' ') + ' Resume');
      await ResumeFileStore.saveFile({
        id: r.id,
        name: r.name,
        originalFileName: r.originalFileName,
        fileType: 'application/pdf',
        fileSize: r.fileSize,
        dataUrl: samplePdf,
        uploadedAt: new Date(now - 30 * day).toISOString()
      });
    }

    const sampleJobs = [
      {
        id: 'sample_1',
        title: 'Senior Frontend Engineer',
        company: 'Stripe',
        location: 'Remote, US',
        url: 'https://www.linkedin.com/jobs/view/stripe-fe',
        platform: 'LinkedIn',
        resumeId: 'res_2',
        resumeName: 'Frontend_React_Specialist.pdf',
        resumeHasFile: true,
        status: 'interviewing',
        appliedAt: new Date(now - 7 * day).toISOString(),
        updatedAt: new Date(now - 2 * day).toISOString(),
        salary: '$165,000 - $190,000',
        notes: 'Passed recruiter screen on Monday. Technical system design scheduled for Friday with Engineering Manager.',
        contactName: 'Sarah Jenkins',
        contactEmail: 's.jenkins@stripe.com',
        followUpDate: new Date(now + 2 * day).toISOString().split('T')[0],
        timeline: [
          { status: 'applied', date: new Date(now - 7 * day).toISOString(), note: 'Applied via LinkedIn Easy Apply with uploaded resume' },
          { status: 'screening', date: new Date(now - 5 * day).toISOString(), note: 'Recruiter reached out via email' },
          { status: 'interviewing', date: new Date(now - 2 * day).toISOString(), note: 'Technical screen scheduled' }
        ]
      },
      {
        id: 'sample_2',
        title: 'Staff Full-Stack Architect',
        company: 'Vercel',
        location: 'San Francisco, CA / Remote',
        url: 'https://vercel.com/careers/fullstack',
        platform: 'Company Site',
        resumeId: 'res_3',
        resumeName: 'FullStack_Node_TypeScript.pdf',
        resumeHasFile: true,
        status: 'offer',
        appliedAt: new Date(now - 21 * day).toISOString(),
        updatedAt: new Date(now - 1 * day).toISOString(),
        salary: '$195,000 + Equity',
        notes: 'Received written offer! 4 weeks vacation, $10k home office stipend. Reviewing counter-offer options.',
        contactName: 'Alex Rivera',
        contactEmail: 'alex.r@vercel.com',
        followUpDate: new Date(now + 1 * day).toISOString().split('T')[0],
        timeline: [
          { status: 'applied', date: new Date(now - 21 * day).toISOString(), note: 'Applied with tailored resume' },
          { status: 'screening', date: new Date(now - 17 * day).toISOString(), note: '30m chat with lead recruiter' },
          { status: 'interviewing', date: new Date(now - 8 * day).toISOString(), note: 'Completed 4-stage onsite loop' },
          { status: 'offer', date: new Date(now - 1 * day).toISOString(), note: 'Formal offer extended' }
        ]
      },
      {
        id: 'sample_3',
        title: 'Lead Software Engineer',
        company: 'Airbnb',
        location: 'Remote',
        url: 'https://careers.airbnb.com/positions/lead-swe',
        platform: 'LinkedIn',
        resumeId: 'res_1',
        resumeName: 'Software_Engineer_General.pdf',
        resumeHasFile: true,
        status: 'screening',
        appliedAt: new Date(now - 4 * day).toISOString(),
        updatedAt: new Date(now - 1 * day).toISOString(),
        salary: '$180,000 - $210,000',
        notes: 'Recruiter phone screen set for tomorrow 2 PM PST.',
        contactName: 'David Chen',
        contactEmail: 'david.chen@airbnb.com',
        followUpDate: new Date(now + 1 * day).toISOString().split('T')[0],
        timeline: [
          { status: 'applied', date: new Date(now - 4 * day).toISOString(), note: 'Applied on LinkedIn' },
          { status: 'screening', date: new Date(now - 1 * day).toISOString(), note: 'Recruiter replied for call' }
        ]
      },
      {
        id: 'sample_4',
        title: 'Senior React Developer',
        company: 'Shopify',
        location: 'Remote, Canada/US',
        url: 'https://www.indeed.com/viewjob?jk=shopify123',
        platform: 'Indeed',
        resumeId: 'res_2',
        resumeName: 'Frontend_React_Specialist.pdf',
        resumeHasFile: true,
        status: 'interviewing',
        appliedAt: new Date(now - 14 * day).toISOString(),
        updatedAt: new Date(now - 3 * day).toISOString(),
        salary: '$150,000 - $175,000',
        notes: 'Take-home assessment submitted. Meeting the team next Tuesday.',
        contactName: 'Emily Watson',
        contactEmail: 'emily.w@shopify.com',
        followUpDate: new Date(now + 4 * day).toISOString().split('T')[0],
        timeline: [
          { status: 'applied', date: new Date(now - 14 * day).toISOString(), note: 'Applied on Indeed' },
          { status: 'interviewing', date: new Date(now - 3 * day).toISOString(), note: 'Take home approved' }
        ]
      },
      {
        id: 'sample_5',
        title: 'Full Stack Engineer',
        company: 'Figma',
        location: 'San Francisco, CA',
        url: 'https://jobs.lever.co/figma/fullstack',
        platform: 'Lever',
        resumeId: 'res_3',
        resumeName: 'FullStack_Node_TypeScript.pdf',
        resumeHasFile: true,
        status: 'applied',
        appliedAt: new Date(now - 2 * day).toISOString(),
        updatedAt: new Date(now - 2 * day).toISOString(),
        salary: '$160,000 - $185,000',
        notes: 'Referral from former colleague.',
        contactName: 'Marcus Vance',
        contactEmail: '',
        followUpDate: new Date(now + 5 * day).toISOString().split('T')[0],
        timeline: [
          { status: 'applied', date: new Date(now - 2 * day).toISOString(), note: 'Applied with referral' }
        ]
      },
      {
        id: 'sample_6',
        title: 'Frontend Engineer',
        company: 'DoorDash',
        location: 'Remote',
        url: 'https://careers.doordash.com/jobs/12345',
        platform: 'Greenhouse',
        resumeId: 'res_1',
        resumeName: 'Software_Engineer_General.pdf',
        resumeHasFile: true,
        status: 'rejected',
        appliedAt: new Date(now - 18 * day).toISOString(),
        updatedAt: new Date(now - 6 * day).toISOString(),
        salary: '$145,000',
        notes: 'Standard automated rejection email: role closed due to budget freeze.',
        contactName: '',
        contactEmail: '',
        followUpDate: '',
        timeline: [
          { status: 'applied', date: new Date(now - 18 * day).toISOString(), note: 'Applied on company portal' },
          { status: 'rejected', date: new Date(now - 6 * day).toISOString(), note: 'Automated rejection received' }
        ]
      },
      {
        id: 'sample_7',
        title: 'UI Platform Engineer',
        company: 'Datadog',
        location: 'New York, NY / Hybrid',
        url: 'https://careers.datadoghq.com/ui-platform',
        platform: 'LinkedIn',
        resumeId: 'res_2',
        resumeName: 'Frontend_React_Specialist.pdf',
        resumeHasFile: true,
        status: 'applied',
        appliedAt: new Date(now - 1 * day).toISOString(),
        updatedAt: new Date(now - 1 * day).toISOString(),
        salary: '$170,000 - $190,000',
        notes: 'Applied yesterday afternoon.',
        contactName: '',
        contactEmail: '',
        followUpDate: new Date(now + 6 * day).toISOString().split('T')[0],
        timeline: [
          { status: 'applied', date: new Date(now - 1 * day).toISOString(), note: 'Applied via LinkedIn' }
        ]
      },
      {
        id: 'sample_8',
        title: 'Senior Web Engineer',
        company: 'Spotify',
        location: 'Remote, US',
        url: 'https://www.lifeatspotify.com/jobs/web-dev',
        platform: 'Company Site',
        resumeId: 'res_1',
        resumeName: 'Software_Engineer_General.pdf',
        resumeHasFile: true,
        status: 'ghosted',
        appliedAt: new Date(now - 32 * day).toISOString(),
        updatedAt: new Date(now - 32 * day).toISOString(),
        salary: '$155,000 - $180,000',
        notes: 'No response after 4+ weeks. Marked as ghosted/no reply.',
        contactName: '',
        contactEmail: '',
        followUpDate: '',
        timeline: [
          { status: 'applied', date: new Date(now - 32 * day).toISOString(), note: 'Application submitted' },
          { status: 'ghosted', date: new Date(now - 10 * day).toISOString(), note: 'Marked as no reply after 3 weeks' }
        ]
      }
    ];

    await this.set(STORAGE_KEYS.JOBS, sampleJobs);
    this.updateExtensionBadge(sampleJobs.length);
    return sampleJobs;
  },

  // ---------------- EXPORT / IMPORT ----------------
  async exportData(includeFiles = true) {
    const jobs = await this.getJobs();
    const resumes = await this.getResumes();
    let files = [];
    if (includeFiles) {
      files = await ResumeFileStore.getAllFiles();
    }
    return {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      applications: jobs,
      resumes: resumes,
      files: files
    };
  },

  async importData(imported) {
    if (!imported || typeof imported !== 'object') {
      throw new Error('Invalid backup file format');
    }
    if (Array.isArray(imported.applications)) {
      await this.set(STORAGE_KEYS.JOBS, imported.applications);
      this.updateExtensionBadge(imported.applications.length);
    }
    if (Array.isArray(imported.resumes)) {
      await this.set(STORAGE_KEYS.RESUMES, imported.resumes);
    }
    if (Array.isArray(imported.files)) {
      for (const f of imported.files) {
        if (f && f.id && f.dataUrl) {
          await ResumeFileStore.saveFile(f);
        }
      }
    }
    return true;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageService;
}
