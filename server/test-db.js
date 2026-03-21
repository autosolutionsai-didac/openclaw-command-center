#!/usr/bin/env node
// Test script for database and company manager

import { initDatabase, createCompany, getCompany, getAllCompanies, createPost, getPostsByCompany, logActivity, getRecentActivity } from './db/index.js';
import companyManager from './company-manager.js';

console.log('🧪 Testing Marketing Hub Database & Company Manager\n');

try {
  // Initialize database
  console.log('1. Initializing database...');
  initDatabase();
  console.log('   ✅ Database initialized\n');

  // Test company creation
  console.log('2. Creating test company...');
  const testCompany = {
    id: 'test-company',
    name: 'Test OpenClaw Co',
    config_json: JSON.stringify({
      brandVoice: 'professional',
      colors: { primary: '#3B82F6' }
    }),
    active: 1
  };
  createCompany(testCompany);
  console.log('   ✅ Company created\n');

  // Test company retrieval
  console.log('3. Retrieving company...');
  const company = getCompany('test-company');
  console.log('   ✅ Retrieved:', company.name, '\n');

  // Test getting all companies
  console.log('4. Getting all companies...');
  const allCompanies = getAllCompanies();
  console.log('   ✅ Found', allCompanies.length, 'companies\n');

  // Test post creation
  console.log('5. Creating test posts...');
  createPost({
    company_id: 'test-company',
    content: 'Hello from Test OpenClaw Co!',
    platform: 'linkedin',
    status: 'draft'
  });
  createPost({
    company_id: 'test-company',
    content: 'Another post scheduled',
    platform: 'instagram',
    status: 'scheduled',
    scheduled_at: new Date().toISOString()
  });
  console.log('   ✅ Posts created\n');

  // Test getting posts by company
  console.log('6. Retrieving posts by company...');
  const posts = getPostsByCompany('test-company');
  console.log('   ✅ Found', posts.length, 'posts');
  posts.forEach(p => {
    console.log(`      - [${p.status}] ${p.platform}: ${p.content.slice(0, 40)}...`);
  });
  console.log();

  // Test activity logging
  console.log('7. Logging activity...');
  logActivity('test-company', 'test-agent', 'test_action', { foo: 'bar' });
  console.log('   ✅ Activity logged\n');

  // Test getting recent activity
  console.log('8. Retrieving recent activity...');
  const activity = getRecentActivity('test-company', 10);
  console.log('   ✅ Found', activity.length, 'activities\n');

  // Test company manager
  console.log('9. Testing company manager...');
  await companyManager.init();
  const managerCompanies = companyManager.getAllCompanies();
  console.log('   ✅ Company manager loaded', managerCompanies.length, 'companies\n');

  console.log('✅ All tests passed!\n');
} catch (err) {
  console.error('❌ Test failed:', err.message);
  console.error(err.stack);
  process.exit(1);
}
