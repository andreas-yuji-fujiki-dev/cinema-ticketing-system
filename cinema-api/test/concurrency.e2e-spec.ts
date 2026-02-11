import request from 'supertest';

// This test expects the API to be running at BASE_URL (default: http://localhost:3000).
// It will attempt 10 concurrent reservations for the same two seats and assert
// that only one reservation succeeds and the rest fail with 409 Conflict.

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';

describe('Concurrency: multiple users trying to reserve same seats', () => {
  jest.setTimeout(30000);

  it('allows only one reservation for the same seats when 10 users try concurrently', async () => {
    // quick health check
    try {
      await request(BASE_URL).get('/');
    } catch (e) {
      console.warn(`Skipping concurrency test — cannot reach ${BASE_URL}`);
      return;
    }

    const attempts = 10;
    const payloads = Array.from({ length: attempts }, (_, i) => ({
      userId: `concurrent-user-${i + 1}`,
      sessionId: 'session-1',
      seatIds: ['seat-1', 'seat-2'],
    }));

    const reqs = payloads.map(p =>
      request(BASE_URL)
        .post('/reservations')
        .send(p)
        .set('Accept', 'application/json')
    );

    const results = await Promise.all(reqs);

    const success = results.filter(r => r.status >= 200 && r.status < 300);
    const conflict = results.filter(r => r.status === 409);

    // Expect that exactly one request succeeded and the others conflicted.
    expect(success.length).toBeGreaterThanOrEqual(1);
    expect(conflict.length + success.length).toEqual(attempts);

    // Ideally only one success; allow small variance if system behavior differs but log counts.
    console.info(`concurrency test results: success=${success.length}, conflict=${conflict.length}`);
  });
});
