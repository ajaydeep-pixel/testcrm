const BASE_URL = 'http://localhost:4000/api';

const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

const request = async (endpoint, options = {}) => {
  const url = `${BASE_URL}${endpoint}`;
  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        ...getHeaders(),
        ...options.headers
      }
    });
  } catch (err) {
    throw new Error(`Network error: ${err.message}`);
  }

  if (response.status === 401) {
    localStorage.removeItem('token');
    window.location.reload(); // Simple redirect to login logic
  }

  const contentType = response.headers.get('content-type') || '';
  let data;
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch (err) {
      throw new Error(`Invalid JSON response from ${url}`);
    }
  } else {
    // Non-JSON response (could be HTML error page). Read as text for better diagnostics.
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Server error ${response.status}: ${text}`);
    }
    // try to parse as JSON fallback, otherwise return text
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = text;
    }
  }

  if (!response.ok) {
    const errorMsg = (data && data.error) ? `${data.message || ''}: ${data.error}` : (data && data.message) ? data.message : (typeof data === 'string' ? data : 'Request failed');
    throw new Error(errorMsg);
  }

  return data;
};

export const apiService = {
  get: (endpoint, params) => {
    let url = endpoint;
    if (params && typeof params === 'object') {
      const qs = new URLSearchParams(params).toString();
      if (qs) url = `${endpoint}?${qs}`;
    }
    return request(url, { method: 'GET' });
  },
  post: (endpoint, body) => request(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  put: (endpoint, body) => request(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  patch: (endpoint, body) => request(endpoint, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (endpoint) => request(endpoint, { method: 'DELETE' })
};
