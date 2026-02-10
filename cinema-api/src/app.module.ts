import { Module } from '@nestjs/common'
import { PrismaService } from './infra/database/prisma.service'

import { ReservationsModule } from './modules/reservations/reservations.module'
import { PaymentsModule } from './modules/payments/payments.module'

@Module({
  imports: [ReservationsModule, PaymentsModule],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
