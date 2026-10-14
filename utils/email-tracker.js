// utils/email-tracker.js — Recruiter Email Intelligence & Status Tracking Engine
// Detects replies from applied companies, identifies interview/offer/rejection notices,
// and recommends 1-click board status updates.

const EmailTracker = {
  // Classification rules for recruiter communications
  PATTERNS: {
    offer: [
      /congratulations.*offer/i,
      /offer\s+(of\s+employment|letter|details)/i,
      /pleased\s+to\s+offer/i,
      /delighted\s+to\s+offer/i,
      /extend\s+(an|our)\s+offer/i,
      /welcome\s+to\s+(the\s+team|company)/i
    ],
    interviewing: [
      /interview/i,
      /schedule\s+(a\s+time|a\s+call|an\s+interview|a\s+chat)/i,
      /availability\s+(for\s+a\s+call|this\s+week|next\s+week)/i,
      /phone\s+(screen|interview|chat)/i,
      /technical\s+(round|screen|interview|assessment)/i,
      /hiring\s+manager\s+(round|chat|interview)/i,
      /onsite\s+interview/i,
      /take[\s-]home\s+(assignment|test|project)/i,
      /hackerrank|coderpad|codesignal/i,
      /calendly\.com|goodtime\.io/i,
      /next\s+round/i
    ],
    screening: [
      /reviewing\s+your\s+application/i,
      /shortlisted/i,
      /quick\s+phone\s+call/i,
      /recruiter\s+call/i,
      /next\s+steps/i,
      /tell\s+us\s+more\s+about\s+yourself/i
    ],
    rejected: [
      /unfortunately/i,
      /other\s+candidates/i,
      /not\s+moving\s+forward/i,
      /decided\s+to\s+(pursue|proceed\s+with)\s+other/i,
      /will\s+not\s+be\s+moving\s+forward/i,
      /regret\s+to\s+inform/i,
      /position\s+has\s+been\s+filled/i,
      /not\s+selected/i,
      /keep\s+your\s+resume\s+on\s+file/i
    ]
  },

  /**
   * Analyze raw email text (subject + body) against tracked applications.
   * @param {string} emailText - Subject and body of the recruiter email
   * @param {Array} jobs - List of tracked job applications
   * @param {string} sender - Email address or sender name
   * @returns {{ detectedCompany: string, jobId: string, suggestedStatus: string, confidence: number, summary: string, matchedQuotes: string[] }}
   */
  classifyEmail(emailText = '', jobs = [], sender = '') {
    if (!emailText) return null;

    const fullText = (sender + ' ' + emailText).trim();
    let bestJob = null;
    let maxCompanyScore = 0;

    // 1. Identify which applied company this email is from
    for (const job of jobs) {
      if (!job.company) continue;
      const compName = job.company.toLowerCase().trim();
      if (!compName) continue;

      let score = 0;
      // Exact word match
      const regex = new RegExp(`\\b${compName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(fullText)) {
        score += 10;
      } else if (fullText.toLowerCase().includes(compName)) {
        score += 5;
      }

      // Check if contact name or email matches
      if (job.contactName && fullText.toLowerCase().includes(job.contactName.toLowerCase())) {
        score += 8;
      }
      if (job.contactEmail && sender.toLowerCase().includes(job.contactEmail.toLowerCase())) {
        score += 15;
      }

      if (score > maxCompanyScore) {
        maxCompanyScore = score;
        bestJob = job;
      }
    }

    // 2. Classify status & sentiment
    let detectedStatus = null;
    let matchedQuotes = [];

    // Check categories in priority order: offer > rejected > interviewing > screening
    for (const status of ['offer', 'rejected', 'interviewing', 'screening']) {
      const patterns = this.PATTERNS[status];
      for (const pattern of patterns) {
        const match = fullText.match(pattern);
        if (match) {
          detectedStatus = status;
          matchedQuotes.push(match[0]);
          break;
        }
      }
      if (detectedStatus) break;
    }

    let confidence = 0.5;
    if (bestJob && detectedStatus) {
      confidence = 0.95;
    } else if (bestJob || detectedStatus) {
      confidence = 0.7;
    }

    const statusLabels = {
      offer: 'Offer Extended 🎉',
      interviewing: 'Interview Scheduled / Next Round 💼',
      screening: 'Recruiter Screening 📞',
      rejected: 'Application Not Moving Forward ❌'
    };

    let summary = '';
    if (bestJob && detectedStatus) {
      summary = `Detected communication from ${bestJob.company}: ${statusLabels[detectedStatus] || detectedStatus}`;
    } else if (bestJob) {
      summary = `Communication from ${bestJob.company} (Status unclear)`;
    } else if (detectedStatus) {
      summary = `Recruiter email detected: ${statusLabels[detectedStatus] || detectedStatus} (Company not matched)`;
    } else {
      summary = `Email received — no status change detected`;
    }

    return {
      detectedCompany: bestJob ? bestJob.company : '',
      jobId: bestJob ? bestJob.id : null,
      currentStatus: bestJob ? bestJob.status : '',
      suggestedStatus: detectedStatus || (bestJob ? bestJob.status : 'applied'),
      confidence,
      summary,
      matchedQuotes,
      snippet: emailText.slice(0, 280)
    };
  },

  /**
   * Scan Gmail API messages if user has granted OAuth Gmail scope
   * @param {string} accessToken - Google OAuth token
   * @param {Array} jobs - User's applied jobs
   */
  async scanGmailInbox(accessToken, jobs = []) {
    if (!accessToken) throw new Error('Google access token required');

    // Build query for company names and recruiter keywords
    const keywords = '(interview OR offer OR "application status" OR "thank you for applying" OR regret OR "moving forward")';
    const query = encodeURIComponent(`newer_than:30d ${keywords}`);
    const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=${query}`;

    const res = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!res.ok) {
      throw new Error(`Gmail API error: ${res.statusText}`);
    }

    const listData = await res.json();
    if (!listData.messages || listData.messages.length === 0) {
      return [];
    }

    const detections = [];

    // Fetch details for each message
    for (const msg of listData.messages.slice(0, 10)) {
      try {
        const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (!msgRes.ok) continue;
        const msgData = await msgRes.json();

        // Extract headers
        const headers = msgData.payload.headers || [];
        const subject = (headers.find(h => h.name.toLowerCase() === 'subject') || {}).value || '';
        const from = (headers.find(h => h.name.toLowerCase() === 'from') || {}).value || '';
        const date = (headers.find(h => h.name.toLowerCase() === 'date') || {}).value || '';
        const snippet = msgData.snippet || '';

        const classification = this.classifyEmail(`${subject}\n${snippet}`, jobs, from);
        if (classification && classification.jobId) {
          detections.push({
            id: msg.id,
            subject,
            from,
            date,
            ...classification
          });
        }
      } catch (err) {
        console.warn('Error fetching message details:', err);
      }
    }

    return detections;
  },

  /**
   * Generates helpful follow-up email templates for user to copy in 1 click
   */
  getEmailTemplates(job = {}) {
    const company = job.company || '[Company Name]';
    const title = job.title || '[Job Title]';
    const recruiter = job.contactName || 'Hiring Team';

    return [
      {
        id: 'followup_1week',
        name: 'Follow-up (1-2 Weeks Post Application)',
        subject: `Following up on ${title} application — Alex Brighten`,
        body: `Hi ${recruiter},

I hope this note finds you well.

I recently submitted my application for the ${title} position at ${company}. I am very excited about ${company}'s mission and wanted to reiterate my strong enthusiasm for this opportunity.

Given my background and technical experience, I'm confident I could make an immediate contribution to your engineering team. 

Could you please provide an update on the hiring timeline for this role?

Thank you for your time and consideration.

Best regards,
Alex Brighten`
      },
      {
        id: 'post_interview_thankyou',
        name: 'Post-Interview Thank You Note',
        subject: `Thank you — ${title} interview at ${company}`,
        body: `Hi ${recruiter},

Thank you very much for taking the time to speak with me today about the ${title} role at ${company}.

I really enjoyed learning more about the engineering challenges your team is tackling and how you build scalable systems. Our conversation reinforced my excitement about joining ${company} and contributing to your team's success.

Please let me know if there's any additional information or work samples I can provide as you make your decision.

Looking forward to hearing from you regarding next steps!

Warm regards,
Alex Brighten`
      },
      {
        id: 'status_check_final',
        name: 'Decision Status Check (Post Final Round)',
        subject: `Checking in — ${title} interview status`,
        body: `Hi ${recruiter},

I hope you are having a productive week.

I'm following up following our recent conversations regarding the ${title} position. I remain very enthusiastic about the possibility of joining ${company}.

I understand decisions take time, but I wanted to see if there are any updates regarding next steps or the hiring timeline.

Thank you again for your time and guidance throughout the process!

Best,
Alex Brighten`
      }
    ];
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = EmailTracker;
}
