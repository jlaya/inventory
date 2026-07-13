import { PartialType } from '@nestjs/mapped-types';
import { CreateDecreaseDto } from './create-decrease.dto';

export class UpdateDecreaseDto extends PartialType(CreateDecreaseDto) {}
