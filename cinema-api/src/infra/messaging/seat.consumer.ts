import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { MessagingService } from './messaging.service'
import { RedisService } from 'src/infra/cache/redis.service'

@Injectable()
export class SeatConsumer implements OnModuleInit {
  private readonly logger = new Logger(SeatConsumer.name)

  constructor(
    private readonly messaging: MessagingService,
    private readonly redis: RedisService,
  ) {}

  onModuleInit() {
    this.messaging.registerConsumer(
      'seat.queue',
      ['RESERVATION_EXPIRED'],
      async (payload) => {
        this.logger.log(`SeatConsumer received RESERVATION_EXPIRED: ${JSON.stringify(payload)}`)
        const { reservationId, sessionId, seatIds } = payload || {}
        if (!seatIds || !sessionId) return

        for (const seatId of seatIds) {
          const lockKey = `lock:session:${sessionId}:seat:${seatId}`
          try {
            await this.redis.del(lockKey)
            this.messaging.publish('SEAT_RELEASED', { reservationId, sessionId, seatId })
            this.logger.log(`Released lock ${lockKey} for reservation ${reservationId}`)
          } catch (err) {
            this.logger.error(`Failed releasing lock ${lockKey}: ${err}`)
          }
        }
      },
    )
  }
}
