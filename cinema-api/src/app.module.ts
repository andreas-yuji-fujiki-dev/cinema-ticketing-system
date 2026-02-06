import { Module } from '@nestjs/common'
import { PrismaService } from './infra/database/prisma.service'
import { ReservationsModule } from './modules/reservations/reservations.module'

@Module({
  providers: [PrismaService],
  exports: [PrismaService],
  imports: [ReservationsModule]
})
export class AppModule {}
