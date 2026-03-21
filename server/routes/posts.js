import { Router } from 'express';
import companyManager from '../company-manager.js';
import { createPost, getPostsByCompany, updatePostStatus } from '../db/index.js';
import { createPostForCompany, schedulePostForCompany } from '../late-api.js';

const router = Router();

// Create a new post for a company
router.post('/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    const { content, platforms, scheduledAt } = req.body;

    const company = companyManager.getCompany(companyId);
    if (!company) {
      return res.status(404).json({ success: false, error: 'Company not found' });
    }

    if (!content) {
      return res.status(400).json({ success: false, error: 'content required' });
    }

    // Create in local database
    const status = scheduledAt ? 'scheduled' : 'draft';
    const result = createPost({
      company_id: companyId,
      content,
      platform: platforms[0] || 'linkedin',
      status,
      scheduled_at: scheduledAt,
    });

    // If Late API is configured and company has profile, create there too
    let latePost = null;
    if (company.lateProfileId) {
      try {
        latePost = await createPostForCompany(company, content, platforms, scheduledAt);
      } catch (err) {
        console.error('[posts] Late API error:', err.message);
        // Continue with local post even if Late API fails
      }
    }

    res.json({
      success: true,
      post: {
        id: result.lastInsertRowid,
        content,
        platforms,
        status,
        scheduled_at: scheduledAt,
        lateId: latePost?.id,
      },
    });
  } catch (err) {
    console.error('[posts] Error creating post:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get posts for a company (kanban data)
router.get('/:companyId', (req, res) => {
  try {
    const { status } = req.query;
    const posts = getPostsByCompany(req.params.companyId, status || null, 50);

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
        created_at: p.created_at,
      })),
    });
  } catch (err) {
    console.error('[posts] Error getting posts:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update post status (e.g., draft → scheduled → posted)
router.patch('/:companyId/:postId', async (req, res) => {
  try {
    const { companyId, postId } = req.params;
    const { status, scheduledAt } = req.body;

    const company = companyManager.getCompany(companyId);
    if (!company) {
      return res.status(404).json({ success: false, error: 'Company not found' });
    }

    // If scheduling and company has Late profile, schedule there too
    if (status === 'scheduled' && scheduledAt && company.lateProfileId) {
      try {
        await schedulePostForCompany(company, postId, scheduledAt);
      } catch (err) {
        console.error('[posts] Late API schedule error:', err.message);
      }
    }

    updatePostStatus(postId, status, status === 'posted' ? new Date().toISOString() : null);

    res.json({
      success: true,
      message: `Post ${postId} updated to ${status}`,
    });
  } catch (err) {
    console.error('[posts] Error updating post:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete a post
router.delete('/:companyId/:postId', (req, res) => {
  try {
    // TODO: Implement delete in DB
    // TODO: Delete from Late API if applicable
    
    res.json({
      success: true,
      message: 'Post deleted (not yet implemented)',
    });
  } catch (err) {
    console.error('[posts] Error deleting post:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
