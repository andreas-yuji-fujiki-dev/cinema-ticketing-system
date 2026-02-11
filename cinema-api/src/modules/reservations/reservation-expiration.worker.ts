import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { PrismaService } from 'src/infra/database/prisma.service'
import { ReservationStatus } from '@prisma/client'
import { RedisService } from 'src/infra/cache/redis.service'
import { MessagingService } from 'src/infra/messaging/messaging.service'

@Injectable()
export class ReservationExpirationWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReservationExpirationWorker.name)
  private timer: NodeJS.Timeout | null = null

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly messaging: MessagingService,
  ) {
    const client = this.redis.getClient()
    this.logger.log(`Redis client status: ${client.status || 'unknown'}`)
  }

  onModuleInit() {
    // run immediately then schedule periodic runs
    this.run().catch((e) => this.logger.error(`Initial expire run failed: ${e}`))
    this.timer = setInterval(() => {
      this.run().catch((e) => this.logger.error(`Expire run failed: ${e}`))
    }, 5000)
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  async run() {
    const now = new Date()

    await this.prisma.$transaction(async (tx) => {
      const expired: { id: string }[] =
        await tx.$queryRaw`
          SELECT id
          FROM "Reservation"
          WHERE status = 'ACTIVE'
            AND "expiresAt" < ${now}
          FOR UPDATE SKIP LOCKED
        `

      for (const { id } of expired) {
        // fetch seats for this reservation before deleting
        const res = await tx.reservation.findUnique({
          where: { id },
          include: { seats: true },
        })

        await tx.reservation.update({
          where: { id },
          data: { status: ReservationStatus.EXPIRED },
        })

        await tx.reservationSeat.deleteMany({
          where: { reservationId: id },
        })

        this.logger.log(`Reservation expired: ${id}`)

        // publish event after transaction changes
        try {
          this.messaging.publish('RESERVATION_EXPIRED', {
            reservationId: id,
            sessionId: res?.sessionId,
            seatIds: res?.seats?.map((s) => s.seatId) || [],
          })
        } catch (err) {}
      }
    })
  }

  private async expireReservation(reservationId: string) {
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.reservation.updateMany({
        where: {
          id: reservationId,
          status: ReservationStatus.ACTIVE,
        },
        data: {
          status: ReservationStatus.EXPIRED,
        },
      })
      
      if (updated.count === 0) return

      await tx.reservationSeat.deleteMany({
        where: { reservationId },
      })

      this.logger.log(`Reservation expired: ${reservationId}`)
    })
  }
}