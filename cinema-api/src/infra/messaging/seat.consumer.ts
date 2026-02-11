import { Injectable, OnModuleInit } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { RedisService } from 'src/infra/cache/redis.service';
import { getLogger } from 'src/infra/logging/logger';

@Injectable()
export class SeatConsumer implements OnModuleInit {
  private readonly logger = getLogger(SeatConsumer.name);

  constructor(
    private readonly messaging: MessagingService,
    private readonly redis: RedisService
  ) {}

  async onModuleInit() {
    await this.messaging.registerConsumer(
      'seat.queue',
      ['RESERVATION_EXPIRED'],
      async (payload: any) => {
        this.logger.info('SeatConsumer received RESERVATION_EXPIRED', { payload });
        const { reservationId, sessionId, seatIds } = payload || {};
        if (!seatIds || !sessionId) return;

        for (const seatId of seatIds) {
          const lockKey = `lock:session:${sessionId}:seat:${seatId}`;
          try {
            await this.redis.del(lockKey);
            void this.messaging.publish('SEAT_RELEASED', { reservationId, sessionId, seatId });
            this.logger.info('Released lock', { lockKey, reservationId });
          } catch (err) {
            this.logger.error(`Failed releasing lock ${lockKey}: ${err}`);
          }
        }
      }
    );
  }
}
