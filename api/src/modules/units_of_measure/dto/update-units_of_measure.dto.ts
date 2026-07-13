import { PartialType } from '@nestjs/mapped-types';
import { CreateUnitsOfMeasureDto } from './create-units_of_measure.dto';

export class UpdateUnitsOfMeasureDto extends PartialType(CreateUnitsOfMeasureDto) {}
