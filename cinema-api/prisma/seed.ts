import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // user base
  await prisma.user.upsert({
    where: { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' },
    update: {},
    create: {
      id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      email: 'user@test.com',
    },
  })

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
  })

  // seats base
  await prisma.seat.createMany({
    data: [
      { id: 'seat-1', number: 1, sessionId: 'session-1' },
      { id: 'seat-2', number: 2, sessionId: 'session-1' },
      { id: 'seat-3', number: 3, sessionId: 'session-1' },
    ],
    skipDuplicates: true,
  })
}

main()
  .then(() => {
    console.log('Seed executado com sucesso')
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
