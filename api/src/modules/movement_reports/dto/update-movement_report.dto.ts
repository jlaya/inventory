import { PartialType } from '@nestjs/mapped-types';
import { CreateMovementReportDto } from './create-movement_report.dto';

export class UpdateMovementReportDto extends PartialType(CreateMovementReportDto) {}
