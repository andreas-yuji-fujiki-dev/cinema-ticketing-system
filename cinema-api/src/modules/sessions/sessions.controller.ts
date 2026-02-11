import { Controller, Get, Param } from '@nestjs/common';
import { SessionsService } from './sessions.service';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get(':id/seats')
  async getSeatsAvailability(@Param('id') sessionId: string) {
    return this.sessionsService.getSeatsAvailability(sessionId);
  }
}
