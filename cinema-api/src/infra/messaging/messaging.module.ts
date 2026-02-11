import { Module } from '@nestjs/common'
import { MessagingService } from './messaging.service'
import { LoggingConsumer } from './logging.consumer'
import { SeatConsumer } from './seat.consumer'
import { CacheModule } from 'src/infra/cache/cache.module'

@Module({
  imports: [CacheModule],
  providers: [MessagingService, LoggingConsumer, SeatConsumer],
  exports: [MessagingService],
})
export class MessagingModule {}
