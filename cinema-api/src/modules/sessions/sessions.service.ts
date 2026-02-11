import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/infra/database/prisma.service';
import { RedisService } from 'src/infra/cache/redis.service';

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService
  ) {}

  async getSeatsAvailability(sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { seats: true },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    const seatsWithAvailability = await Promise.all(
      session.seats.map(async seat => {
        const lockKey = `lock:session:${sessionId}:seat:${seat.id}`;
        const isLocked = await this.redis.exists(lockKey);

        const isSold = await this.prisma.saleSeat.findUnique({
          where: { seatId: seat.id },
        });

        return {
          seatId: seat.id,
          seatNumber: seat.number,
          status: isSold ? 'SOLD' : isLocked ? 'RESERVED' : 'AVAILABLE',
        };
      })
    );

    return {
      sessionId,
      seats: seatsWithAvailability,
    };
  }
}
