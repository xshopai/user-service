/**
 * API Client Helper
 * Provides reusable HTTP client for making API requests with common patterns
 */
import axios from 'axios';

/**
 * Create an axios instance with default configuration
 */
export function createApiClient(baseURL, options = {}) {
  const client = axios.create({
    baseURL,
    timeout: options.timeout || 10000,
    headers: options.headers || {},
  });

  // Request interceptor
  client.interceptors.request.use(
    (config) => {
      if (options.verbose) {
        console.log(`[API] ${config.method.toUpperCase()} ${config.url}`);
      }
      return config;
    },
    (error) => Promise.reject(error),
  );

  // Response interceptor
  client.interceptors.response.use(
    (response) => {
      if (options.verbose) {
        console.log(`[API] ${response.status} ${response.config.url}`);
      }
      return response;
    },
    (error) => {
      if (options.verbose) {
        console.error(`[API] ${error.response?.status || 'ERROR'} ${error.config?.url}`);
      }
      // Don't reject - let tests handle errors
      return error.response || { status: 500, data: { error: error.message } };
    },
  );

  return client;
}

/**
 * Make a GET request
 */
export async function get(url, options = {}) {
  const { token, apiKey, headers = {}, ...axiosOptions } = options;

  const requestHeaders = { ...headers };
  if (token) requestHeaders.Authorization = `Bearer ${token}`;
  if (apiKey) requestHeaders['X-API-Key'] = apiKey;

  try {
    const response = await axios.get(url, {
      ...axiosOptions,
      headers: requestHeaders,
    });
    return response;
  } catch (error) {
    return error.response || { status: 500, data: { error: error.message } };
  }
}

/**
 * Make a POST request
 */
export async function post(url, data, options = {}) {
  const { token, apiKey, headers = {}, ...axiosOptions } = options;

  const requestHeaders = { ...headers };
  if (token) requestHeaders.Authorization = `Bearer ${token}`;
  if (apiKey) requestHeaders['X-API-Key'] = apiKey;

  try {
    const response = await axios.post(url, data, {
      ...axiosOptions,
      headers: requestHeaders,
    });
    return response;
  } catch (error) {
    return error.response || { status: 500, data: { error: error.message } };
  }
}

/**
 * Make a PUT request
 */
export async function put(url, data, options = {}) {
  const { token, apiKey, headers = {}, ...axiosOptions } = options;

  const requestHeaders = { ...headers };
  if (token) requestHeaders.Authorization = `Bearer ${token}`;
  if (apiKey) requestHeaders['X-API-Key'] = apiKey;

  try {
    const response = await axios.put(url, data, {
      ...axiosOptions,
      headers: requestHeaders,
    });
    return response;
  } catch (error) {
    return error.response || { status: 500, data: { error: error.message } };
  }
}

/**
 * Make a PATCH request
 */
export async function patch(url, data, options = {}) {
  const { token, apiKey, headers = {}, ...axiosOptions } = options;

  const requestHeaders = { ...headers };
  if (token) requestHeaders.Authorization = `Bearer ${token}`;
  if (apiKey) requestHeaders['X-API-Key'] = apiKey;

  try {
    const response = await axios.patch(url, data, {
      ...axiosOptions,
      headers: requestHeaders,
    });
    return response;
  } catch (error) {
    return error.response || { status: 500, data: { error: error.message } };
  }
}

/**
 * Make a DELETE request
 */
export async function del(url, options = {}) {
  const { token, apiKey, headers = {}, ...axiosOptions } = options;

  const requestHeaders = { ...headers };
  if (token) requestHeaders.Authorization = `Bearer ${token}`;
  if (apiKey) requestHeaders['X-API-Key'] = apiKey;

  try {
    const response = await axios.delete(url, {
      ...axiosOptions,
      headers: requestHeaders,
    });
    return response;
  } catch (error) {
    return error.response || { status: 500, data: { error: error.message } };
  }
}

/**
 * Check service health
 */
export async function checkHealth(serviceUrl, timeout = 5000) {
  try {
    const response = await axios.get(`${serviceUrl}/health/ready`, { timeout });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

/**
 * Wait for service to be ready
 */
export async function waitForService(serviceUrl, options = {}) {
  const { timeout = 60000, interval = 2000, serviceName = 'Service' } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const isHealthy = await checkHealth(serviceUrl);
    if (isHealthy) {
      console.log(`  ✓ ${serviceName} is ready`);
      return true;
    }
    await sleep(interval);
  }

  throw new Error(`${serviceName} did not become ready within ${timeout}ms`);
}

/**
 * Sleep utility
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait for condition with timeout
 */
export async function waitFor(conditionFn, options = {}) {
  const { timeout = 10000, interval = 500, timeoutMessage = 'Condition not met within timeout' } = options;

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const result = await conditionFn();
      if (result) {
        return result;
      }
    } catch (error) {
      // Continue waiting
    }
    await sleep(interval);
  }

  throw new Error(timeoutMessage);
}

export default {
  createApiClient,
  get,
  post,
  put,
  patch,
  del,
  checkHealth,
  waitForService,
  sleep,
  waitFor,
};
