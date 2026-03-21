import { getDatabase, updatePostStatus } from './db/index.js';
import companyManager from './company-manager.js';
import { lateAPI } from './late-api.js';

/**
 * Auto-Posting Scheduler
 * Checks every minute for posts that should be published
 */

class PostScheduler {
  constructor() {
    this.interval = null;
    this.running = false;
  }

  /**
   * Start the scheduler
   */
  start() {
    if (this.running) {
      console.log('[scheduler] Already running');
      return;
    }

    this.running = true;
    console.log('[scheduler] Starting (checking every 60s)');

    // Check immediately
    this.checkScheduledPosts();

    // Then check every minute
    this.interval = setInterval(() => {
      this.checkScheduledPosts();
    }, 60000);
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (!this.running) return;

    this.running = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    console.log('[scheduler] Stopped');
  }

  /**
   * Check for posts that should be published now
   */
  async checkScheduledPosts() {
    const db = getDatabase();
    const now = new Date().toISOString();

    try {
      // Find posts scheduled for now or earlier
      const stmt = db.prepare(`
        SELECT * FROM posts 
        WHERE status = 'scheduled' 
        AND scheduled_at <= ?
        ORDER BY scheduled_at ASC
      `);

      const posts = stmt.all(now);

      if (posts.length === 0) {
        return; // Nothing to publish
      }

      console.log(`[scheduler] Found ${posts.length} posts to publish`);

      for (const post of posts) {
        await this.publishPost(post);
      }
    } catch (err) {
      console.error('[scheduler] Error checking posts:', err.message);
    }
  }

  /**
   * Publish a single post via Late API
   */
  async publishPost(post) {
    const company = companyManager.getCompany(post.company_id);
    
    if (!company) {
      console.error(`[scheduler] Company not found: ${post.company_id}`);
      return;
    }

    if (!company.lateProfileId) {
      console.error(`[scheduler] Company ${company.name} has no Late profile configured`);
      // Mark as posted anyway (manual posting required)
      updatePostStatus(post.id, 'posted', new Date().toISOString());
      return;
    }

    try {
      console.log(`[scheduler] Publishing post ${post.id} for ${company.name}`);

      // Publish via Late API
      await lateAPI.publishPost(company.lateProfileId, post.external_id || post.id.toString());

      // Update local status
      updatePostStatus(post.id, 'posted', new Date().toISOString());

      console.log(`[scheduler] Post ${post.id} published successfully`);
    } catch (err) {
      console.error(`[scheduler] Error publishing post ${post.id}:`, err.message);
      
      // Mark as error
      const db = getDatabase();
      const stmt = db.prepare(`
        UPDATE posts 
        SET status = 'error', error_message = ?
        WHERE id = ?
      `);
      stmt.run(err.message, post.id);
    }
  }

  /**
   * Schedule a post for future publishing
   * (Called when creating a scheduled post)
   */
  async schedulePost(companyId, postId, scheduledAt) {
    const company = companyManager.getCompany(companyId);
    
    if (!company || !company.lateProfileId) {
      console.log(`[scheduler] Post ${postId} created locally (no Late profile)`);
      return;
    }

    try {
      // Schedule in Late API
      await lateAPI.schedulePost(company.lateProfileId, postId.toString(), scheduledAt);
      console.log(`[scheduler] Post ${postId} scheduled in Late for ${scheduledAt}`);
    } catch (err) {
      console.error(`[scheduler] Error scheduling post ${postId}:`, err.message);
      // Continue with local scheduling even if Late API fails
    }
  }
}

// Singleton export
export const scheduler = new PostScheduler();

export default scheduler;
