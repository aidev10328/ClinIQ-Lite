/**
 * ClinIQ Lite - Load Testing Script
 *
 * Uses k6 for load testing. Install: brew install k6
 *
 * Run commands:
 *   # Light load (10 users)
 *   k6 run scripts/load-test.js
 *
 *   # 50 users simulation
 *   k6 run --vus 50 --duration 5m scripts/load-test.js
 *
 *   # Stress test (100 users)
 *   k6 run --vus 100 --duration 10m scripts/load-test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const loginDuration = new Trend('login_duration');
const apiDuration = new Trend('api_duration');

// Configuration - UPDATE THESE FOR YOUR ENVIRONMENT
const CONFIG = {
  API_BASE_URL: __ENV.API_URL || 'https://cliniq-lite-api.westus2.azurecontainerapps.io',
  WEB_BASE_URL: __ENV.WEB_URL || 'https://cliniq-lite-web.westus2.azurecontainerapps.io',

  // Test credentials (create a test user in your production system)
  TEST_EMAIL: __ENV.TEST_EMAIL || 'loadtest@example.com',
  TEST_PASSWORD: __ENV.TEST_PASSWORD || 'TestPassword123!',
};

// Load test options
export const options = {
  // Simulate 50 users ramping up
  stages: [
    { duration: '1m', target: 10 },   // Ramp up to 10 users
    { duration: '3m', target: 50 },   // Ramp up to 50 users
    { duration: '5m', target: 50 },   // Stay at 50 users
    { duration: '1m', target: 0 },    // Ramp down
  ],

  thresholds: {
    // 95% of requests must complete within 2s
    http_req_duration: ['p(95)<2000'],
    // Error rate must be below 1%
    errors: ['rate<0.01'],
    // Login must complete within 3s
    login_duration: ['p(95)<3000'],
    // API calls must complete within 1s
    api_duration: ['p(95)<1000'],
  },
};

// Setup: runs once before all VUs start
export function setup() {
  // Verify API is accessible
  const healthRes = http.get(`${CONFIG.API_BASE_URL}/health`);
  check(healthRes, {
    'API health check passed': (r) => r.status === 200,
  });

  const readyRes = http.get(`${CONFIG.API_BASE_URL}/ready`);
  check(readyRes, {
    'API readiness check passed': (r) => r.status === 200,
  });

  if (healthRes.status !== 200) {
    throw new Error('API is not healthy - aborting load test');
  }

  console.log('Setup complete - API is healthy');
  return { startTime: Date.now() };
}

// Main test function - runs for each virtual user
export default function(data) {
  let authToken = null;

  // 1. Test Login Flow
  group('Authentication', () => {
    const loginStart = Date.now();

    const loginRes = http.post(
      `${CONFIG.API_BASE_URL}/auth/login`,
      JSON.stringify({
        email: CONFIG.TEST_EMAIL,
        password: CONFIG.TEST_PASSWORD,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );

    loginDuration.add(Date.now() - loginStart);

    const loginSuccess = check(loginRes, {
      'login successful': (r) => r.status === 200 || r.status === 201,
      'login has token': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.access_token !== undefined;
        } catch {
          return false;
        }
      },
    });

    errorRate.add(!loginSuccess);

    if (loginSuccess) {
      try {
        const body = JSON.parse(loginRes.body);
        authToken = body.access_token;
      } catch (e) {
        console.error('Failed to parse login response');
      }
    }
  });

  sleep(1);

  // Skip remaining tests if login failed
  if (!authToken) {
    console.warn('Skipping authenticated tests - no auth token');
    return;
  }

  const authHeaders = {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json',
  };

  // 2. Test /auth/me endpoint
  group('Get Current User', () => {
    const start = Date.now();
    const res = http.get(`${CONFIG.API_BASE_URL}/auth/me`, { headers: authHeaders });
    apiDuration.add(Date.now() - start);

    const success = check(res, {
      'get me successful': (r) => r.status === 200,
    });
    errorRate.add(!success);
  });

  sleep(0.5);

  // 3. Test Health Endpoints (unauthenticated)
  group('Health Endpoints', () => {
    const healthRes = http.get(`${CONFIG.API_BASE_URL}/health`);
    check(healthRes, {
      'health check OK': (r) => r.status === 200,
    });

    const readyRes = http.get(`${CONFIG.API_BASE_URL}/ready`);
    check(readyRes, {
      'readiness check OK': (r) => r.status === 200,
    });
  });

  sleep(0.5);

  // 4. Simulate typical user flow - viewing patients (if manager/staff)
  group('Patient Search', () => {
    const start = Date.now();
    const res = http.get(`${CONFIG.API_BASE_URL}/v1/patients?search=test`, {
      headers: authHeaders
    });
    apiDuration.add(Date.now() - start);

    // 200 = success, 403 = not authorized (doctor role), both are valid
    const success = check(res, {
      'patient search valid response': (r) => r.status === 200 || r.status === 403,
    });
    errorRate.add(!success && res.status !== 403);
  });

  sleep(1);

  // 5. Simulate viewing appointments
  group('View Appointments', () => {
    const today = new Date().toISOString().split('T')[0];
    const start = Date.now();
    const res = http.get(
      `${CONFIG.API_BASE_URL}/v1/appointments?date=${today}`,
      { headers: authHeaders }
    );
    apiDuration.add(Date.now() - start);

    const success = check(res, {
      'appointments endpoint valid': (r) => r.status === 200 || r.status === 403,
    });
    errorRate.add(!success && res.status !== 403);
  });

  sleep(1);

  // 6. Simulate viewing queue
  group('View Queue', () => {
    const today = new Date().toISOString().split('T')[0];
    const start = Date.now();
    const res = http.get(
      `${CONFIG.API_BASE_URL}/v1/queue?date=${today}`,
      { headers: authHeaders }
    );
    apiDuration.add(Date.now() - start);

    const success = check(res, {
      'queue endpoint valid': (r) => r.status === 200 || r.status === 403,
    });
    errorRate.add(!success && res.status !== 403);
  });

  sleep(2);
}

// Teardown: runs once after all VUs finish
export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`Load test completed in ${duration.toFixed(2)}s`);
}
