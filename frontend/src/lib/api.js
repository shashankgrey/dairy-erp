import axios from 'axios';

// In local dev, VITE_API_URL is unset, so this falls back to '/api',
// which Vite's dev server proxies to your local backend -- unchanged
// from before. In production (Vercel), VITE_API_URL is set to your
// deployed backend's real URL, since there's no dev proxy in a static
// build.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Don't redirect if we're already on the login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;