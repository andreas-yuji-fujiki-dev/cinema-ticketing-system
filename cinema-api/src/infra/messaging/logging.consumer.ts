import { Injectable, OnModuleInit } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { getLogger } from 'src/infra/logging/logger';

@Injectable()
export class LoggingConsumer implements OnModuleInit {
  private readonly logger = getLogger(LoggingConsumer.name);

  constructor(private readonly messaging: MessagingService) {}

  onModuleInit() {
    const events = [
      'RESERVATION_CREATED',
      'RESERVATION_EXPIRED',
      'PAYMENT_CONFIRMED',
      'SEAT_RELEASED',
    ];

    void this.messaging.registerConsumer('logging.queue', events, payload => {
      this.logger.info('event', { payload });
    });
  }
}
