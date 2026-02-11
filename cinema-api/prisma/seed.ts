import { PrismaClient } from '@prisma/client';
import { getLogger } from '../src/infra/logging/logger';

const logger = getLogger('Seed');

const prisma = new PrismaClient();

async function main() {
  // user base
  await prisma.user.upsert({
    where: { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' },
    update: {},
    create: {
      id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      email: 'user@test.com',
    },
  });

  // create 10 concurrent test users (used by concurrency e2e test)
  const concurrentUsers = Array.from({ length: 10 }, (_, i) => ({
    id: `concurrent-user-${i + 1}`,
    email: `concurrent${i + 1}@test.local`,
  }));

  await prisma.user.createMany({
    data: concurrentUsers,
    skipDuplicates: true,
  });

  // session base
  await prisma.session.upsert({
    where: { id: 'session-1' },
    update: {},
    create: {
      id: 'session-1',
      movie: 'Interestelar',
      room: 'Sala 1',
      startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      price: 10.5,
    },
  });

  // seats base — create 16 seats for the session
  const seats = Array.from({ length: 16 }, (_, i) => ({
    id: `seat-${i + 1}`,
    number: i + 1,
    sessionId: 'session-1',
  }));

  await prisma.seat.createMany({
    data: seats,
    skipDuplicates: true,
  });
}

main()
  .then(() => {
    logger.info('Seed executado com sucesso');
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
