import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from 'src/infra/database/prisma.service'
import { ReservationStatus } from '@prisma/client'

@Injectable()
export class ReservationExpirationWorker {
  private readonly logger = new Logger(ReservationExpirationWorker.name)

  constructor(private readonly prisma: PrismaService) {}

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
        await tx.reservation.update({
          where: { id },
          data: { status: ReservationStatus.EXPIRED },
        })

        await tx.reservationSeat.deleteMany({
          where: { reservationId: id },
        })

        this.logger.log(`Reservation expired: ${id}`)
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

      // idempotência total
      if (updated.count === 0) return

      await tx.reservationSeat.deleteMany({
        where: { reservationId },
      })

      this.logger.log(`Reservation expired: ${reservationId}`)
    })
  }
}