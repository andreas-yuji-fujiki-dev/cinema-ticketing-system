import { Module } from '@nestjs/common';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { PrismaService } from 'src/infra/database/prisma.service';
import { CacheModule } from 'src/infra/cache/cache.module';

@Module({
  imports: [CacheModule],
  controllers: [SessionsController],
  providers: [SessionsService, PrismaService],
})
export class SessionsModule {}
