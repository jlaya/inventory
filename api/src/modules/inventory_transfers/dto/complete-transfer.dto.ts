import { IsNotEmpty, IsNumber } from 'class-validator';

export class CompleteTransferDto {
  @IsNotEmpty()
  @IsNumber()
  userId: number;
}
