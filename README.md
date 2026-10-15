# 🚀 JobPulse — Application & Resume Performance Tracker (v3.0)

> **A modern, high-performance Job Application & Resume Tracker featuring a Notion/Vercel design aesthetic, powered by Google Cloud Firestore for real-time application persistence and local IndexedDB for 100% private resume file storage.**

[![Manifest V3](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-171717?style=flat-square&logo=googlechrome)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Cloud Firestore](https://img.shields.io/badge/Database-Cloud%20Firestore-f59e0b?style=flat-square&logo=firebase)](https://firebase.google.com/)
[![Resume Storage](https://img.shields.io/badge/Resumes-100%25%20Local%20IndexedDB-16a34a?style=flat-square)](https://github.com)
[![Vercel Hosted](https://img.shields.io/badge/Hosted%20On-Vercel-000000?style=flat-square&logo=vercel)](https://vercel.com)
[![License](https://img.shields.io/badge/License-MIT-7c3aed?style=flat-square)](LICENSE)

---

## 📑 Table of Contents

- [⚡ Overview & Architecture Highlights](#-overview--architecture-highlights)
- [✨ Core Capabilities](#-core-capabilities)
  - [1. Cloud Firestore for Applications & Settings](#1-cloud-firestore-for-applications--settings)
  - [2. 100% Local Resume Storage (IndexedDB)](#2-100-local-resume-storage-indexeddb)
  - [3. Unified Vercel Web Dashboard](#3-unified-vercel-web-dashboard)
  - [4. Inline PDF Viewer & Instant Download](#4-inline-pdf-viewer--instant-download)
  - [5. Resume Variant A/B Analytics](#5-resume-variant-ab-analytics)
  - [6. Auto-Scraping & Quick In-Page Tracker](#6-auto-scraping--quick-in-page-tracker)
  - [7. Interactive Kanban Pipeline & Table View](#7-interactive-kanban-pipeline--table-view)
- [🏗️ System Architecture & Storage Model](#️-system-architecture--storage-model)
  - [Storage Separation (Cloud Data vs. Local Resumes)](#storage-separation-cloud-data-vs-local-resumes)
  - [Directory Structure](#directory-structure)
  - [Data Schemas](#data-schemas)
- [🧭 End-to-End User Workflows](#-end-to-end-user-workflows)
  - [Workflow A: Capture with Toolbar Popup](#workflow-a-capture-with-toolbar-popup)
  - [Workflow B: In-Page Quick Floating Tracker](#workflow-b-in-page-quick-floating-tracker)
  - [Workflow C: Vercel Analytics Dashboard](#workflow-c-vercel-analytics-dashboard)
  - [Workflow D: Resume Library Management](#workflow-d-resume-library-management)
- [🛠️ Installation & Setup](#️-installation--setup)
- [☁️ Deploying to Vercel & Firebase Setup](#️-deploying-to-vercel--firebase-setup)
- [🔒 Privacy & Security Model](#-privacy--security-model)
- [💾 Backup & Export](#-backup--export)
- [❓ Frequently Asked Questions (FAQ)](#-frequently-asked-questions-faq)

---

## ⚡ Overview & Architecture Highlights

Applying to jobs across multiple platforms (LinkedIn, Indeed, company portals) often leads to disorganization. Candidates tailor different resumes for different roles and struggle to track which version was submitted or which version produces the best interview callback rates.

**JobPulse solves this with a clean, privacy-conscious hybrid architecture:**

1. **Cloud Firestore Persistence**: All application data, interview stages, and settings are saved directly to Google Cloud Firestore with real-time sync across devices. **Applications and settings are never persisted in local storage**, keeping your browser clean and multi-device access seamless.
2. **100% Local Resume Privacy**: Sensitive resume files (`.pdf`, `.docx`) are stored strictly inside your browser's local **IndexedDB** engine. Resumes never touch external servers or cloud storage.
3. **Unified Vercel Dashboard**: A single, beautifully crafted web dashboard hosted on Vercel with 1-click Google Sign-In and real-time bidirectional synchronization with the Chrome extension.

---

## ✨ Core Capabilities

### 1. Cloud Firestore for Applications & Settings

- **Real-Time Synchronized**: All job applications, status updates, interview dates, and custom skill keywords are saved directly to your Cloud Firestore database (`users/{uid}/applications`).
- **No Local Clutter**: Applications and settings are **not saved locally** in `localStorage` or `chrome.storage.local`. Real-time `onSnapshot` listeners keep the active tab state synchronized instantly.
- **Cross-Device Access**: Log in from your laptop, tablet, or phone to manage and review your pipeline anywhere.

### 2. 100% Local Resume Storage (IndexedDB)

- **Total File Sovereignty**: Resumes (`.pdf`, `.docx`, `.doc`, `.txt`) are converted into local binary blobs stored inside browser **IndexedDB** (`JobPulse_DB`).
- **Zero Cloud Upload**: Your resumes never leave your machine, preventing sensitive personal information (address, phone number, full work history) from being uploaded to external servers.
- **Auto-Cataloging**: When you attach or upload a resume while applying, JobPulse catalogs the variant into your local library, records file dimensions and MIME types, and links it to the application.

### 3. Unified Vercel Web Dashboard

- **Single Destination**: One unified dashboard hosted on your Vercel URL (`https://your-jobpulse.vercel.app`).
- **One-Click Extension Routing**: Clicking **Dashboard** in the Chrome extension popup takes you straight to your hosted Vercel dashboard. Any local extension page visits are automatically redirected to your Vercel instance.
- **Live 2-Way Extension Bridge**: An integrated bridge (`content/bridge.js`) connects the Chrome extension with your Vercel dashboard tab in real-time.

### 4. Inline PDF Viewer & Instant Download

- **Embedded PDF Previewer**: Click any resume badge on the dashboard or Kanban cards to launch an embedded modal previewer.
- **1-Click Download**: Download your original resume file with preserved filenames directly from:
  - Kanban board cards (`📄`)
  - Applications table rows
  - Application details modal
  - Resume Analytics library
- **Isolated Tab Preview**: Open documents in dedicated browser preview tabs via generated Blob URLs.

### 5. Resume Variant A/B Analytics

Track your resumes like marketing variants:

- **Callback Rate Formula**:
  $$\text{Callback Rate (\%)} = \left(\frac{\text{Screening} + \text{Interviewing} + \text{Offer}}{\text{Total Sent}}\right) \times 100$$
- **Best Performer Badge**: Automatically identifies your highest-converting resume variant once at least 2 applications are tracked.
- **Outcome Matrix**: Breakdown of callback percentages, interview loops, offers, and rejections per document variant.

### 6. Auto-Scraping & Quick In-Page Tracker

- **Toolbar Popup Scraper**: Detects active tab metadata across LinkedIn, Indeed, Glassdoor, Greenhouse, Lever, and Workday, pre-filling Job Title, Company, Location, and URL.
- **In-Page Floating Widget**: A sleek, non-intrusive floating `⚡ Track Job` button appears on supported job postings, letting you log roles without leaving the page.

### 7. Interactive Kanban Pipeline & Table View

- **Pipeline Stages**:
  - `📌 Wishlist` — Saved positions to research or apply for later.
  - `🚀 Applied` — Applications formally submitted.
  - `📞 Screening` — Phone screens or introductory chats.
  - `💼 Interviewing` — Technical, behavioral, or onsite rounds.
  - `🎉 Offer` — Written or verbal offers extended.
  - `❌ Rejected` — Archived rejections and unreturned ghosted applications.
- **Drag-and-Drop Kanban**: Drag cards between columns; JobPulse automatically appends timestamped status updates to the application audit timeline in Firestore.
- **Table View**: Quick filtering, keyword search, status dropdown modifications, and direct URL navigation.

---

## 🏗️ System Architecture & Storage Model

### Storage Separation (Cloud Data vs. Local Resumes)

```
┌────────────────────────────────────────────────────────────────────────┐
│                        JobPulse Hybrid Architecture                    │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
         ┌─────────────────────────┴─────────────────────────┐
         ▼                                                   ▼
┌─────────────────────────────────┐         ┌─────────────────────────────────┐
│     Cloud Firestore             │         │      Local Storage / IndexedDB  │
│  (Applications & Settings)      │         │      (Strictly Local Resumes)   │
├─────────────────────────────────┤         ├─────────────────────────────────┤
│ • users/{uid}/applications      │         │ • IndexedDB (JobPulse_DB)       │
│   - Real-time cloud sync        │         │   - Binary PDF/DOCX blob store  │
│ • users/{uid}/settings/general  │         │ • chrome.storage.local          │
│ • Zero local storage footprint  │         │   - jobpulse_resumes (metadata) │
│ • Cross-device synchronization  │         │ • 100% private document storage │
└─────────────────────────────────┘         └─────────────────────────────────┘
```

### Directory Structure

```
job-tracker/
├── manifest.json              # Chrome Manifest V3 configuration
├── vercel.json                # Vercel deployment routes & security headers
├── api/
│   └── firebase-config.js     # Serverless endpoint providing Firebase config
├── config/
│   ├── firebase-config.js     # Local Firebase credentials (Git Ignored)
│   └── firebase-config.example.js
├── utils/                     # Core services
│   ├── firebase-sync.js       # Cloud Firestore exclusive store & Google Auth
│   ├── storage.js             # Local resume store (IndexedDB) & data controller
│   ├── parser.js              # Multi-site DOM scraper (LinkedIn, Indeed, etc.)
│   ├── skills-matcher.js      # Keyword extraction & resume matching engine
│   └── calendar-service.js    # Google Calendar event generation
├── popup/                     # Toolbar extension popup
│   ├── popup.html             # Popup layout
│   ├── popup.css              # Dark/Light surfaces & typography
│   └── popup.js               # Auto-scraping & cloud submission controller
├── content/                   # Content scripts
│   ├── content.js             # In-page scraper & floating modal
│   ├── content.css            # Floating widget styles
│   └── bridge.js              # Extension <-> Vercel dashboard live bridge
├── background/                # Background service worker
│   └── service-worker.js      # Badge updates, alarms & dashboard routing
├── dashboard/                 # Analytics & Management Dashboard
│   ├── dashboard.html         # Overview, Kanban, Table, Resume Matrix
│   ├── dashboard.css          # Design system, cards, modals & animations
│   └── dashboard.js           # Drag-drop Kanban, charts, preview & sync
├── icons/                     # Extension icons (16, 32, 48, 128px)
└── README.md
```

### Data Schemas

#### 1. Job Application Object (Stored in Cloud Firestore)

```typescript
interface JobApplication {
  id: string;               // e.g. "job_1791877221043_dtf8i"
  title: string;            // e.g. "Senior Frontend Engineer"
  company: string;          // e.g. "Stripe"
  location: string;         // e.g. "Remote, US"
  url: string;              // e.g. "https://www.linkedin.com/jobs/view/..."
  platform: string;         // e.g. "LinkedIn", "Indeed", "Lever", "Direct"
  resumeId: string;         // e.g. "res_1" (links to local resume)
  resumeName: string;       // e.g. "Frontend_React_Specialist.pdf"
  resumeHasFile: boolean;   // true if local document is stored in IndexedDB
  status: 'wishlist' | 'applied' | 'screening' | 'interviewing' | 'offer' | 'rejected' | 'ghosted';
  appliedAt: string;        // ISO timestamp
  updatedAt: string;        // ISO timestamp
  salary: string;           // e.g. "$165,000 - $190,000"
  notes: string;            // Freeform interview notes & contact info
  contactName: string;      // Referral or company contact
  contactEmail: string;     // Contact email
  followUpDate: string;     // YYYY-MM-DD
  jobDescription: string;   // Full job description text
  timeline: Array<{
    status: string;
    date: string;
    note: string;
  }>;
}
```

#### 2. Resume File & Metadata (Stored Locally in IndexedDB)

```typescript
interface ResumeMetadata {
  id: string;               // e.g. "res_1"
  name: string;             // Variant name (e.g. "FullStack_Node_TypeScript.pdf")
  originalFileName: string; // Preserved file name for downloads
  fileType: string;         // MIME type ("application/pdf")
  fileSize: number;         // Size in bytes
  hasFile: boolean;         // true if file exists in IndexedDB
  isDefault: boolean;       // Pre-selected for new applications
  createdAt: string;        // ISO timestamp
  lastUsedAt?: string;      // ISO timestamp
}

interface StoredResumeFile {
  id: string;               // Foreign key matching ResumeMetadata.id
  name: string;
  originalFileName: string;
  fileType: string;
  fileSize: number;
  dataUrl: string;          // Base64 data URL for instant viewing
  uploadedAt: string;
}
```

---

## 🧭 End-to-End User Workflows

### Workflow A: Capture with Toolbar Popup

```
[Job Page] ──> [Click Extension Icon] ──> [Auto-Scraped Role & Company]
                                                │
                ┌───────────────────────────────┴───────────────────────────────┐
                ▼                                                               ▼
        [Mode: Saved]                                                   [Mode: Upload]
     Select existing resume                                          Drag & drop PDF / DOCX
                │                                                               │
                └───────────────────────────────┬───────────────────────────────┘
                                                ▼
                                     [Click Save Application]
                                                │
                                     ├── Application saved to Firestore
                                     ├── Resume file saved to IndexedDB
                                     └── Badge counter updated in real-time
```

1. Navigate to any job posting (e.g., LinkedIn or Indeed).
2. Click the **JobPulse** extension icon in your Chrome toolbar.
3. Review the automatically extracted **Title**, **Company**, and **URL**.
4. Choose an existing resume variant or drop in a new tailored PDF.
5. Click **Save Application**. The application is committed directly to Cloud Firestore, and the resume is stored locally.

### Workflow B: In-Page Quick Floating Tracker

1. Browse directly on **LinkedIn**, **Indeed**, **Lever**, **Greenhouse**, or **Workday**.
2. Click the floating **⚡ Track Job** button in the lower-right corner.
3. Select your resume, verify the extracted details, and click **Save Application**.

### Workflow C: Vercel Analytics Dashboard

1. Click **Dashboard** in the extension popup to open your hosted Vercel dashboard.
2. Sign in with Google to sync your Cloud Firestore applications across all your devices.
3. Manage applications using the drag-and-drop Kanban board or tabular view.
4. Click any resume tag to preview or download the associated local PDF.

### Workflow D: Resume Library Management

1. Open the **Resume Analytics** tab in the sidebar.
2. Click **⬆ Upload resume** to add new resumes.
3. Preview, download, set default, or inspect response rates for each document variant.

---

## 🛠️ Installation & Setup

1. Open **Google Chrome** and navigate to `chrome://extensions/`.
2. Enable **Developer mode** in the top-right corner.
3. Click **Load unpacked** in the top-left corner.
4. Select the project directory:
   ```text
   c:\Users\theal\OneDrive\Desktop\job tracker
   ```
5. Click the puzzle icon (🧩) and pin **JobPulse** to your toolbar.

---

## ☁️ Deploying to Vercel & Firebase Setup

### 1. Deploying the Dashboard to Vercel

1. Push your repository to GitHub:
   ```bash
   git push origin main
   ```
2. In [Vercel](https://vercel.com), import your repository with default settings.
3. Click **Deploy**.

### 2. Configure Firebase Cloud Firestore

In your Vercel Project Settings → **Environment Variables**, add the values from your `.env` file:

| Environment Variable | Description |
| :--- | :--- |
| `FIREBASE_API_KEY` | Firebase Web API Key |
| `FIREBASE_AUTH_DOMAIN` | `your-project.firebaseapp.com` |
| `FIREBASE_PROJECT_ID` | `your-project-id` |
| `FIREBASE_STORAGE_BUCKET` | `your-project.firebasestorage.app` |
| `FIREBASE_MESSAGING_SENDER_ID` | Messaging Sender ID |
| `FIREBASE_APP_ID` | Web App ID |
| `FIREBASE_MEASUREMENT_ID` | Google Analytics ID |

> [!IMPORTANT]
> **Firebase Authorized Domain**: In [Firebase Console](https://console.firebase.google.com/) → **Authentication** → **Settings** → **Authorized domains**, add your Vercel deployment domain (e.g., `*.vercel.app` or your custom domain).

---

## 🔒 Privacy & Security Model

- **Zero Cloud Leakage for Resumes**: Your resumes, which contain your home address, phone number, and detailed history, are stored 100% locally in your browser's private IndexedDB.
- **Clean Local Footprint**: Job application records and settings are stored directly in Cloud Firestore and are not kept in browser `localStorage`.
- **Manifest V3 Compliant**: Uses standard MV3 service workers and local storage mechanisms with zero dynamic remote code evaluation (`eval`).

---

## 💾 Backup & Export

- **CSV Export**: Click `•••` in the dashboard topbar → **Export CSV** to generate a spreadsheet-ready file with position, company, status, salary, and contact notes.
- **Full JSON Backup**: Click `•••` → **Export JSON backup** to download a single file containing all application records, resume variant metadata, and the Base64 payloads of your local resume files.
- **1-Click Restore**: Click `•••` → **Import backup** to restore your pipeline and resume documents on any new computer.

---

## ❓ Frequently Asked Questions (FAQ)

<details>
<summary><strong>Where are my applications stored?</strong></summary>

All job applications and settings are stored in **Google Cloud Firestore** under your secure user profile (`users/{uid}/applications`). They are not stored in local browser storage, allowing you to access them from any device.
</details>

<details>
<summary><strong>Where are my resume files stored?</strong></summary>

All resume PDF and DOCX files are stored **100% locally** on your device in **IndexedDB** (`JobPulse_DB`). They never leave your machine or get uploaded to cloud servers.
</details>

<details>
<summary><strong>Why does the extension open the Vercel dashboard?</strong></summary>

The Vercel-hosted dashboard runs over HTTPS, which enables secure 1-click Google Sign-In and allows you to access your dashboard from any computer or mobile browser. The Chrome extension bridge automatically keeps your active browser session in sync with the Vercel dashboard.
</details>

---

## 📄 License

JobPulse is open-source software licensed under the [MIT License](LICENSE).
