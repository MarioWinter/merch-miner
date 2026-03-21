import { apiClient } from '@/services/authService';
import type {
  NicheResearchRun,
  NicheResearchListItem,
  ResearchTriggerParams,
} from '../types';

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export const researchApi = {
  triggerResearch: async (
    nicheId: string,
    params?: ResearchTriggerParams,
  ): Promise<NicheResearchRun> => {
    const { data } = await apiClient.post<NicheResearchRun>(
      `/api/niches/${nicheId}/research/`,
      params ?? {},
    );
    return data;
  },

  getLatestResearch: async (nicheId: string): Promise<NicheResearchRun> => {
    const { data } = await apiClient.get<NicheResearchRun>(
      `/api/niches/${nicheId}/research/latest/`,
    );
    return data;
  },

  cancelResearch: async (nicheId: string): Promise<NicheResearchRun> => {
    const { data } = await apiClient.post<NicheResearchRun>(
      `/api/niches/${nicheId}/research/cancel/`,
    );
    return data;
  },

  listResearch: async (
    nicheId: string,
    page = 1,
  ): Promise<PaginatedResponse<NicheResearchListItem>> => {
    const { data } = await apiClient.get<PaginatedResponse<NicheResearchListItem>>(
      `/api/niches/${nicheId}/research/`,
      { params: { page } },
    );
    return data;
  },
};
