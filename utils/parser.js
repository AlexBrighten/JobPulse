// utils/parser.js - In-page Job Data & Full Job Description Extractor for major job boards

const JobParser = {
  extract() {
    const url = window.location.href;
    const hostname = window.location.hostname.toLowerCase();

    let jobData = {
      title: '',
      company: '',
      location: '',
      url: url,
      platform: 'Direct / Company',
      jobDescription: ''
    };

    if (hostname.includes('linkedin.com')) {
      jobData = this.parseLinkedIn();
    } else if (hostname.includes('indeed.com')) {
      jobData = this.parseIndeed();
    } else if (hostname.includes('glassdoor.com')) {
      jobData = this.parseGlassdoor();
    } else if (hostname.includes('lever.co')) {
      jobData = this.parseLever();
    } else if (hostname.includes('greenhouse.io')) {
      jobData = this.parseGreenhouse();
    } else if (hostname.includes('myworkdayjobs.com') || hostname.includes('workday.com')) {
      jobData = this.parseWorkday();
    } else if (hostname.includes('wellfound.com') || hostname.includes('angel.co')) {
      jobData = this.parseWellfound();
    } else {
      jobData = this.parseGeneric();
    }

    jobData.url = url;
    if (jobData.jobDescription) {
      jobData.jobDescription = this.cleanDescription(jobData.jobDescription);
    }
    return jobData;
  },

  // Helper safely get text content
  getText(selector, parent = document) {
    try {
      const el = parent.querySelector(selector);
      return el ? el.innerText.trim() : '';
    } catch (e) {
      return '';
    }
  },

  cleanDescription(text = '') {
    if (!text || typeof text !== 'string') return '';
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  },

  parseLinkedIn() {
    let title = this.getText('.job-details-jobs-unified-top-card__job-title') ||
                this.getText('.jobs-unified-top-card__job-title') ||
                this.getText('h1.t-24') ||
                this.getText('.topcard__title');

    let company = this.getText('.job-details-jobs-unified-top-card__company-name a') ||
                  this.getText('.job-details-jobs-unified-top-card__company-name') ||
                  this.getText('.jobs-unified-top-card__company-name') ||
                  this.getText('.topcard__org-name-link') ||
                  this.getText('.job-details-jobs-unified-top-card__primary-description a');

    let location = this.getText('.job-details-jobs-unified-top-card__primary-description span:nth-of-type(1)') ||
                   this.getText('.jobs-unified-top-card__bullet') ||
                   this.getText('.topcard__flavor--bullet');

    let jobDescription = this.getText('.jobs-description-content__text') ||
                         this.getText('#job-details') ||
                         this.getText('.jobs-description__content') ||
                         this.getText('.jobs-box__html-content') ||
                         this.getText('.description__text');

    if (!title) {
      const docTitle = document.title;
      const parts = docTitle.split('|')[0].split(' hiring ');
      if (parts.length > 1) {
        company = company || parts[0].trim();
        title = parts[1].replace(/ in .*$/, '').trim();
      } else {
        const hyphenParts = docTitle.split(' - ');
        if (hyphenParts.length > 1) {
          title = hyphenParts[0].trim();
        }
      }
    }

    return {
      title: title || this.guessTitleFromDoc(),
      company: company || 'LinkedIn Job',
      location: location || '',
      platform: 'LinkedIn',
      jobDescription: jobDescription || ''
    };
  },

  parseIndeed() {
    let title = this.getText('h1.jobsearch-JobInfoHeader-title') ||
                this.getText('.jobsearch-JobInfoHeader-title span') ||
                this.getText('[data-testid="simpler-jobTitle"]');

    let company = this.getText('[data-testid="inlineHeader-companyName"]') ||
                  this.getText('.jobsearch-CompanyInfoContainer a') ||
                  this.getText('[data-company-name="true"]');

    let location = this.getText('[data-testid="inlineHeader-companyLocation"]') ||
                   this.getText('.jobsearch-JobInfoHeader-companyLocation');

    let jobDescription = this.getText('#jobDescriptionText') ||
                         this.getText('.jobsearch-jobDescriptionText');

    return {
      title: title || this.guessTitleFromDoc(),
      company: company || 'Indeed Job',
      location: location || '',
      platform: 'Indeed',
      jobDescription: jobDescription || ''
    };
  },

  parseGlassdoor() {
    let title = this.getText('.JobDetails_jobTitle__Rw_gn') ||
                this.getText('h1[data-test="job-title"]');

    let company = this.getText('.EmployerProfile_employerName__8aAaf') ||
                  this.getText('[data-test="employer-name"]');

    let location = this.getText('.JobDetails_location__mSg5h') ||
                   this.getText('[data-test="location"]');

    let jobDescription = this.getText('[data-test="job-description"]') ||
                         this.getText('.JobDetails_jobDescription__uW_fK') ||
                         this.getText('.jobDescriptionContent');

    return {
      title: title || this.guessTitleFromDoc(),
      company: company || 'Glassdoor Job',
      location: location || '',
      platform: 'Glassdoor',
      jobDescription: jobDescription || ''
    };
  },

  parseLever() {
    let title = this.getText('.posting-headline h2');
    let company = this.getText('.main-header-logo img') ? 
                  document.querySelector('.main-header-logo img')?.alt : 
                  this.getText('.posting-header');
    let location = this.getText('.posting-categories .location') ||
                   this.getText('.sort-by-time.posting-category');

    let jobDescription = this.getText('.section-page[data-qa="job-description"]') ||
                         this.getText('.content') ||
                         this.getText('.posting-content');

    return {
      title: title || this.guessTitleFromDoc(),
      company: company || 'Company',
      location: location || '',
      platform: 'Lever',
      jobDescription: jobDescription || ''
    };
  },

  parseGreenhouse() {
    let title = this.getText('.app-title') || this.getText('#header .job-name');
    let company = this.getText('.company-name');
    let location = this.getText('.location');

    let jobDescription = this.getText('#content') ||
                         this.getText('.body') ||
                         this.getText('.content-intro');

    return {
      title: title || this.guessTitleFromDoc(),
      company: company || 'Company',
      location: location || '',
      platform: 'Greenhouse',
      jobDescription: jobDescription || ''
    };
  },

  parseWorkday() {
    let title = this.getText('[data-automation-id="jobPostingHeader"]') ||
                this.getText('h2[data-automation-id="jobTitle"]');
    let location = this.getText('[data-automation-id="jobPostingLocation"]');
    let company = document.title.split('-')[0].trim();

    let jobDescription = this.getText('[data-automation-id="jobPostingDescription"]') ||
                         this.getText('[data-automation-id="job-description"]');

    return {
      title: title || this.guessTitleFromDoc(),
      company: company || 'Workday Job',
      location: location || '',
      platform: 'Workday',
      jobDescription: jobDescription || ''
    };
  },

  parseWellfound() {
    let title = this.getText('h1.styles_title__12');
    let company = this.getText('h2.styles_company__12') || this.getText('a.styles_companyLink__12');
    let location = this.getText('.styles_location__12');

    let jobDescription = this.getText('[data-test="JobDescription"]') ||
                         this.getText('[class*="description"]');

    return {
      title: title || this.guessTitleFromDoc(),
      company: company || 'Startup',
      location: location || '',
      platform: 'Wellfound',
      jobDescription: jobDescription || ''
    };
  },

  parseGeneric() {
    const title = this.getText('h1') || this.guessTitleFromDoc();
    const docTitle = document.title;
    let company = '';

    if (docTitle.includes(' at ')) {
      company = docTitle.split(' at ')[1].split(/[-–|]/)[0].trim();
    } else if (docTitle.includes(' - ')) {
      company = docTitle.split(' - ')[1].trim();
    } else if (docTitle.includes(' | ')) {
      company = docTitle.split(' | ')[1].trim();
    }

    let jobDescription = this.getText('article') ||
                         this.getText('main') ||
                         this.getText('[class*="job-description"]') ||
                         this.getText('[class*="description"]');

    return {
      title: title,
      company: company || window.location.hostname.replace('www.', '').split('.')[0],
      location: '',
      platform: 'Direct / Company',
      jobDescription: jobDescription || ''
    };
  },

  guessTitleFromDoc() {
    const docTitle = document.title;
    if (!docTitle) return 'Untitled Position';
    return docTitle.split(/[-–|]/)[0].trim();
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = JobParser;
}
