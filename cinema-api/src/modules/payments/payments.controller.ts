import { Controller, Post, Body } from '@nestjs/common'
import { PaymentsService } from './payments.service'

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('confirm')
  async confirm(@Body() body: { reservationId: string }) {
    return this.paymentsService.confirmPayment(body.reservationId)
  }
}
