import { Module } from '@nestjs/common'
import { PrismaService } from './infra/database/prisma.service'
import { ReservationsModule } from './modules/reservations/reservations.module'

@Module({
  imports: [ReservationsModule],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
