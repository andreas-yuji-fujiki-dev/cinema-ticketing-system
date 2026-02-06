import { Module } from '@nestjs/common'
import { ReservationsController } from './reservations.controller'
import { ReservationsService } from './reservations.service'
import { PrismaService } from 'src/infra/database/prisma.service'

@Module({
  controllers: [ReservationsController],
  providers: [ReservationsService, PrismaService],
})
export class ReservationsModule {}
