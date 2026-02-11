import { Injectable, BadRequestException } from '@nestjs/common';
import { getLogger } from 'src/infra/logging/logger';
import { PrismaService } from 'src/infra/database/prisma.service';
import { RedisService } from 'src/infra/cache/redis.service';
import { MessagingService } from 'src/infra/messaging/messaging.service';
import { ReservationStatus } from '@prisma/client';

@Injectable()
export class PaymentsService {
  private readonly logger = getLogger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly messaging: MessagingService
  ) {}

  async confirmPayment(reservationId: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { seats: { include: { seat: true } } },
    });

    if (!reservation) {
      throw new BadRequestException('Reservation not found');
    }

    if (reservation.status !== ReservationStatus.ACTIVE) {
      throw new BadRequestException('Reservation is not active');
    }

    if (reservation.expiresAt < new Date()) {
      throw new BadRequestException('Reservation expired');
    }

    // validating redis locks
    for (const rs of reservation.seats) {
      const lockKey = `lock:session:${reservation.sessionId}:seat:${rs.seatId}`;
      const exists = await this.redis.exists(lockKey);

      if (!exists) {
        throw new BadRequestException('Seat lock expired');
      }
    }

    // atomic transaction
    return this.prisma.$transaction(async tx => {
      const sale = await tx.sale.create({
        data: {
          userId: reservation.userId,
          sessionId: reservation.sessionId,
          seats: {
            create: reservation.seats.map(rs => ({
              seatId: rs.seatId,
            })),
          },
        },
      });

      await tx.reservation.update({
        where: { id: reservation.id },
        data: { status: ReservationStatus.CONFIRMED },
      });

      // remove locks
      for (const rs of reservation.seats) {
        const lockKey = `lock:session:${reservation.sessionId}:seat:${rs.seatId}`;
        await this.redis.del(lockKey);
      }

      // publish payment confirmed event
      try {
        void this.messaging.publish('PAYMENT_CONFIRMED', {
          reservationId: reservation.id,
          sessionId: reservation.sessionId,
          seatIds: reservation.seats.map(s => s.seatId),
        });
      } catch (err) {
        this.logger.error(`Failed publishing PAYMENT_CONFIRMED: ${err}`);
      }

      // publish seat released per-seat
      for (const rs of reservation.seats) {
        try {
          void this.messaging.publish('SEAT_RELEASED', {
            reservationId: reservation.id,
            sessionId: reservation.sessionId,
            seatId: rs.seatId,
          });
        } catch (err) {
          this.logger.error(`Failed publishing SEAT_RELEASED: ${err}`);
        }
      }

      return sale;
    });
  }
}
