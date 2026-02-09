import { Injectable, ConflictException } from '@nestjs/common'
import { PrismaService } from 'src/infra/database/prisma.service'
import { CreateReservationDto } from './dto/create-reservation.dto'
import { ReservationStatus } from '@prisma/client';

@Injectable()
export class ReservationsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateReservationDto) {
    return this.prisma.$transaction(async (tx) => {

      // seats lock
      await tx.$queryRawUnsafe(
        `
        SELECT id
        FROM "Seat"
        WHERE id = ANY($1::text[])
        FOR UPDATE
        `,
        dto.seatIds
      )

      // already booked?
      const exists = await tx.reservationSeat.findFirst({
        where: {
          seatId: { in: dto.seatIds },
          reservation: {
            status: ReservationStatus.ACTIVE,
            expiresAt: { gt: new Date() },
          }
        },
      })

      if (exists) {
        throw new ConflictException('Seat already reserved')
      }

      // create reservation
      const reservation = await tx.reservation.create({
        data: {
          userId: dto.userId,
          sessionId: dto.sessionId,
          expiresAt: new Date(Date.now() + 30 * 1000),
        },
      })

      // link seats
      await tx.reservationSeat.createMany({
        data: dto.seatIds.map((seatId) => ({
          reservationId: reservation.id,
          seatId,
        })),
      })

      return reservation
    })
  }
}
