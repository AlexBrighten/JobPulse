# 🚀 JobPulse — Application & Resume Performance Tracker (v2.0)

> **A minimal, high-performance Chrome Extension (Manifest V3) crafted with a Notion & Vercel-inspired design aesthetic.** Track job applications across the web, tag the exact resume variant used for each submission, and analyze which resumes drive the highest interview callback rates.

---

## ⚡ What Makes JobPulse Special?

Job searches are often fragmented and disorganized across dozens of job portals. JobPulse solves this with seamless in-browser capture and actionable analytics:

1. **📄 Local Resume File Upload & Storage**: Upload your actual resume files (PDF, DOCX, DOC) right when applying for a job. Files are stored 100% locally on your machine via IndexedDB & Chrome Local Storage with `unlimitedStorage` permissions.
2. **👁️ Inline PDF Viewer & Instant Download**: Preview your submitted resumes inside the embedded viewer or download the exact resume variant used for any application with 1 click.
3. **📊 Resume Variant A/B Analytics**: Tag every submission with tailored resumes (e.g. `Frontend_React_v2.pdf`, `FullStack_TypeScript.pdf`, `General_SWE.pdf`). JobPulse calculates callback rates and highlights your best-performing resume.
4. **⚡ Instant 1-Click Auto-Capture**: Automatically scrapes Job Title, Company Name, Location, and URL from supported job boards (**LinkedIn, Indeed, Glassdoor, Lever, Greenhouse, Workday**, and company portals).
5. **🪄 In-Page Quick Floating Tracker**: A floating, non-intrusive `⚡ Track Job` widget directly on job pages lets you save applications and upload resumes without switching tabs.
6. **🎨 Notion & Vercel Design Language**: Clean monochrome surfaces, `Inter` typography, subtle 1px border lines, tabular metrics, and understated semantic badges.
7. **📋 Drag-and-Drop Kanban Pipeline**: Move applications visually through stages (*Wishlist → Applied → Screening → Interviewing → Offer → Rejected*).
8. **📊 Real-Time Analytics & Funnel Charts**:
   - **Top KPI Cards**: Total applied, callbacks received, overall response rate (%), active interview loops, and job offers.
   - **Pipeline Breakdown**: Dynamic SVG donut chart with interactive stage counts.
   - **Resume Conversion Matrix**: Direct comparison of callback rates, rejections, and conversion percentages.
   - **Search & Filter Table**: Filter by status or resume variant, search in real-time, and update statuses inline.
9. **🔒 100% Private & Local**: All application records and resume documents remain exclusively on your device. Zero external servers or telemetry.
10. **💾 CSV & JSON Data Management**: 1-click export to spreadsheet-ready CSV, JSON backup creation (including stored resume documents), and full JSON restore.

---

## 🛠️ Installation & Setup (Chrome Manifest V3)

Installing JobPulse takes less than 30 seconds:

1. Open **Google Chrome** and navigate to:
   ```text
   chrome://extensions/
   ```
2. In the top-right corner, switch on **Developer mode**.
3. In the top-left corner, click **Load unpacked**.
4. Select the project directory:
   ```text
   c:\Users\theal\OneDrive\Desktop\job tracker
   ```
5. Click **Select Folder**. The **JobPulse** extension icon will appear in your Chrome toolbar.
6. *(Recommended)* Click the Chrome puzzle piece icon and click the pin icon next to **JobPulse** to keep it accessible.

---

## 🧭 How to Use JobPulse

### 1. Capturing Applications & Uploading Resumes while Browsing
- When viewing a job listing on **LinkedIn**, **Indeed**, **Lever**, **Greenhouse**, or **Workday**:
  - Click the **JobPulse extension icon** in your toolbar.
  - The job title, company name, location, and URL are automatically pre-filled!
  - Under **Resume Used**:
    - Choose an already saved resume, OR
    - Click **⬆ Upload** and drag & drop / choose your tailored resume file (`.pdf`, `.docx`, etc.). The file is automatically stored in local storage and linked to this job application.
  - Select your starting status (*Applied*, *Wishlist*, etc.) and click **Save Application**.
- On supported career pages, you can also click the floating **⚡ Track Job** button in the lower-right corner to save and upload your resume directly in-page.

### 2. Managing Your Pipeline & Viewing Stored Resumes on the Dashboard
- Click **Dashboard** in the extension popup (or right-click the extension icon and select **Options**).
- **Overview**: View your top-line KPI metrics, application funnel donut chart, resume conversion bars, and recent activity log. Click any resume badge to preview or download the file.
- **Applications Tab**:
  - **Board View**: Drag and drop cards across pipeline stages (*Wishlist, Applied, Screening, Interviewing, Offer, Rejected*). Click the resume tag on any card to preview/download.
  - **Table View**: Search positions or companies, filter by resume variant, download attached resumes, and change statuses directly from inline dropdowns.
- **Resume Analytics Tab**:
  - Click **⬆ Upload resume** to add new resume files directly to your local library.
  - Compare callback conversion rates across resume variants.
  - Preview stored PDFs with the built-in viewer, download files, or attach files to existing text variants.
- **Sample Data**: Click **Load sample data** in the sidebar to populate realistic applications pre-loaded with downloadable sample resume PDFs.

---

## 🏗️ Project Architecture

```
job-tracker/
├── manifest.json              # Chrome Manifest V3 configuration
├── icons/                     # Extension branding icons (16, 32, 48, 128px)
├── popup/                     # Toolbar Extension Popup (Notion/Vercel UI)
│   ├── popup.html             # Compact submission form & live mini-stats
│   ├── popup.css              # Clean monochrome surfaces & Inter font styling
│   └── popup.js               # Scraper trigger, resume manager & quick save
├── content/                   # In-Page Content Scripts
│   ├── content.js             # Job board DOM extractor & floating widget
│   └── content.css            # Floating badge & quick modal styles
├── background/                # Chrome Service Worker
│   └── service-worker.js      # Badge text updates & keyboard shortcut handlers
├── dashboard/                 # Full Analytics & Management Dashboard
│   ├── dashboard.html         # Overview, Kanban board, and Resume matrix views
│   ├── dashboard.css          # Design system: CSS tokens, cards, and tables
│   └── dashboard.js           # Drag-and-drop Kanban, SVG charts, and CSV/JSON export
├── utils/                     # Shared Core Utilities
│   ├── storage.js             # Chrome Storage wrapper, schema & sample data
│   └── parser.js              # Multi-site parser (LinkedIn, Indeed, Lever, etc.)
└── README.md                  # Comprehensive setup & user documentation
```

---

## 💾 Data Backup & Privacy

- All application data and resume metadata are stored strictly in your browser (`chrome.storage.local`).
- To export your records to Excel or Google Sheets, click the `•••` menu in the dashboard topbar and select **Export CSV**.
- To create a backup or migrate machines, select **Export JSON backup** and reload it anytime with **Import backup**.
