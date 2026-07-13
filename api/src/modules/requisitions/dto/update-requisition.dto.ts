import { PartialType } from '@nestjs/mapped-types';
import { CreateRequisitionDto } from './create-requisition.dto';

export class UpdateRequisitionDto extends PartialType(CreateRequisitionDto) {}
