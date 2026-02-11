import { Module } from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { ReservationsController } from './reservations.controller';
import { ReservationExpirationWorker } from './reservation-expiration.worker';
import { PrismaService } from 'src/infra/database/prisma.service';
import { CacheModule } from 'src/infra/cache/cache.module';
import { MessagingModule } from 'src/infra/messaging/messaging.module';

@Module({
  imports: [CacheModule, MessagingModule],
  controllers: [ReservationsController],
  providers: [ReservationsService, ReservationExpirationWorker, PrismaService],
  exports: [ReservationExpirationWorker],
})
export class ReservationsModule {}
