import { PartialType } from '@nestjs/mapped-types';
import { CreateInventoryReportDto } from './create-inventory_report.dto';

export class UpdateInventoryReportDto extends PartialType(CreateInventoryReportDto) {}
