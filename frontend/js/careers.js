var EMC_API_BASE = window.EMC_API_BASE || (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost' ? 'https://emc-website-7v6.pages.dev' : '');
window.EMC_API_BASE = EMC_API_BASE;

const HR_EMAIL = 'info@ecometrix.co.in';
const CAREER_API = EMC_API_BASE + '/api/career';

function escapeHTML(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const PIN_ICON = '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="vertical-align:middle; margin-right:4px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>';

let JOBS_DATA = [];

function mapOpening(item) {
  const reqs = [];
  if (item.requiredQualification) reqs.push('Qualification: ' + item.requiredQualification);
  if (item.minExperience != null || item.maxExperience != null) {
    reqs.push('Experience: ' + (item.minExperience != null ? item.minExperience : 0) + '-' + (item.maxExperience != null ? item.maxExperience : '') + ' years');
  }
  if (Array.isArray(item.requiredSkills) && item.requiredSkills.length) {
    reqs.push('Skills: ' + item.requiredSkills.join(', '));
  }
  if (Array.isArray(item.requiredCertifications) && item.requiredCertifications.length) {
    reqs.push('Certifications: ' + item.requiredCertifications.join(', '));
  }
  const responsibilities = Array.isArray(item.responsibilities) && item.responsibilities.length
    ? item.responsibilities
    : (item.description ? [item.description] : []);
  return {
    id: item.id,
    title: item.title,
    department: (item.department && item.department.name) || item.departmentId || 'General',
    location: item.location || '',
    type: (item.employmentType && item.employmentType.name) || 'Full-time',
    postedDate: item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : (item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''),
    description: item.description || '',
    responsibilities: responsibilities,
    requirements: reqs.length ? reqs : (item.requiredQualification ? [item.requiredQualification] : []),
    jobCode: item.jobCode,
    deadline: item.deadline
  };
}

let currentDept = 'All';
let searchQuery = '';
let initialLoadDone = false;

function getFilteredJobs() {
  let res = JOBS_DATA;
  if (currentDept !== 'All') {
    res = res.filter(j => j.department.toLowerCase().includes(currentDept.toLowerCase()));
  }
  if (searchQuery) {
    res = res.filter(j =>
      j.title.toLowerCase().includes(searchQuery) ||
      j.department.toLowerCase().includes(searchQuery) ||
      j.location.toLowerCase().includes(searchQuery) ||
      j.description.toLowerCase().includes(searchQuery)
    );
  }
  return res;
}

function renderCurrentList() {
  const container = document.getElementById('jobsListContainer');
  if (container) renderJobsList(getFilteredJobs(), container);
}

function openingsSignature(items) {
  return (items || []).map(j => j.id + ':' + j.title + ':' + (j.deadline || '')).join('|');
}

function loadOpenings() {
  const container = document.getElementById('jobsListContainer');
  return fetch(CAREER_API + '/openings')
    .then(res => res.json())
    .then(json => {
      const items = (json && json.data && Array.isArray(json.data.items)) ? json.data.items
        : (Array.isArray(json.items) ? json.items : (Array.isArray(json.data) ? json.data : []));
      const mapped = items.map(mapOpening);
      const changed = openingsSignature(mapped) !== openingsSignature(JOBS_DATA);
      JOBS_DATA = mapped;
      if (changed || !initialLoadDone) {
        renderCurrentList();
        initialLoadDone = true;
      }
    })
    .catch(() => {
      if (!initialLoadDone && container) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:40px 0;">Unable to load openings. Please try again later.</p>';
      }
    });
}

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('jobsListContainer');
  if (!container) return;

  container.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:40px 0;">Loading openings...</p>';

  container.addEventListener('click', (e) => {
    const card = e.target.closest('.job-card');
    if (!card) return;
    const job = JOBS_DATA.find(j => j.id === card.dataset.id);
    if (!job) return;
    openJobModal(job);
  });

  setupJobFilters();

  loadOpenings();

  // Live sync with external career server: new openings appear, removed ones disappear
  setInterval(loadOpenings, 60000);
  window.addEventListener('focus', loadOpenings);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) loadOpenings();
  });
});

