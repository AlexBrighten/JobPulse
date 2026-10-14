// utils/firebase-sync.js — Firebase Auth (Google Sign-In) & Cloud Firestore Sync for JobPulse
// Resume files remain 100% stored in local storage / IndexedDB for privacy and performance.

// Dynamic configuration resolver: loads from window.FIREBASE_CONFIG (defined in config/firebase-config.js or .env)
function getFirebaseConfig() {
  if (typeof window !== 'undefined' && window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.apiKey && window.FIREBASE_CONFIG.apiKey !== 'YOUR_FIREBASE_API_KEY') {
    return window.FIREBASE_CONFIG;
  }
  return null;
}

const FirebaseSync = {
  app: null,
  auth: null,
  db: null,
  currentUser: null,
  isInitialized: false,
  _listeners: [],
  _unsubscribeSnapshot: null,

  /**
   * Dynamically loads Firebase SDK scripts if not already present on page.
   */
  async loadSdk() {
    if (typeof firebase !== 'undefined' && firebase.apps) return true;

    const loadScript = (src) => new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });

    // Try local vendor scripts first
    const vendorBasePath = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL
      ? chrome.runtime.getURL('vendor/')
      : '../vendor/';

    try {
      await loadScript(vendorBasePath + 'firebase-app-compat.js');
      await Promise.all([
        loadScript(vendorBasePath + 'firebase-auth-compat.js'),
        loadScript(vendorBasePath + 'firebase-firestore-compat.js')
      ]);
      return true;
    } catch (localErr) {
      // Fallback to CDN if local path fails
      try {
        await loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
        await Promise.all([
          loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js'),
          loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js')
        ]);
        return true;
      } catch (cdnErr) {
        console.warn('Firebase SDK load failed:', cdnErr);
        return false;
      }
    }
  },

  /**
   * Initializes Firebase App, Auth, and Firestore
   */
  async init() {
    if (this.isInitialized) return true;

    const loaded = await this.loadSdk();
    if (!loaded || typeof firebase === 'undefined') {
      console.warn('Firebase not loaded — running in local-only mode.');
      return false;
    }

    const config = getFirebaseConfig();
    if (!config) {
      console.info('JobPulse: No external Firebase credentials detected. Operating in 100% Local Storage Mode.');
      return false;
    }

    try {
      if (!firebase.apps.length) {
        this.app = firebase.initializeApp(config);
      } else {
        this.app = firebase.app();
      }

      this.auth = firebase.auth();
      this.db = firebase.firestore();
      this.isInitialized = true;

      // Listen to Auth State
      this.auth.onAuthStateChanged(async (user) => {
        this.currentUser = user;
        this._notifyListeners({ type: 'AUTH_CHANGED', user });

        if (user) {
          console.log('Firebase user logged in:', user.email);
          await this.startRealtimeSync(user.uid);
        } else {
          console.log('Firebase user logged out');
          if (this._unsubscribeSnapshot) {
            this._unsubscribeSnapshot();
            this._unsubscribeSnapshot = null;
          }
        }
      });

      return true;
    } catch (err) {
      console.error('Firebase init error:', err);
      return false;
    }
  },

  /**
   * Trigger Google Sign-In popup
   */
  async signInWithGoogle() {
    if (!this.isInitialized) await this.init();
    if (!this.auth) throw new Error('Firebase Auth unavailable');

    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');
    // Optional Gmail readonly scope for email tracking if user consents
    // provider.addScope('https://www.googleapis.com/auth/gmail.readonly');

    try {
      const result = await this.auth.signInWithPopup(provider);
      return result.user;
    } catch (error) {
      console.error('Sign-in error:', error);
      throw error;
    }
  },

  /**
   * Sign out current user
   */
  async signOut() {
    if (this._unsubscribeSnapshot) {
      this._unsubscribeSnapshot();
      this._unsubscribeSnapshot = null;
    }
    if (this.auth) {
      await this.auth.signOut();
    }
    this.currentUser = null;
  },

  /**
   * Start Firestore Realtime Sync for Applications
   * Only syncs job application data — resumes remain strictly local!
   */
  async startRealtimeSync(uid) {
    if (!this.db || !uid) return;

    if (this._unsubscribeSnapshot) {
      this._unsubscribeSnapshot();
    }

    try {
      const userJobsCol = this.db.collection('users').doc(uid).collection('applications');

      // First check if cloud has jobs; if empty and local has jobs, migrate local to cloud
      const snapshot = await userJobsCol.get();
      const localJobs = await StorageService.getJobs();

      if (snapshot.empty && localJobs.length > 0) {
        console.log('Migrating local applications to Firestore...');
        const batch = this.db.batch();
        for (const job of localJobs) {
          const docRef = userJobsCol.doc(job.id);
          // Strip any large binary blobs if present
          const cleanJob = { ...job };
          delete cleanJob.uploadedResume;
          batch.set(docRef, cleanJob);
        }
        await batch.commit();
        console.log('Local applications migrated to Cloud Firestore.');
      }

      // Listen for changes from Cloud Firestore
      this._unsubscribeSnapshot = userJobsCol.onSnapshot((querySnapshot) => {
        const cloudJobs = [];
        querySnapshot.forEach((doc) => {
          cloudJobs.push(doc.data());
        });

        // Merge with local storage (preserving local resume references)
        this._mergeCloudWithLocal(cloudJobs);
      }, (error) => {
        console.warn('Firestore onSnapshot listener error:', error);
      });

    } catch (e) {
      console.warn('Realtime sync error:', e);
    }
  },

  /**
   * Merges cloud jobs with local jobs, taking the latest updatedAt
   */
  async _mergeCloudWithLocal(cloudJobs) {
    if (!Array.isArray(cloudJobs)) return;

    const localJobs = await StorageService.getJobs();
    const jobMap = new Map();

    // Add local jobs first
    for (const j of localJobs) {
      jobMap.set(j.id, j);
    }

    let hasChanges = false;

    // Merge cloud jobs
    for (const cj of cloudJobs) {
      const existing = jobMap.get(cj.id);
      if (!existing) {
        jobMap.set(cj.id, cj);
        hasChanges = true;
      } else {
        const cloudTime = new Date(cj.updatedAt || 0).getTime();
        const localTime = new Date(existing.updatedAt || 0).getTime();
        if (cloudTime > localTime) {
          // Keep local resumeHasFile if local file exists
          jobMap.set(cj.id, {
            ...cj,
            resumeHasFile: existing.resumeHasFile || cj.resumeHasFile
          });
          hasChanges = true;
        }
      }
    }

    if (hasChanges) {
      const mergedList = Array.from(jobMap.values())
        .sort((a, b) => new Date(b.appliedAt || 0) - new Date(a.appliedAt || 0));

      await StorageService.set(STORAGE_KEYS.JOBS, mergedList);
      StorageService.updateExtensionBadge(mergedList.length);
      this._notifyListeners({ type: 'JOBS_UPDATED', jobs: mergedList });
    }
  },

  /**
   * Save a single job application to Cloud Firestore
   */
  async syncJobToCloud(job) {
    if (!this.currentUser || !this.db || !job || !job.id) return;

    try {
      const cleanJob = { ...job };
      delete cleanJob.uploadedResume; // Ensure binary stays local
      await this.db.collection('users').doc(this.currentUser.uid)
        .collection('applications').doc(job.id)
        .set(cleanJob, { merge: true });
    } catch (err) {
      console.warn('Error syncing job to cloud:', err);
    }
  },

  /**
   * Delete a job from Cloud Firestore
   */
  async deleteJobFromCloud(jobId) {
    if (!this.currentUser || !this.db || !jobId) return;

    try {
      await this.db.collection('users').doc(this.currentUser.uid)
        .collection('applications').doc(jobId)
        .delete();
    } catch (err) {
      console.warn('Error deleting job from cloud:', err);
    }
  },

  /**
   * Subscribe to auth and sync events
   */
  onEvent(callback) {
    if (typeof callback === 'function') {
      this._listeners.push(callback);
    }
  },

  _notifyListeners(event) {
    for (const cb of this._listeners) {
      try { cb(event); } catch (e) { console.error(e); }
    }
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = FirebaseSync;
}
