import { Module } from '@nestjs/common'
import { ReservationsService } from './reservations.service'
import { ReservationsController } from './reservations.controller'
import { ReservationExpirationWorker } from './reservation-expiration.worker'
import { PrismaService } from 'src/infra/database/prisma.service'
import { CacheModule } from 'src/infra/cache/cache.module'

@Module({
  imports: [CacheModule],
  controllers: [ReservationsController],
  providers: [
    ReservationsService,
    ReservationExpirationWorker,
    PrismaService,
  ],
  exports: [ReservationExpirationWorker],
})
export class ReservationsModule {}
