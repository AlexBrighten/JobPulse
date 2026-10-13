# 🚀 JobPulse — Application & Resume Performance Tracker (v2.0)

> **A private, high-performance Chrome Extension (Manifest V3) crafted with a Notion & Vercel-inspired design language.** Track job applications across the web, upload and store your tailored resume files locally, and analyze which resume variants yield the highest interview callback rates.

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-171717?style=flat-square&logo=googlechrome)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Privacy](https://img.shields.io/badge/Storage-100%25%20Local-16a34a?style=flat-square)](https://github.com)
[![IndexedDB](https://img.shields.io/badge/Resume%20Storage-IndexedDB%20%2B%20Local-2563eb?style=flat-square)](https://github.com)
[![License](https://img.shields.io/badge/License-MIT-7c3aed?style=flat-square)](LICENSE)

---

## 📑 Table of Contents

- [⚡ Overview & Key Highlights](#-overview--key-highlights)
- [✨ Core Capabilities](#-core-capabilities)
  - [1. Local Resume Upload & Dual-Layer Persistence](#1-local-resume-upload--dual-layer-persistence)
  - [2. Inline PDF Viewer & Instant Download](#2-inline-pdf-viewer--instant-download)
  - [3. Resume Variant A/B Analytics](#3-resume-variant-ab-analytics)
  - [4. Auto-Scraping & In-Page Quick Tracker](#4-auto-scraping--in-page-quick-tracker)
  - [5. Visual Kanban Pipeline & Table View](#5-visual-kanban-pipeline--table-view)
  - [6. Real-Time Pipeline Analytics & SVG Charts](#6-real-time-pipeline-analytics--svg-charts)
- [🧭 End-to-End User Workflows](#-end-to-end-user-workflows)
  - [Workflow A: Capture with Toolbar Popup](#workflow-a-capture-with-toolbar-popup)
  - [Workflow B: In-Page Quick Floating Tracker](#workflow-b-in-page-quick-floating-tracker)
  - [Workflow C: Dashboard Application Management](#workflow-c-dashboard-application-management)
  - [Workflow D: Resume Library & File Management](#workflow-d-resume-library--file-management)
- [🏗️ System Architecture & Data Model](#️-system-architecture--data-model)
  - [Directory Structure](#directory-structure)
  - [Storage Architecture](#storage-architecture)
  - [Data Schemas](#data-schemas)
- [🌐 Supported Job Portals & Scraping Selectors](#-supported-job-portals--scraping-selectors)
- [🛠️ Installation & Setup (Chrome Manifest V3)](#️-installation--setup-chrome-manifest-v3)
- [🔒 Privacy, Security & Data Sovereignty](#-privacy-security--data-sovereignty)
- [💾 Backup, Export & Migration](#-backup-export--migration)
- [❓ Frequently Asked Questions (FAQ)](#-frequently-asked-questions-faq)

---

## ⚡ Overview & Key Highlights

Job hunts are typically disorganized: candidates tailor distinct resumes for different roles, apply across dozens of portals (LinkedIn, Indeed, company career pages), and lose track of which specific PDF was submitted where.

**JobPulse** solves this fragmentation entirely within your browser:

- **Upload & Store Local Resumes**: Attach your actual resume file (`.pdf`, `.docx`, `.doc`, `.txt`) whenever submitting an application. The document is converted and persisted directly on your local device.
- **Zero External Servers**: No third-party APIs, no telemetry, no subscription paywalls, and no tracking cookies. All records live strictly in browser-sandboxed local storage (`chrome.storage.local` + `IndexedDB`).
- **A/B Performance Insights**: Learn which tailored resume version generates the highest response rate (*Callbacks ÷ Total Sent*), turning your job search into an empirical, data-driven pipeline.
- **Embedded PDF Preview**: Inspect past submissions directly inside an inline viewer without searching through your hard drive downloads.

---

## ✨ Core Capabilities

### 1. Local Resume Upload & Dual-Layer Persistence

When applying for any role, JobPulse lets you either select a pre-saved resume variant or upload a new file on the fly:

- **Supported File Types**: `.pdf`, `.docx`, `.doc`, `.txt`, `.rtf` (up to 20MB per document).
- **Dual-Layer Architecture**:
  - **IndexedDB (`JobPulse_DB`)**: Fast, asynchronous binary blob and Base64 storage engine that circumvents standard `localStorage` limits.
  - **Chrome Local Storage Mirror**: Stored with `unlimitedStorage` manifest permissions so you can safely retain hundreds of resume versions without quota restrictions.
- **Auto-Cataloging**: When you upload a resume during job creation, JobPulse stores the file, creates a reusable entry in your Resume Library, records file dimensions and MIME types, and links the application ID.

### 2. Inline PDF Viewer & Instant Download

Never wonder *"Which resume did I send to this company?"* again:

- **Built-in PDF Viewer**: Click any resume badge on the dashboard or Kanban board to launch an embedded modal previewer.
- **1-Click Download**: Download the original file with its preserved filename from:
  - The Kanban board card tags (`📄`)
  - The Applications table row action buttons
  - The Application Details modal
  - The Resume Analytics breakdown matrix
- **New-Tab Preview**: Open documents in an isolated browser preview tab via generated Blob URLs.

### 3. Resume Variant A/B Analytics

Track your resumes like marketing variants:

- **Callback Rate Formula**:
  $$\text{Callback Rate (\%)} = \left(\frac{\text{Screening} + \text{Interviewing} + \text{Offer}}{\text{Total Sent}}\right) \times 100$$
- **Best Performer Highlight**: Automatically awards a **Best Performer** badge to your highest-converting resume variant (calculated once at least 2 submissions are tracked).
- **Outcome Matrix**: Breakdown of callback percentages, explicit rejections, active interview loops, and final offers per document variant.

### 4. Auto-Scraping & In-Page Quick Tracker

Capture job postings effortlessly without manual copy-pasting:

- **Toolbar Popup Scraper**: Reads tab metadata and DOM elements from supported platforms, pre-populating Job Title, Company, Location, and URL.
- **In-Page Floating Widget**: A clean, non-intrusive `⚡ Track Job` button appears on job listing pages (LinkedIn, Indeed, Greenhouse, Lever, etc.). Clicking it opens an in-page modal where you can select or upload a resume and save in one click.

### 5. Visual Kanban Pipeline & Table View

Manage your pipeline across standard recruiting stages:

- **Pipeline Stages**:
  - `📌 Wishlist` — Saved positions to research or apply for later.
  - `🚀 Applied` — Applications formally submitted.
  - `📞 Screening` — Recruiter phone screens or introductory chats.
  - `💼 Interviewing` — Technical, behavioral, or onsite rounds.
  - `🎉 Offer` — Written or verbal offers extended.
  - `❌ Rejected` — Archived rejections and unreturned ghosted applications.
- **Interactive Drag-and-Drop**: Drag cards between columns; JobPulse automatically appends timestamped status updates to the application's audit timeline.
- **Table View**: Quick-filtering by status, search by role or company, inline status dropdown modifications, and direct link navigation.

### 6. Real-Time Pipeline Analytics & SVG Charts

- **Top KPI Cards**: Total applied, total callbacks, response rate percentage, active interview loops, and total offers.
- **Dynamic Donut Funnel**: Pure SVG multi-segment donut chart reflecting live stage counts and proportions.
- **Comparative Bar Charts**: Visual progress bars showing response rate comparisons across resume versions.

---

## 🧭 End-to-End User Workflows

### Workflow A: Capture with Toolbar Popup

```
[Job Page] ──> [Click Extension Icon] ──> [Auto-Scraped Info]
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
                                    ├── Resume stored locally
                                    ├── Linked to application
                                    └── Badge counter updated
```

1. Navigate to any job posting (e.g. on LinkedIn or Indeed).
2. Click the **JobPulse** icon in your Chrome toolbar.
3. Verify the pre-populated **Job Title**, **Company**, and **URL**.
4. In the **Resume Used** section:
   - **Saved Mode**: Select an existing resume variant from the dropdown. If a file is stored locally, a `Stored locally (size)` chip with a quick download link appears.
   - **Upload Mode**: Toggle to `⬆ Upload`, drop or browse your tailored resume (`.pdf`, `.docx`), and optionally tick *Set as default resume*.
5. Select the initial status (`Applied`, `Wishlist`, etc.) and click **Save Application**.
6. A confirmation toast appears: `✓ Applied to [Company] & resume stored locally!`.

---

### Workflow B: In-Page Quick Floating Tracker

1. Browse directly on **LinkedIn**, **Indeed**, **Lever**, **Greenhouse**, or **Workday**.
2. Notice the sleek floating **⚡ Track Job** button in the lower-right corner.
3. Click it to open the in-page quick drawer without leaving your tab.
4. Toggle between `Saved` or `⬆ Upload`, choose your resume, and click **Save Application**.

---

### Workflow C: Dashboard Application Management

1. Open the Dashboard by clicking **Dashboard** in the extension popup or by visiting:
   ```text
   chrome-extension://<EXTENSION_ID>/dashboard/dashboard.html
   ```
2. **Overview**: Monitor your pipeline breakdown donut, callback metrics, and recent activity.
3. **Applications Tab**:
   - Toggle between **Board View** (Kanban) and **Table View**.
   - Search applications by keyword, filter by status, or filter by specific resume variant.
   - Click any card to open the **Application Details** modal to edit notes, salary, recruiter contact info, and view the chronological audit timeline.
   - Click the `📄 [Resume Name]` tag on any card or table row to open the embedded **Resume Preview Modal**.

---

### Workflow D: Resume Library & File Management

1. Switch to the **Resume Analytics** tab in the sidebar.
2. Click **⬆ Upload resume** to add new resumes to your library.
3. Drag and drop any `.pdf`, `.docx`, or `.doc` file. JobPulse automatically pre-fills the variant name with the file name.
4. On any resume card:
   - **View / Download**: Opens the embedded PDF previewer or downloads the file.
   - **Attach file**: Attach an actual document to an existing text-only variant.
   - **Set default**: Mark which resume is pre-selected for new applications.
   - **Delete**: Cleans up the variant record and purges its stored binary data from local storage.

---

## 🏗️ System Architecture & Data Model

### Directory Structure

```
job-tracker/
├── manifest.json              # Chrome Manifest V3 configuration & permissions
├── icons/                     # Extension icons (16, 32, 48, 128px)
├── utils/                     # Shared core utilities & storage engine
│   ├── storage.js             # Dual-layer storage (IndexedDB + chrome.storage), schema & sample generator
│   └── parser.js              # Multi-site DOM scraper (LinkedIn, Indeed, Lever, Greenhouse, etc.)
├── popup/                     # Toolbar extension popup (Notion/Vercel aesthetic)
│   ├── popup.html             # Popup layout with segmented resume uploader
│   ├── popup.css              # Clean monochrome surfaces, typography & dropzone styling
│   └── popup.js               # Tab scraper hook, file reader & quick save controller
├── content/                   # In-page content scripts & floating widget
│   ├── content.js             # DOM extractor & floating quick modal
│   └── content.css            # Floating badge & quick modal styles
├── background/                # Chrome Service Worker
│   └── service-worker.js      # Badge text sync & tab communication handlers
├── dashboard/                 # Full Analytics & Management Dashboard
│   ├── dashboard.html         # Overview, Kanban board, Resume matrix & Preview modal
│   ├── dashboard.css          # Design system: CSS variables, modals, cards, and tables
│   └── dashboard.js           # Drag-and-drop Kanban, SVG charts, PDF previewer & CSV/JSON export
├── generate_icons.js          # Standalone icon generator
└── README.md                  # Comprehensive documentation
```

### Storage Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        JobPulse Storage Engine                         │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
         ┌─────────────────────────┴─────────────────────────┐
         ▼                                                   ▼
┌─────────────────────────────────┐         ┌─────────────────────────────────┐
│     chrome.storage.local        │         │      IndexedDB (JobPulse_DB)    │
│    (Metadata & Application)     │         │       (Binary Document Store)   │
├─────────────────────────────────┤         ├─────────────────────────────────┤
│ • jobpulse_applications (Array) │         │ • ObjectStore: resume_files     │
│ • jobpulse_resumes (Metadata)   │         │   - Key: resume_id              │
│ • jobpulse_settings             │         │   - Data: Base64 / Blob payload │
│ • unlimitedStorage permission   │         │   - Fast random access reads    │
└─────────────────────────────────┘         └─────────────────────────────────┘
```

### Data Schemas

#### 1. Job Application Object (`jobpulse_applications`)

```typescript
interface JobApplication {
  id: string;               // e.g. "job_1791877221043_dtf8i"
  title: string;            // e.g. "Senior Frontend Engineer"
  company: string;          // e.g. "Stripe"
  location: string;         // e.g. "Remote, US"
  url: string;              // e.g. "https://www.linkedin.com/jobs/view/..."
  platform: string;         // e.g. "LinkedIn", "Indeed", "Lever", "Direct"
  resumeId: string;         // e.g. "res_1" (foreign key to resume)
  resumeName: string;       // e.g. "Frontend_React_Specialist.pdf"
  resumeHasFile: boolean;   // true if local file is persisted
  status: 'wishlist' | 'applied' | 'screening' | 'interviewing' | 'offer' | 'rejected' | 'ghosted';
  appliedAt: string;        // ISO timestamp
  updatedAt: string;        // ISO timestamp
  salary: string;           // e.g. "$165,000 - $190,000"
  notes: string;            // Freeform recruiter & interview notes
  contactName: string;      // Recruiter or referral contact
  contactEmail: string;     // Recruiter email
  followUpDate: string;     // YYYY-MM-DD
  timeline: Array<{
    status: string;
    date: string;
    note: string;
  }>;
}
```

#### 2. Resume Variant Metadata (`jobpulse_resumes`)

```typescript
interface ResumeMetadata {
  id: string;               // e.g. "res_1791877247413_xufm"
  name: string;             // Display name (e.g. "Alex_FullStack_2026.pdf")
  originalFileName: string; // Original uploaded file name
  fileType: string;         // MIME type (e.g. "application/pdf")
  fileSize: number;         // Size in bytes (e.g. 142000)
  hasFile: boolean;         // true if document is stored in local store
  isDefault: boolean;       // Pre-selected for new applications
  createdAt: string;        // ISO timestamp
  lastUsedAt?: string;      // ISO timestamp
}
```

#### 3. Stored Resume File Record (`resume_files` Store)

```typescript
interface StoredResumeFile {
  id: string;               // Matches ResumeMetadata.id
  name: string;             // Document name
  originalFileName: string; // Preserved file name for downloads
  fileType: string;         // e.g. "application/pdf"
  fileSize: number;         // Size in bytes
  dataUrl: string;          // "data:application/pdf;base64,JVBERi0xLjQK..."
  uploadedAt: string;       // ISO timestamp
}
```

---

## 🌐 Supported Job Portals & Scraping Selectors

JobPulse automatically extracts job details from top career platforms:

| Platform | Domain Match | Target Extractors |
| :--- | :--- | :--- |
| **LinkedIn** | `linkedin.com` | `.job-details-jobs-unified-top-card__job-title`, `.jobs-unified-top-card__company-name`, Primary location tags |
| **Indeed** | `indeed.com` | `h1.jobsearch-JobInfoHeader-title`, `[data-testid="inlineHeader-companyName"]`, Company location |
| **Glassdoor** | `glassdoor.com` | `[data-test="job-title"]`, `[data-test="employer-name"]`, `[data-test="location"]` |
| **Lever** | `jobs.lever.co` | `.posting-headline h2`, `.posting-categories`, `.location` |
| **Greenhouse** | `boards.greenhouse.io` | `.app-title`, `.company-name`, `.location` |
| **Workday** | `*.myworkdayjobs.com` | `[data-automation-id="jobPostingHeader"]`, `[data-automation-id="locations"]` |
| **Wellfound (AngelList)** | `wellfound.com` | `h1.text-xl`, `.company-header-title` |
| **Direct / Company Sites** | Generic | `<title>` heuristic parsing (`Position at Company` / `Position - Company`), OpenGraph `og:title` |

---

## 🛠️ Installation & Setup (Chrome Manifest V3)

Setting up JobPulse takes less than 30 seconds:

1. Open **Google Chrome** and navigate to:
   ```text
   chrome://extensions/
   ```
2. In the top-right corner, enable **Developer mode**.
3. In the top-left corner, click **Load unpacked**.
4. Select the project directory:
   ```text
   c:\Users\theal\OneDrive\Desktop\job tracker
   ```
5. Click **Select Folder**. The **JobPulse** extension icon will appear in your toolbar.
6. *(Recommended)* Click the Chrome puzzle icon (🧩) and pin **JobPulse** to keep it accessible.
7. *(Testing immediately)* Open the Dashboard, click **Load sample data** in the bottom-left sidebar, and test the Kanban board, PDF viewer, and analytics with realistic demo applications!

---

## 🔒 Privacy, Security & Data Sovereignty

- **No Remote Servers**: JobPulse operates exclusively as a client-side application. No data ever leaves your device.
- **No Third-Party Analytics**: No Google Analytics, no telemetry, no tracking pixels, and no external trackers.
- **Zero Cloud Leakage**: Your sensitive documents (resumes, salaries, recruiter contacts, personal notes) are stored strictly inside your browser's private sandbox.
- **Manifest V3 Compliant**: Uses standard Manifest V3 service workers and local storage mechanisms with zero insecure `eval()` or remote script loading.

---

## 💾 Backup, Export & Migration

Keep full ownership of your data with built-in export and import tools:

- **Spreadsheet-Ready CSV Export**:
  - Click `•••` in the dashboard topbar → **Export CSV**.
  - Generates a formatted CSV file containing Position, Company, Location, Platform, Resume Used, Local File Attachment status, Status, Salary, URL, Recruiter Contacts, and Notes.
- **Complete JSON Backup (with Stored Resumes)**:
  - Click `•••` → **Export JSON backup**.
  - Generates a full `jobpulse_full_backup_YYYY-MM-DD.json` containing all application records, resume variant metadata, and the complete binary data for all stored resume files.
- **1-Click Restore**:
  - Click `•••` → **Import backup** and select your `.json` file to restore your entire pipeline and resume library on a new computer or clean browser profile.

---

## ❓ Frequently Asked Questions (FAQ)

<details>
<summary><strong>Where are my uploaded resume files saved?</strong></summary>

All resume documents are stored locally in your browser's **IndexedDB** database (`JobPulse_DB` under the `resume_files` store) and mirrored in `chrome.storage.local`. They never leave your machine.
</details>

<details>
<summary><strong>What happens if I apply with the same resume multiple times?</strong></summary>

JobPulse catalogs your resume into your Resume Library. When applying for subsequent roles, simply choose it from the **Saved** dropdown. All applications link to the same variant ID, allowing JobPulse to calculate aggregate callback rates.
</details>

<details>
<summary><strong>Is there a limit on how many resumes or applications I can save?</strong></summary>

No! JobPulse declares the `unlimitedStorage` permission in its Chrome Manifest V3 configuration, which removes Chrome's standard 10MB quota for local extension storage. You can store hundreds of PDF resumes and thousands of applications.
</details>

<details>
<summary><strong>Can I open the Dashboard without clicking the extension popup?</strong></summary>

Yes! Right-click the extension icon in Chrome and select **Options**, or bookmark `dashboard/dashboard.html` directly in your browser.
</details>

<details>
<summary><strong>How do I migrate my job tracker to another machine?</strong></summary>

Click the `•••` menu in the dashboard topbar, select **Export JSON backup**, transfer the file to your other computer, open JobPulse, and select **Import backup**. All your applications, timelines, and resume PDFs will be restored instantly.
</details>

---

## 📄 License

JobPulse is open-source software licensed under the [MIT License](LICENSE).
