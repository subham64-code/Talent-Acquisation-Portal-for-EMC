const HR_API = 'https://talent-acquisation-portal-for-emc-production.up.railway.app/api/v1';

const firstValue = (form, keys) => {
  for (const key of keys) {
    const value = form.get(key);
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

const normalizePhone = (value) => {
  let digits = value.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits;
};

const normalizeExperience = (value) => value.match(/\d+/)?.[0] ?? value;

const normalizeApplyForm = async (request) => {
  const source = await request.formData();
  const form = new FormData();
  form.set('job_id', firstValue(source, ['job_id', 'openingId', 'jobOpeningId', 'jobId']));
  form.set('job_title', firstValue(source, ['job_title', 'jobTitle', 'jobCode', 'title']));
  form.set('full_name', firstValue(source, ['full_name', 'fullName', 'name']));
  form.set('email', firstValue(source, ['email']));
  form.set('phone', normalizePhone(firstValue(source, ['phone'])));
  form.set('experience', normalizeExperience(firstValue(source, ['experience'])));
  form.set('cover_letter', firstValue(source, ['cover_letter', 'coverLetter']));
  const cv = source.get('cv') ?? source.get('resume');
  if (cv && typeof cv === 'object' && typeof cv.arrayBuffer === 'function') {
    form.set('cv', cv, cv.name || 'cv.pdf');
  }
  return new Request(request.url, { method: 'POST', body: form });
};

const safeRequestHeaders = (headers) => {
  const out = new Headers();
  headers.forEach((value, key) => {
    if (!['host', 'connection', 'content-length', 'cf-connecting-ip', 'cf-ray'].includes(key.toLowerCase())) {
      out.set(key, value);
    }
  });
  return out;
};

const safeResponseHeaders = (headers) => {
  const out = new Headers();
  for (const key of ['content-type', 'cache-control', 'location']) {
    const value = headers.get(key);
    if (value) out.set(key, value);
  }
  return out;
};

const proxy = async (target, request) => {
  const init = {
    method: request.method,
    headers: safeRequestHeaders(request.headers),
  };
  if (!['GET', 'HEAD'].includes(request.method.toUpperCase())) {
    init.body = await request.arrayBuffer();
  }
  try {
    const upstream = await fetch(target, init);
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: safeResponseHeaders(upstream.headers),
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Upstream API unavailable', detail: String(error) }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }
};

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const parts = url.pathname.replace(/^\/api\//, '').split('/').filter(Boolean);

  if (parts[0] === 'career') {
    const rest = parts.slice(1);
    if (rest[0] === 'apply') {
      const normalized = await normalizeApplyForm(request);
      return proxy(`${HR_API}/career/applications`, normalized);
    }
    return proxy(`${HR_API}/career/${rest.join('/')}${url.search}`, request);
  }

  const flask = env.FLASK_API_ORIGIN;
  if (flask) {
    return proxy(`${flask.replace(/\/$/, '')}/api/${parts.join('/')}${url.search}`, request);
  }

  if (parts[0] === 'visitor-counter') {
    return new Response(JSON.stringify({ count: 0 }), {
      headers: { 'content-type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({
    error: 'This API route needs the Flask backend. Set FLASK_API_ORIGIN in Cloudflare Pages settings.',
  }), {
    status: 503,
    headers: { 'content-type': 'application/json' },
  });
}
