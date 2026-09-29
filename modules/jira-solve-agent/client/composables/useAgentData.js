import { ref } from 'vue';
import { apiRequest } from '@shared/client/services/api.js';

export function useAgentData() {
  const data = ref(null);
  const loading = ref(true);
  const error = ref(null);

  async function load() {
    loading.value = true;
    error.value = null;
    try {
      data.value = await apiRequest('/modules/jira-solve-agent/data');
    } catch (e) {
      error.value = e.message;
    } finally {
      loading.value = false;
    }
  }

  load();

  return { data, loading, error, load };
}
