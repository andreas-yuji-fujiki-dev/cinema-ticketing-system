import 'dotenv/config'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { ReservationExpirationWorker } from './modules/reservations/reservation-expiration.worker'

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule)
  const worker = app.get(ReservationExpirationWorker)

  console.log('Reservation expiration worker started')

  setInterval(async () => {
    await worker.run()
  }, 5000)
}

bootstrap()
