import { Module } from '@nestjs/common';
import { PrismaService } from './infra/database/prisma.service';

import { ReservationsModule } from './modules/reservations/reservations.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { SalesModule } from './modules/sales/sales.module';

@Module({
  imports: [ReservationsModule, PaymentsModule, SessionsModule, SalesModule],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
