import axios from 'axios';
import { API_BASE_URL } from '../config';

// Service Cost interface
export interface ServiceCost {
  id: string;
  serviceName: string;
  serviceKey: string;
  costPerUnit: number;
  unitType: string;
  multiplier: number;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Set up axios instance with auth headers
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminAuthToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Get all service costs
 */
export const getAllServiceCosts = async (): Promise<{ data: ServiceCost[] }> => {
  const response = await api.get('/admin/service-costs');
  return response.data;
};

/**
 * Get service cost by ID
 * @param id Service cost ID
 */
export const getServiceCostById = async (id: string): Promise<{ data: ServiceCost }> => {
  const response = await api.get(`/admin/service-costs/${id}`);
  return response.data;
};

/**
 * Create a new service cost
 * @param serviceCost Service cost to create
 */
export const createServiceCost = async (
  serviceCost: Omit<ServiceCost, 'id' | 'createdAt' | 'updatedAt'>
): Promise<{ data: ServiceCost }> => {
  const response = await api.post('/admin/service-costs', serviceCost);
  return response.data;
};

/**
 * Update a service cost
 * @param id Service cost ID
 * @param updates Updates to apply
 */
export const updateServiceCost = async (
  id: string,
  updates: Partial<Omit<ServiceCost, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<{ data: ServiceCost }> => {
  const response = await api.put(`/admin/service-costs/${id}`, updates);
  return response.data;
};

/**
 * Delete a service cost
 * @param id Service cost ID
 */
export const deleteServiceCost = async (id: string): Promise<{ success: boolean; message: string }> => {
  const response = await api.delete(`/admin/service-costs/${id}`);
  return response.data;
};

export default {
  getAllServiceCosts,
  getServiceCostById,
  createServiceCost,
  updateServiceCost,
  deleteServiceCost
};
