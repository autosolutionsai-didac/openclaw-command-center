// Company Selector UI Component
// Handles company switching via dropdown and WebSocket

let currentCompanyId = null;
let companies = [];
let ws = null;

/**
 * Initialize company selector
 * Fetches companies from API and populates dropdown
 */
export async function init() {
  const selectEl = document.getElementById('company-select');
  const indicatorEl = document.getElementById('company-indicator');
  
  if (!selectEl) {
    console.error('[company] Company selector element not found');
    return;
  }

  try {
    // Fetch companies from API
    const response = await fetch('/api/companies');
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to load companies');
    }
    
    companies = data.companies;
    
    if (companies.length === 0) {
      console.warn('[company] No companies configured');
      selectEl.disabled = true;
      selectEl.innerHTML = '<option>No companies configured</option>';
      return;
    }
    
    // Populate dropdown
    selectEl.innerHTML = '';
    companies.forEach(company => {
      const option = document.createElement('option');
      option.value = company.id;
      option.textContent = company.name;
      if (company.active) {
        option.selected = true;
        currentCompanyId = company.id;
        updateIndicator(company.colors?.primary || '#00FF66');
      }
      selectEl.appendChild(option);
    });
    
    // Handle company switch
    selectEl.addEventListener('change', async (e) => {
      const companyId = e.target.value;
      await switchCompany(companyId);
    });
    
    console.log(`[company] Selector initialized with ${companies.length} companies`);
  } catch (err) {
    console.error('[company] Error initializing selector:', err.message);
    selectEl.innerHTML = '<option>Error loading companies</option>';
  }
}

/**
 * Switch to a different company
 * @param {string} companyId - Company ID to switch to
 */
export async function switchCompany(companyId) {
  if (companyId === currentCompanyId) {
    console.log('[company] Already on this company');
    return;
  }
  
  const selectEl = document.getElementById('company-select');
  const indicatorEl = document.getElementById('company-indicator');
  
  try {
    // Switch via API
    const response = await fetch('/api/companies/switch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ companyId }),
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to switch company');
    }
    
    // Update UI
    currentCompanyId = companyId;
    selectEl.value = companyId;
    
    const company = companies.find(c => c.id === companyId);
    if (company && company.colors?.primary) {
      updateIndicator(company.colors.primary);
    }
    
    // Notify via WebSocket if connected
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'switch_company',
        companyId,
      }));
    }
    
    console.log(`[company] Switched to ${data.company.name}`);
    
    // Dispatch custom event for other components to listen to
    window.dispatchEvent(new CustomEvent('company:switched', {
      detail: { companyId, company: data.company },
    }));
    
  } catch (err) {
    console.error('[company] Error switching company:', err.message);
    // Revert dropdown
    selectEl.value = currentCompanyId;
  }
}

/**
 * Update the company indicator color
 * @param {string} color - CSS color value
 */
function updateIndicator(color) {
  const indicatorEl = document.getElementById('company-indicator');
  if (indicatorEl) {
    indicatorEl.style.background = color;
    indicatorEl.style.boxShadow = `0 0 6px ${color}`;
  }
}

/**
 * Set WebSocket connection for real-time updates
 * @param {WebSocket} websocket - WebSocket instance
 */
export function setWebSocket(websocket) {
  ws = websocket;
}

/**
 * Get current company ID
 * @returns {string|null}
 */
export function getCurrentCompanyId() {
  return currentCompanyId;
}

/**
 * Get current company data
 * @returns {object|null}
 */
export function getCurrentCompany() {
  return companies.find(c => c.id === currentCompanyId) || null;
}

/**
 * Refresh company list (e.g., after adding a new company)
 */
export async function refresh() {
  await init();
}

export default {
  init,
  switchCompany,
  setWebSocket,
  getCurrentCompanyId,
  getCurrentCompany,
  refresh,
};