function renderJobsList(data, container) {
  if (!data || data.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:40px 0;">No open positions matching your filter.</p>';
    return;
  }

  container.innerHTML = data.map(job => `
    <div class="job-card" data-id="${escapeHTML(job.id)}">
      <div class="job-info">
        <div class="job-icon"><svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg></div>
        <div>
          <h3 class="job-title">${escapeHTML(job.title)}</h3>
          <div class="job-location">${PIN_ICON}${escapeHTML(job.location)} • Posted ${escapeHTML(job.postedDate)}</div>
          <div class="job-tags">
            <span class="job-tag">${escapeHTML(job.department)}</span>
            <span class="job-tag">${escapeHTML(job.type)}</span>
          </div>
        </div>
      </div>
      <div class="job-actions">
        <button type="button" class="job-btn job-btn-apply" data-action="view">View Details →</button>
      </div>
    </div>
  `).join('');
}

function setupJobFilters() {
  const filterBtns = document.querySelectorAll('.jobs-filter-btn');
  const searchInput = document.getElementById('jobsSearchInput');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentDept = btn.getAttribute('data-category') || 'All';
      renderCurrentList();
    });
  });

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim().toLowerCase();
      renderCurrentList();
    });
  }
}

function openJobModal(job) {
  const respHtml = (job.responsibilities || []).map(r => `<li>${escapeHTML(r)}</li>`).join('');
  const reqHtml = (job.requirements || []).map(r => `<li>${escapeHTML(r)}</li>`).join('');

  const modalHtml = `
    <div class="job-modal-inner">
      <div class="jd-tags">
        <span class="job-tag jd-tag-dept">${escapeHTML(job.department)}</span>
        <span class="job-tag">${escapeHTML(job.type)}</span>
      </div>
      <h2 class="jd-title">${escapeHTML(job.title)}</h2>
      <div class="jd-meta">${PIN_ICON}${escapeHTML(job.location)} • Posted ${escapeHTML(job.postedDate)}</div>
      <p class="jd-desc">${escapeHTML(job.description)}</p>

      <div class="jd-cols">
        <div class="jd-block">
          <h4>Key Responsibilities</h4>
          <ul>${respHtml || '<li>As described in the job description.</li>'}</ul>
        </div>
        <div class="jd-block">
          <h4>Qualifications &amp; Requirements</h4>
          <ul>${reqHtml || '<li>As per the opening.</li>'}</ul>
        </div>
      </div>

      <section class="apply-card" id="jobApplySection">
        <div class="apply-head">
          <div class="apply-head-icon">
            <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
          </div>
          <div>
            <h3>Apply for this Position</h3>
            <p>${escapeHTML(job.title)} &middot; takes about 2 minutes</p>
          </div>
        </div>

        <form id="jobApplyForm" class="apply-form" novalidate>
          <input type="hidden" name="openingId" value="${escapeHTML(job.id)}">
          <input type="hidden" name="jobCode" value="${escapeHTML(job.jobCode || '')}">
          <input type="hidden" name="consent" value="true">

          <div class="apply-row">
            <label class="apply-field">
              <span>Full Name <b>*</b></span>
              <input type="text" name="fullName" placeholder="e.g. Priya Sahu" required autocomplete="name">
            </label>
            <label class="apply-field">
              <span>Email Address <b>*</b></span>
              <input type="email" name="email" placeholder="you@example.com" required autocomplete="email">
            </label>
          </div>

          <div class="apply-row">
            <label class="apply-field">
              <span>Phone Number <b>*</b></span>
              <input type="tel" name="phone" placeholder="+91 98765 43210" required autocomplete="tel">
            </label>
            <label class="apply-field">
              <span>Years of Experience <b>*</b></span>
              <input type="text" name="experience" placeholder="e.g. 3 years" required>
            </label>
          </div>

          <label class="apply-field">
            <span>Cover Letter / Brief Profile</span>
            <textarea name="coverLetter" rows="4" placeholder="Tell us briefly about your experience and why you'd like to join Ecometrix."></textarea>
          </label>

          <label class="apply-field">
            <span>Upload CV / Resume <b>*</b></span>
            <input type="file" name="resume" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required>
          </label>

          <div id="jobFormMsg" class="apply-msg" role="alert" style="display:none;"></div>

          <div class="apply-actions">
            <button type="submit" class="apply-submit" id="jobSubmitBtn">Submit Application →</button>
            <span class="apply-note">Your details are only used for hiring at Ecometrix.</span>
          </div>
        </form>
      </section>
    </div>
  `;

  window.emcModal.open(modalHtml);

  const applyForm = document.getElementById('jobApplyForm');
  if (applyForm) applyForm.addEventListener('submit', (e) => {
    e.preventDefault();
    submitApplication(applyForm, job);
  });
}

