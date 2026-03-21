import { readdirSync, readFileSync, watch } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCompany, getCompany, getAllCompanies, getActiveCompany, logActivity } from './db/index.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const COMPANIES_DIR = join(__dirname, '..', 'config', 'companies');

class CompanyManager {
  constructor() {
    this.companies = new Map();
    this.activeCompanyId = null;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;

    // Load all company configs from disk
    await this.loadAllCompanies();
    
    // Set first company as active if none set
    if (!this.activeCompanyId && this.companies.size > 0) {
      const firstCompany = this.companies.values().next().value;
      this.activeCompanyId = firstCompany.id;
    }

    this.initialized = true;
    console.log(`[company] Loaded ${this.companies.size} company config(s)`);
  }

  async loadAllCompanies() {
    try {
      const files = readdirSync(COMPANIES_DIR).filter(f => f.endsWith('.json'));
      
      for (const file of files) {
        try {
          const configPath = join(COMPANIES_DIR, file);
          const config = JSON.parse(readFileSync(configPath, 'utf-8'));
          await this.registerCompany(config);
        } catch (err) {
          console.error(`[company] Error loading ${file}:`, err.message);
        }
      }
    } catch (err) {
      console.error('[company] Error reading companies directory:', err.message);
    }
  }

  async registerCompany(config) {
    if (!config.id || !config.name) {
      throw new Error('Company config must have id and name');
    }

    // Save to database
    createCompany({
      id: config.id,
      name: config.name,
      config_json: JSON.stringify(config),
      active: config.active !== false ? 1 : 0
    });

    // Cache in memory
    this.companies.set(config.id, config);
    
    // Log activity
    logActivity(config.id, 'system', 'company_registered', { config });

    console.log(`[company] Registered: ${config.name} (${config.id})`);
    return config;
  }

  getCompany(companyId) {
    return this.companies.get(companyId) || null;
  }

  getAllCompanies() {
    return Array.from(this.companies.values());
  }

  getActiveCompany() {
    if (!this.activeCompanyId) return null;
    return this.companies.get(this.activeCompanyId) || null;
  }

  setActiveCompany(companyId) {
    if (!this.companies.has(companyId)) {
      throw new Error(`Company not found: ${companyId}`);
    }
    
    const oldActive = this.activeCompanyId;
    this.activeCompanyId = companyId;
    
    console.log(`[company] Switched from ${oldActive || 'none'} to ${companyId}`);
    
    // Log activity for both companies
    if (oldActive) {
      logActivity(oldActive, 'system', 'company_deactivated', { newActive: companyId });
    }
    logActivity(companyId, 'system', 'company_activated', { oldActive });
    
    return this.companies.get(companyId);
  }

  async addCompany(config) {
    await this.registerCompany(config);
    return config;
  }

  // Get company by Late profile ID (for routing incoming webhooks)
  getCompanyByLateProfile(lateProfileId) {
    for (const [id, config] of this.companies) {
      if (config.lateProfileId === lateProfileId) {
        return config;
      }
    }
    return null;
  }

  // Get companies by platform
  getCompaniesByPlatform(platform) {
    return this.getAllCompanies().filter(c => 
      c.socialAccounts && c.socialAccounts.includes(platform)
    );
  }
}

// Singleton export
export const companyManager = new CompanyManager();

export default companyManager;
