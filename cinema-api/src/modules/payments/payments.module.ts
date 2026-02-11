import { Module } from '@nestjs/common'
import { PaymentsService } from './payments.service'
import { PaymentsController } from './payments.controller'
import { PrismaService } from 'src/infra/database/prisma.service'
import { CacheModule } from 'src/infra/cache/cache.module'
import { MessagingModule } from 'src/infra/messaging/messaging.module'

@Module({
  imports: [CacheModule, MessagingModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PrismaService],
})
export class PaymentsModule {}
