import { PartialType } from '@nestjs/mapped-types';
import { CreateDecreaseDetailDto } from './create-decrease_detail.dto';

export class UpdateDecreaseDetailDto extends PartialType(CreateDecreaseDetailDto) {}
