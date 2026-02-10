import { Injectable, ConflictException } from '@nestjs/common'
import { PrismaService } from 'src/infra/database/prisma.service'
import { RedisService } from 'src/infra/cache/redis.service'
import { CreateReservationDto } from './dto/create-reservation.dto'

@Injectable()
export class ReservationsService {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

  async create(dto: CreateReservationDto) {
    const TTL = 30

    // order to avoid deadlock
    const seatIds = [...dto.seatIds].sort()

    // check if seats have already been sold
    const soldSeats = await this.prisma.saleSeat.findMany({
      where: { seatId: { in: seatIds } },
    })

    if (soldSeats.length > 0) {
      throw new ConflictException('One or more seats have already been sold')
    }

    // check if seats already have active reservations
    const activeReservations = await this.prisma.reservationSeat.findMany({
      where: {
        seatId: { in: seatIds },
        reservation: { status: 'ACTIVE' },
      },
    })

    if (activeReservations.length > 0) {
      throw new ConflictException('One or more seats already have active reservations')
    }

    // try creating locks in Redis
    for (const seatId of seatIds) {
      const lockKey = `lock:session:${dto.sessionId}:seat:${seatId}`

      const locked = await this.redisService.set(lockKey, 'locked', TTL)

      if (!locked) {
        throw new ConflictException('Seat already locked')
      }
    }

    // create bank reserve 
    return this.prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.create({
        data: {
          userId: dto.userId,
          sessionId: dto.sessionId,
          expiresAt: new Date(Date.now() + TTL * 1000),
        },
      })

      await tx.reservationSeat.createMany({
        data: seatIds.map((seatId) => ({
          reservationId: reservation.id,
          seatId,
        })),
      })

      return reservation
    })
  }
}
