import { Controller, Get, Param } from '@nestjs/common';
import { SalesService } from './sales.service';

@Controller('users')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get(':id/sales')
  async getUserSales(@Param('id') userId: string) {
    return this.salesService.getUserSales(userId);
  }
}
