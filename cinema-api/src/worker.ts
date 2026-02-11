import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ReservationExpirationWorker } from './modules/reservations/reservation-expiration.worker';
import { getLogger } from './infra/logging/logger';

const logger = getLogger('Worker');

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const worker = app.get(ReservationExpirationWorker);

  logger.info('Reservation expiration worker started');

  setInterval(() => {
    void worker.run();
  }, 5000);
}

void bootstrap();
