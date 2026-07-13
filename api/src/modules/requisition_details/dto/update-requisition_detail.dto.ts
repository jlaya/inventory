import { PartialType } from '@nestjs/mapped-types';
import { CreateRequisitionDetailDto } from './create-requisition_detail.dto';

export class UpdateRequisitionDetailDto extends PartialType(CreateRequisitionDetailDto) {}
