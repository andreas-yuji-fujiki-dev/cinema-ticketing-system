import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { MessagingService } from './messaging.service'

@Injectable()
export class LoggingConsumer implements OnModuleInit {
  private readonly logger = new Logger(LoggingConsumer.name)

  constructor(private readonly messaging: MessagingService) {}

  onModuleInit() {
    const events = [
      'RESERVATION_CREATED',
      'RESERVATION_EXPIRED',
      'PAYMENT_CONFIRMED',
      'SEAT_RELEASED',
    ]

    this.messaging.registerConsumer('logging.queue', events, (payload) => {
      this.logger.log(`${JSON.stringify(payload)}`)
    })
  }
}
