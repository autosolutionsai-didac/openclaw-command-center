import config from './config.js';
import { saveAnalytics, logActivity } from './db/index.js';

/**
 * Late API Client - Multi-profile support for social media posting
 * Docs: https://getlate.dev/api/v1
 */

class LateAPIClient {
  constructor() {
    this.baseURL = config.lateApiBase || 'https://getlate.dev/api/v1';
    this.apiKey = config.lateApiKey;
    this.enabled = !!this.apiKey;
    
    if (!this.enabled) {
      console.log('[late] Late API not configured (set LATE_API_KEY in .env)');
    }
  }

  /**
   * Make authenticated request to Late API
   */
  async request(endpoint, options = {}) {
    if (!this.enabled) {
      throw new Error('Late API not configured');
    }

    const url = `${this.baseURL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Late API error (${response.status}): ${error}`);
    }

    return response.json();
  }

  /**
   * Get profile info
   */
  async getProfile(profileId) {
    return this.request(`/profiles/${profileId}`);
  }

  /**
   * Create a post
   * @param {string} profileId - Late profile ID
   * @param {object} post - Post data { content, platforms, scheduledFor?, media? }
   */
  async createPost(profileId, post) {
    console.log(`[late] Creating post for profile ${profileId}`);
    
    const payload = {
      profileId,
      content: post.content,
      platforms: post.platforms || ['linkedin', 'instagram', 'facebook'],
      scheduledFor: post.scheduledFor,
      media: post.media,
    };

    const result = await this.request(`/posts`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    console.log(`[late] Post created: ${result.id}`);
    return result;
  }

  /**
   * Schedule a post (update existing post with scheduledFor)
   * @param {string} profileId - Late profile ID
   * @param {string} postId - Post ID
   * @param {string} scheduledFor - ISO 8601 datetime
   */
  async schedulePost(profileId, postId, scheduledFor) {
    console.log(`[late] Scheduling post ${postId} for ${scheduledFor}`);
    
    return this.request(`/posts/${postId}`, {
      method: 'PATCH',
      body: JSON.stringify({ 
        profileId,
        scheduledFor 
      }),
    });
  }

  /**
   * Publish a post immediately
   */
  async publishPost(profileId, postId) {
    console.log(`[late] Publishing post ${postId}`);
    
    return this.request(`/posts/${postId}/publish`, {
      method: 'POST',
      body: JSON.stringify({ profileId }),
    });
  }

  /**
   * Get posts for a profile
   */
  async getPosts(profileId, options = {}) {
    const params = new URLSearchParams();
    if (options.status) params.append('status', options.status);
    if (options.limit) params.append('limit', options.limit);
    
    const query = params.toString() ? `?${params}` : '';
    return this.request(`/profiles/${profileId}/posts${query}`);
  }

  /**
   * Get analytics for a profile
   */
  async getAnalytics(profileId, options = {}) {
    const params = new URLSearchParams();
    if (options.platform) params.append('platform', options.platform);
    if (options.days) params.append('days', options.days);
    
    const query = params.toString() ? `?${params}` : '';
    return this.request(`/profiles/${profileId}/analytics${query}`);
  }

  /**
   * Get connected accounts
   */
  async getConnectedAccounts(profileId) {
    return this.request(`/profiles/${profileId}/accounts`);
  }

  /**
   * Delete a post
   */
  async deletePost(profileId, postId) {
    console.log(`[late] Deleting post ${postId}`);
    
    return this.request(`/profiles/${profileId}/posts/${postId}`, {
      method: 'DELETE',
    });
  }
}

// Singleton export
export const lateAPI = new LateAPIClient();

// Convenience functions for direct use
export async function createPostForCompany(company, content, platforms, scheduledAt = null) {
  if (!company.lateProfileId) {
    throw new Error(`Company ${company.id} has no Late profile configured`);
  }

  const result = await lateAPI.createPost(company.lateProfileId, {
    content,
    platforms,
    scheduledAt,
  });

  // Log activity
  logActivity(company.id, 'late-api', 'post_created', { 
    postId: result.id, 
    platforms,
    scheduledAt 
  });

  return result;
}

export async function schedulePostForCompany(company, postId, scheduledAt) {
  if (!company.lateProfileId) {
    throw new Error(`Company ${company.id} has no Late profile configured`);
  }

  const result = await lateAPI.schedulePost(company.lateProfileId, postId, scheduledAt);
  
  logActivity(company.id, 'late-api', 'post_scheduled', { postId, scheduledAt });
  
  return result;
}

export async function getAnalyticsForCompany(company, platform = null, days = 30) {
  if (!company.lateProfileId) {
    throw new Error(`Company ${company.id} has no Late profile configured`);
  }

  const analytics = await lateAPI.getAnalytics(company.lateProfileId, { platform, days });
  
  // Save to local database
  if (analytics.metrics) {
    for (const [metric, value] of Object.entries(analytics.metrics)) {
      saveAnalytics(company.id, platform || 'all', metric, value);
    }
  }
  
  return analytics;
}

export default {
  lateAPI,
  createPostForCompany,
  schedulePostForCompany,
  getAnalyticsForCompany,
};
