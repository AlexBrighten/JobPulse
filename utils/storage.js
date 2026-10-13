// utils/storage.js - Unified storage manager with chrome.storage.local and localStorage fallback

const DEFAULT_RESUMES = [
  { id: 'res_1', name: 'Software_Engineer_General.pdf', isDefault: true, createdAt: new Date().toISOString() },
  { id: 'res_2', name: 'Frontend_React_Specialist.pdf', isDefault: false, createdAt: new Date().toISOString() },
  { id: 'res_3', name: 'FullStack_Node_TypeScript.pdf', isDefault: false, createdAt: new Date().toISOString() }
];

const STORAGE_KEYS = {
  JOBS: 'jobpulse_applications',
  RESUMES: 'jobpulse_resumes',
  SETTINGS: 'jobpulse_settings'
};

const StorageService = {
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
    } else {
      try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
      } catch (e) {
        console.error('LocalStorage parse error:', e);
        return defaultValue;
      }
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
    } else {
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
    const now = new Date().toISOString();
    
    const newJob = {
      id: jobData.id || ('job_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)),
      title: (jobData.title || 'Untitled Position').trim(),
      company: (jobData.company || 'Unknown Company').trim(),
      location: (jobData.location || '').trim(),
      url: (jobData.url || '').trim(),
      platform: (jobData.platform || this.detectPlatform(jobData.url)).trim(),
      resumeName: (jobData.resumeName || 'Default Resume').trim(),
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

  // ---------------- RESUMES ----------------
  async getResumes() {
    let resumes = await this.get(STORAGE_KEYS.RESUMES, null);
    if (!resumes || !Array.isArray(resumes) || resumes.length === 0) {
      resumes = DEFAULT_RESUMES;
      await this.set(STORAGE_KEYS.RESUMES, resumes);
    }
    return resumes;
  },

  async addResume(name, isDefault = false) {
    const resumes = await this.getResumes();
    const cleanName = name.trim();
    if (!cleanName) return null;

    if (isDefault) {
      resumes.forEach(r => r.isDefault = false);
    }

    const newResume = {
      id: 'res_' + Date.now(),
      name: cleanName,
      isDefault: isDefault || resumes.length === 0,
      createdAt: new Date().toISOString()
    };

    resumes.push(newResume);
    await this.set(STORAGE_KEYS.RESUMES, resumes);
    return newResume;
  },

  async deleteResume(id) {
    let resumes = await this.getResumes();
    resumes = resumes.filter(r => r.id !== id);
    if (resumes.length > 0 && !resumes.some(r => r.isDefault)) {
      resumes[0].isDefault = true;
    }
    await this.set(STORAGE_KEYS.RESUMES, resumes);
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

    const sampleJobs = [
      {
        id: 'sample_1',
        title: 'Senior Frontend Engineer',
        company: 'Stripe',
        location: 'Remote, US',
        url: 'https://www.linkedin.com/jobs/view/stripe-fe',
        platform: 'LinkedIn',
        resumeName: 'Frontend_React_Specialist.pdf',
        status: 'interviewing',
        appliedAt: new Date(now - 7 * day).toISOString(),
        updatedAt: new Date(now - 2 * day).toISOString(),
        salary: '$165,000 - $190,000',
        notes: 'Passed recruiter screen on Monday. Technical system design scheduled for Friday with Engineering Manager.',
        contactName: 'Sarah Jenkins',
        contactEmail: 's.jenkins@stripe.com',
        followUpDate: new Date(now + 2 * day).toISOString().split('T')[0],
        timeline: [
          { status: 'applied', date: new Date(now - 7 * day).toISOString(), note: 'Applied via LinkedIn Easy Apply' },
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
        resumeName: 'FullStack_Node_TypeScript.pdf',
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
        resumeName: 'Software_Engineer_General.pdf',
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
        resumeName: 'Frontend_React_Specialist.pdf',
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
        resumeName: 'FullStack_Node_TypeScript.pdf',
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
        resumeName: 'Software_Engineer_General.pdf',
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
        resumeName: 'Frontend_React_Specialist.pdf',
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
        resumeName: 'Software_Engineer_General.pdf',
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
    await this.set(STORAGE_KEYS.RESUMES, DEFAULT_RESUMES);
    this.updateExtensionBadge(sampleJobs.length);
    return sampleJobs;
  },

  // ---------------- EXPORT / IMPORT ----------------
  async exportData() {
    const jobs = await this.getJobs();
    const resumes = await this.getResumes();
    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      applications: jobs,
      resumes: resumes
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
    return true;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageService;
}
