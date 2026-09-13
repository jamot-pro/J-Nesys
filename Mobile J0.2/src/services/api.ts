// API Service configuration for Render backend
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://your-api-service.onrender.com';

/**
 * Get Telegram initData string passed by the Telegram client
 */
export const getTelegramAuthHeader = (): Record<string, string> => {
  if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.initData) {
    return {
      'x-telegram-init-data': (window as any).Telegram.WebApp.initData,
    };
  }
  return {};
};

/**
 * Fetch nearby tasks from your Render backend API
 */
export const fetchTasksApi = async (lat?: number, lng?: number, filter?: string) => {
  try {
    const params = new URLSearchParams();
    if (lat && lng) {
      params.append('lat', lat.toString());
      params.append('lng', lng.toString());
    }
    if (filter) params.append('category', filter);

    const res = await fetch(`${API_BASE_URL}/api/tasks?${params.toString()}`, {
      headers: {
        ...getTelegramAuthHeader(),
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) throw new Error(`API error: ${res.statusText}`);
    return await res.json();
  } catch (error) {
    console.warn('Backend API unreachable, using fallback mock data:', error);
    return null;
  }
};

/**
 * Save user profile to Render backend
 */
export const saveProfileApi = async (profileData: any) => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/profile`, {
      method: 'POST',
      headers: {
        ...getTelegramAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(profileData),
    });

    if (!res.ok) throw new Error(`Failed to save profile: ${res.statusText}`);
    return await res.json();
  } catch (error) {
    console.error('Error saving profile to Render backend:', error);
    throw error;
  }
};
