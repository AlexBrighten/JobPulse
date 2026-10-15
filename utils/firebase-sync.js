// utils/firebase-sync.js — Cloud Firestore Exclusive Data Store for JobPulse
// Store every data other than resume in Firestore and DO NOT save it locally.
// Resume files & metadata remain 100% stored locally for privacy.

// Dynamic configuration resolver
async function resolveFirebaseConfig() {
  if (
    typeof window !== 'undefined' &&
    window.FIREBASE_CONFIG &&
    window.FIREBASE_CONFIG.apiKey &&
    window.FIREBASE_CONFIG.apiKey !== 'YOUR_FIREBASE_API_KEY'
  ) {
    return window.FIREBASE_CONFIG;
  }

  if (typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem('jobpulse_firebase_config');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.apiKey && parsed.apiKey !== 'YOUR_FIREBASE_API_KEY') {
          window.FIREBASE_CONFIG = parsed;
          return parsed;
        }
      }
    } catch (e) {}
  }

  if (typeof window !== 'undefined' && window.location && window.location.protocol && window.location.protocol.startsWith('http')) {
    try {
      const res = await fetch('/api/firebase-config', {
        headers: { 'Accept': 'application/json' }
      });
      if (res.ok) {
        const json = await res.json();
        if (json && json.apiKey && json.apiKey !== 'YOUR_FIREBASE_API_KEY') {
          window.FIREBASE_CONFIG = json;
          return json;
        }
      }
    } catch (e) {}
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
  _activeUid: null,

  getUserId() {
    if (this.currentUser && this.currentUser.uid) {
      return this.currentUser.uid;
    }
    if (!this._activeUid) {
      if (typeof sessionStorage !== 'undefined') {
        this._activeUid = sessionStorage.getItem('jobpulse_active_uid');
      }
      if (!this._activeUid) {
        this._activeUid = 'guest_' + Math.random().toString(36).substring(2, 10);
        if (typeof sessionStorage !== 'undefined') {
          try { sessionStorage.setItem('jobpulse_active_uid', this._activeUid); } catch (e) {}
        }
      }
    }
    return this._activeUid;
  },

  async loadSdk() {
    if (typeof firebase !== 'undefined' && firebase.apps) return true;

    const loadScript = (src) => new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });

    const vendorBasePath = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL
      ? chrome.runtime.getURL('vendor/')
      : '/vendor/';

    try {
      await loadScript(vendorBasePath + 'firebase-app-compat.js');
      await Promise.all([
        loadScript(vendorBasePath + 'firebase-auth-compat.js'),
        loadScript(vendorBasePath + 'firebase-firestore-compat.js')
      ]);
      return true;
    } catch (localErr) {
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

  async init() {
    if (this.isInitialized) return true;

    const loaded = await this.loadSdk();
    if (!loaded || typeof firebase === 'undefined') {
      console.warn('Firebase SDK not available.');
      return false;
    }

    const config = await resolveFirebaseConfig();
    if (!config) {
      console.warn('JobPulse: Firebase credentials missing. Please set Firebase config.');
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

      // Enable offline persistence in Firestore SDK if possible
      try {
        await this.db.enablePersistence({ synchronizeTabs: true });
      } catch (persErr) {}

      // Listen for auth changes
      this.auth.onAuthStateChanged(async (user) => {
        const prevUid = this._activeUid;
        this.currentUser = user;
        this._notifyListeners({ type: 'AUTH_CHANGED', user });

        if (user) {
          console.log('Firebase user authenticated:', user.email || user.uid);
          this._activeUid = user.uid;

          // If there were temporary guest applications before sign in, migrate them
          if (prevUid && prevUid !== user.uid && prevUid.startsWith('guest_')) {
            await this._migrateGuestDocsToUser(prevUid, user.uid);
          }

          await this.startRealtimeSync(user.uid);
        } else {
          // Attempt anonymous auth if user is not signed in
          try {
            const anon = await this.auth.signInAnonymously();
            this.currentUser = anon.user;
            this._activeUid = anon.user.uid;
            await this.startRealtimeSync(anon.user.uid);
          } catch (anonErr) {
            // If anonymous auth is disabled, sync with current session uid
            const guestUid = this.getUserId();
            await this.startRealtimeSync(guestUid);
          }
        }
      });

      return true;
    } catch (err) {
      console.error('Firebase init error:', err);
      return false;
    }
  },

  async _migrateGuestDocsToUser(oldUid, newUid) {
    if (!this.db || !oldUid || !newUid) return;
    try {
      const oldCol = this.db.collection('users').doc(oldUid).collection('applications');
      const snap = await oldCol.get();
      if (!snap.empty) {
        const batch = this.db.batch();
        const newCol = this.db.collection('users').doc(newUid).collection('applications');
        snap.forEach(doc => {
          batch.set(newCol.doc(doc.id), doc.data());
          batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`Migrated ${snap.size} guest applications to user ${newUid}`);
      }
    } catch (e) {
      console.warn('Guest migration notice:', e);
    }
  },

  async signInWithGoogle() {
    if (typeof window !== 'undefined' && window.location) {
      if (window.location.protocol === 'chrome-extension:' || window.location.protocol === 'file:') {
        const err = new Error('Google Sign-In runs on your hosted Vercel dashboard. Please open your hosted dashboard to sign in.');
        err.code = 'auth/extension-csp-restricted';
        err.friendlyMessage = 'Google Sign-In runs on your hosted Vercel dashboard due to Chrome security policies. Open your Vercel URL to sign in.';
        throw err;
      }
    }

    if (!this.isInitialized) await this.init();
    if (!this.auth) {
      const err = new Error('Firebase credentials not configured yet.');
      err.code = 'auth/not-configured';
      throw err;
    }

    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');

    try {
      const result = await this.auth.signInWithPopup(provider);
      return result.user;
    } catch (error) {
      console.error('Sign-in error:', error);
      if (error && error.code === 'auth/unauthorized-domain') {
        const host = typeof window !== 'undefined' ? window.location.hostname : 'your domain';
        error.friendlyMessage = `Domain "${host}" is not authorized in Firebase. Please add "${host}" to Firebase Console -> Authentication -> Settings -> Authorized Domains.`;
      }
      throw error;
    }
  },

  async signOut() {
    if (this._unsubscribeSnapshot) {
      this._unsubscribeSnapshot();
      this._unsubscribeSnapshot = null;
    }
    if (this.auth) {
      await this.auth.signOut();
    }
    this.currentUser = null;
    this._activeUid = null;
  },

  async startRealtimeSync(uid) {
    if (!this.db || !uid) return;

    if (this._unsubscribeSnapshot) {
      this._unsubscribeSnapshot();
    }

    try {
      const userJobsCol = this.db.collection('users').doc(uid).collection('applications');

      this._unsubscribeSnapshot = userJobsCol.onSnapshot((querySnapshot) => {
        const cloudJobs = [];
        querySnapshot.forEach((doc) => {
          cloudJobs.push(doc.data());
        });

        cloudJobs.sort((a, b) => new Date(b.appliedAt || 0) - new Date(a.appliedAt || 0));

        // Update memory cache ONLY — DO NOT SAVE LOCALLY
        if (typeof StorageService !== 'undefined') {
          StorageService._jobsCache = cloudJobs;
          StorageService.updateExtensionBadge(cloudJobs.length);
        }

        this._notifyListeners({ type: 'JOBS_UPDATED', jobs: cloudJobs });
      }, (error) => {
        console.warn('Firestore onSnapshot listener notice:', error);
      });

    } catch (e) {
      console.warn('Realtime sync notice:', e);
    }
  },

  async saveJobToCloud(job) {
    if (!this.isInitialized) await this.init();
    if (!this.db || !job || !job.id) return false;

    try {
      const uid = this.getUserId();
      const cleanJob = { ...job };
      delete cleanJob.uploadedResume; // Ensure binary stays local
      await this.db.collection('users').doc(uid)
        .collection('applications').doc(job.id)
        .set(cleanJob, { merge: true });
      return true;
    } catch (err) {
      console.warn('Error saving job to Firestore:', err);
      return false;
    }
  },

  async deleteJobFromCloud(jobId) {
    if (!this.isInitialized) await this.init();
    if (!this.db || !jobId) return false;

    try {
      const uid = this.getUserId();
      await this.db.collection('users').doc(uid)
        .collection('applications').doc(jobId)
        .delete();
      return true;
    } catch (err) {
      console.warn('Error deleting job from Firestore:', err);
      return false;
    }
  },

  async getJobsFromCloud() {
    if (!this.isInitialized) await this.init();
    if (!this.db) return [];

    try {
      const uid = this.getUserId();
      const snapshot = await this.db.collection('users').doc(uid)
        .collection('applications').get();
      const jobs = [];
      snapshot.forEach(doc => jobs.push(doc.data()));
      return jobs.sort((a, b) => new Date(b.appliedAt || 0) - new Date(a.appliedAt || 0));
    } catch (err) {
      console.warn('Error reading jobs from Firestore:', err);
      return [];
    }
  },

  async saveSettingsToCloud(settings) {
    if (!this.isInitialized) await this.init();
    if (!this.db) return false;

    try {
      const uid = this.getUserId();
      await this.db.collection('users').doc(uid)
        .collection('settings').doc('general')
        .set(settings, { merge: true });
      return true;
    } catch (err) {
      console.warn('Error saving settings to Firestore:', err);
      return false;
    }
  },

  async getSettingsFromCloud() {
    if (!this.isInitialized) await this.init();
    if (!this.db) return null;

    try {
      const uid = this.getUserId();
      const doc = await this.db.collection('users').doc(uid)
        .collection('settings').doc('general').get();
      return doc.exists ? doc.data() : null;
    } catch (err) {
      console.warn('Error reading settings from Firestore:', err);
      return null;
    }
  },

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
