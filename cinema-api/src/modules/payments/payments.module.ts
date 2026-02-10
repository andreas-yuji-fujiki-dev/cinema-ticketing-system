import { Module } from '@nestjs/common'
import { PaymentsService } from './payments.service'
import { PaymentsController } from './payments.controller'
import { PrismaService } from 'src/infra/database/prisma.service'
import { CacheModule } from 'src/infra/cache/cache.module'

@Module({
  imports: [CacheModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PrismaService],
})
export class PaymentsModule {}
