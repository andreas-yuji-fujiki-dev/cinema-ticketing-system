import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getLogger } from './infra/logging/logger';

const logger = getLogger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const port = process.env.API_PORT || 3000;
  await app.listen(port);

  logger.info('API running', { url: `http://localhost:${port}` });
}

void bootstrap();