function showFormMsg(el, text, ok) {
  el.textContent = text;
  el.style.display = 'block';
  el.className = 'apply-msg ' + (ok ? 'ok' : 'err');
}

function extractApplicationId(json) {
  if (!json) return '';
  const candidates = [
    json.applicationId, json.application_id, json.id, json.reference, json.ref, json.refId, json.ref_id,
    json.data && (json.data.applicationId || json.data.application_id || json.data.id || json.data.reference || json.data.ref || json.data.refId),
    json.result && (json.result.applicationId || json.result.id || json.result.reference)
  ];
  for (const c of candidates) {
    if (c) return String(c);
  }
  return '';
}

function submitApplication(form, job) {
  const msg = document.getElementById('jobFormMsg');
  const btn = document.getElementById('jobSubmitBtn');
  const formData = new FormData(form);

  const fullName = (formData.get('fullName') || '').toString().trim();
  const email = (formData.get('email') || '').toString().trim();
  const phone = (formData.get('phone') || '').toString().trim();
  const experience = (formData.get('experience') || '').toString().trim();

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!fullName || !emailOk || !phone || !experience) {
    showFormMsg(msg, 'Please fill all required fields with a valid email address.', false);
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Submitting...';
  msg.style.display = 'none';

  fetch(CAREER_API + '/apply', {
    method: 'POST',
    body: formData
  })
    .then(res => {
      return res.json().catch(() => ({})).then(json => ({ ok: res.ok, status: res.status, json }));
    })
    .then(({ ok, status, json }) => {
      if (!ok) {
        const err = (json && (json.error && json.error.message) || json.message || json.detail) || ('Server error ' + status);
        throw new Error(err);
      }
      form.reset();
      btn.textContent = 'Submitted ✓';
      const appId = extractApplicationId(json);
      const successText = appId
        ? 'Application submitted successfully! Your application ID: ' + appId + '. EMC HR team will get in touch soon.'
        : 'Application submitted successfully! EMC HR team will get in touch soon.';
      showFormMsg(msg, successText, true);
      setTimeout(() => window.emcModal.close(), 3000);
    })
    .catch((err) => {
      btn.disabled = false;
      btn.textContent = 'Submit Application →';
      const subject = encodeURIComponent('Application: ' + job.title);
      const body = encodeURIComponent(
        'Position: ' + job.title + '\nName: ' + fullName +
        '\nEmail: ' + email + '\nPhone: ' + phone +
        '\nExperience: ' + experience + '\n\n' + (formData.get('coverLetter') || '')
      );
      msg.style.display = 'block';
      msg.className = 'apply-msg err';
      msg.innerHTML = (err && err.message ? err.message + '. ' : '') +
        'Application online submit nahi ho paayi. Please try again, ya ' +
        '<a href="mailto:' + HR_EMAIL + '?subject=' + subject + '&body=' + body + '" style="color:inherit; text-decoration:underline;">email se bhej do</a> (CV attach karke).';
    });
}
