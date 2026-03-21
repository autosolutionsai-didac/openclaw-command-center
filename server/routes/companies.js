import { Router } from 'express';
import companyManager from '../company-manager.js';
import { getCompany, getAllCompanies, createPost, getPostsByCompany, getAnalytics, getRecentActivity } from '../db/index.js';

const router = Router();

// List all companies
router.get('/', (req, res) => {
  try {
    const companies = companyManager.getAllCompanies();
    res.json({
      success: true,
      count: companies.length,
      companies: companies.map(c => ({
        id: c.id,
        name: c.name,
        brandVoice: c.brandVoice,
        colors: c.colors,
        socialAccounts: c.socialAccounts,
        active: c.id === companyManager.getActiveCompany()?.id
      }))
    });
  } catch (err) {
    console.error('[api] Error listing companies:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get single company details
router.get('/:id', (req, res) => {
  try {
    const company = companyManager.getCompany(req.params.id);
    if (!company) {
      return res.status(404).json({ success: false, error: 'Company not found' });
    }
    
    res.json({
      success: true,
      company: {
        id: company.id,
        name: company.name,
        brandVoice: company.brandVoice,
        description: company.description,
        colors: company.colors,
        socialAccounts: company.socialAccounts,
        postingSchedule: company.postingSchedule,
        websites: company.websites,
        agentConfig: company.agentConfig,
        active: company.id === companyManager.getActiveCompany()?.id
      }
    });
  } catch (err) {
    console.error('[api] Error getting company:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Switch active company
router.post('/switch', (req, res) => {
  try {
    const { companyId } = req.body;
    if (!companyId) {
      return res.status(400).json({ success: false, error: 'companyId required' });
    }
    
    const company = companyManager.setActiveCompany(companyId);
    res.json({
      success: true,
      message: `Switched to ${company.name}`,
      company: {
        id: company.id,
        name: company.name,
        colors: company.colors
      }
    });
  } catch (err) {
    console.error('[api] Error switching company:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

// Get active company
router.get('/active/current', (req, res) => {
  try {
    const company = companyManager.getActiveCompany();
    if (!company) {
      return res.status(404).json({ success: false, error: 'No active company' });
    }
    
    res.json({
      success: true,
      company: {
        id: company.id,
        name: company.name,
        brandVoice: company.brandVoice,
        colors: company.colors,
        socialAccounts: company.socialAccounts
      }
    });
  } catch (err) {
    console.error('[api] Error getting active company:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get company posts (kanban data)
router.get('/:id/posts', (req, res) => {
  try {
    const { status } = req.query;
    const posts = getPostsByCompany(req.params.id, status || null, 50);
    
    res.json({
      success: true,
      count: posts.length,
      posts: posts.map(p => ({
        id: p.id,
        content: p.content,
        platform: p.platform,
        status: p.status,
        scheduled_at: p.scheduled_at,
        posted_at: p.posted_at,
        created_at: p.created_at
      }))
    });
  } catch (err) {
    console.error('[api] Error getting posts:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get company analytics summary
router.get('/:id/analytics', (req, res) => {
  try {
    const { days = '30' } = req.query;
    const analytics = getAnalytics(req.params.id, null, parseInt(days, 10));
    
    // Group by platform and metric
    const summary = {};
    for (const row of analytics) {
      if (!summary[row.platform]) {
        summary[row.platform] = {};
      }
      if (!summary[row.platform][row.metric]) {
        summary[row.platform][row.metric] = [];
      }
      summary[row.platform][row.metric].push({
        date: row.date,
        value: row.value
      });
    }
    
    res.json({
      success: true,
      days: parseInt(days, 10),
      summary
    });
  } catch (err) {
    console.error('[api] Error getting analytics:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get company activity log
router.get('/:id/activity', (req, res) => {
  try {
    const { limit = '50' } = req.query;
    const activity = getRecentActivity(req.params.id, parseInt(limit, 10));
    
    res.json({
      success: true,
      count: activity.length,
      activity: activity.map(a => ({
        id: a.id,
        agent: a.agent,
        action: a.action,
        details: a.details ? JSON.parse(a.details) : null,
        created_at: a.created_at
      }))
    });
  } catch (err) {
    console.error('[api] Error getting activity:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
