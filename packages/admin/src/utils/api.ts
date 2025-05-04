import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

/**
 * Create an API client with the correct base URL and error handling
 */
export const createApiClient = (): AxiosInstance => {
  const baseURL = process.env.NEXT_PUBLIC_API_URL || '/api';
  
  const client = axios.create({
    baseURL,
    timeout: 30000, // 30 seconds
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  // Add request interceptor
  client.interceptors.request.use(
    (config: AxiosRequestConfig) => {
      // You can add auth tokens or other headers here
      return config;
    },
    (error: AxiosError) => {
      return Promise.reject(error);
    }
  );
  
  // Add response interceptor
  client.interceptors.response.use(
    (response: AxiosResponse) => {
      return response;
    },
    (error: AxiosError) => {
      // Handle common errors
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error('API Error Response:', {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers,
        });
        
        // Handle authentication errors
        if (error.response.status === 401) {
          console.error('Authentication error - redirecting to login');
          // You could redirect to login page here
        }
        
        // Handle forbidden errors
        if (error.response.status === 403) {
          console.error('Forbidden - user does not have permission');
        }
      } else if (error.request) {
        // The request was made but no response was received
        console.error('API Error Request:', error.request);
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error('API Error Setup:', error.message);
      }
      
      return Promise.reject(error);
    }
  );
  
  return client;
};

// Create a default API client
export const apiClient = createApiClient();

// Export common API functions
export const api = {
  get: <T>(url: string, config?: AxiosRequestConfig) => 
    apiClient.get<T>(url, config),
  
  post: <T>(url: string, data?: any, config?: AxiosRequestConfig) => 
    apiClient.post<T>(url, data, config),
  
  put: <T>(url: string, data?: any, config?: AxiosRequestConfig) => 
    apiClient.put<T>(url, data, config),
  
  delete: <T>(url: string, config?: AxiosRequestConfig) => 
    apiClient.delete<T>(url, config),
  
  patch: <T>(url: string, data?: any, config?: AxiosRequestConfig) => 
    apiClient.patch<T>(url, data, config),
};

export default api;
