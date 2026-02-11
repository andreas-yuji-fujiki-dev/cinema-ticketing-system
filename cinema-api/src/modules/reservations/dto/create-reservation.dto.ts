import { IsArray, IsUUID, ArrayMinSize } from 'class-validator';

export class CreateReservationDto {
  @IsUUID()
  sessionId: string;

  @IsUUID()
  userId: string;

  @IsArray()
  @ArrayMinSize(1)
  seatIds: string[];
}
