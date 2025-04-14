import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
// Import custom type definitions
import '../types/axios';
import { getAuthToken } from './auth.service';
import { logger } from '../utils/logger'; // Assuming logger exists

// Base API URL from environment or default
const API_URL = process.env.REACT_APP_API_URL || '/api';

// Create a configured Axios instance using the default export
// This is the standard way to create an instance.
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add the auth token
// Interceptors are a standard property of an Axios instance.
apiClient.interceptors.request.use(
  (config: AxiosRequestConfig): AxiosRequestConfig => {
    const token = getAuthToken();
    if (token) {
      config.headers = config.headers || {};
      config.headers['Authorization'] = `Bearer ${token}`;
      logger.debug('Attaching auth token to request headers.');
    } else {
      logger.debug('No auth token found, request sent without Authorization header.');
    }
    return config;
  },
  (error: AxiosError) => {
    logger.error('Axios request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Optional: Response interceptor for handling common responses/errors
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error: AxiosError) => {
    if (error.response) {
      logger.error(`API Error: ${error.response.status} ${error.response.statusText}`, error.response.data);
      // Example: Handle global 401 Unauthorized
      // if (error.response.status === 401) { ... }
    } else if (error.request) {
      logger.error('API Error: No response received', error.request);
    } else {
      // Pass the whole error object to the logger
      logger.error('API Error: Request setup error', error);
    }
    return Promise.reject(error);
  }
);

export default apiClient;