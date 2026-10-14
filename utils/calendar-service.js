// utils/calendar-service.js — Calendar Integration & Follow-up Reminder Engine

const CalendarService = {
  /**
   * Generates a direct Google Calendar Web URL to add an event with 1 click
   */
  getGoogleCalendarUrl({ title, description, location, startTime, durationMinutes = 45 }) {
    const start = new Date(startTime || Date.now());
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

    const formatGoogleDate = (date) => {
      return date.toISOString().replace(/-|:|\.\d\d\d/g, '');
    };

    const datesParam = `${formatGoogleDate(start)}/${formatGoogleDate(end)}`;

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: title || 'Job Interview / Follow-up',
      dates: datesParam,
      details: description || 'Tracked with JobPulse Pro Application Tracker',
      location: location || ''
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  },

  /**
   * Open the Google Calendar event creation tab directly
   */
  openGoogleCalendarEvent(options) {
    const url = this.getGoogleCalendarUrl(options);
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  },

  /**
   * Schedule a browser follow-up notification using Chrome Alarms or window.setTimeout
   */
  async scheduleFollowupAlarm(job) {
    if (!job || !job.followUpDate) return false;

    const followUpTime = new Date(job.followUpDate).getTime();
    const now = Date.now();
    if (followUpTime <= now) return false;

    const delayMinutes = Math.max(1, Math.round((followUpTime - now) / (60 * 1000)));

    if (typeof chrome !== 'undefined' && chrome.alarms) {
      chrome.alarms.create(`followup_${job.id}`, {
        delayInMinutes: delayMinutes
      });
      return true;
    }

    return false;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CalendarService;
}
