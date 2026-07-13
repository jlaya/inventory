import { Injectable } from '@nestjs/common';
import { CreateRequisitionDetailDto } from './dto/create-requisition_detail.dto';
import { UpdateRequisitionDetailDto } from './dto/update-requisition_detail.dto';

@Injectable()
export class RequisitionDetailsService {
  create(createRequisitionDetailDto: CreateRequisitionDetailDto) {
    return 'This action adds a new requisitionDetail';
  }

  findAll() {
    return `This action returns all requisitionDetails`;
  }

  findOne(id: number) {
    return `This action returns a #${id} requisitionDetail`;
  }

  update(id: number, updateRequisitionDetailDto: UpdateRequisitionDetailDto) {
    return `This action updates a #${id} requisitionDetail`;
  }

  remove(id: number) {
    return `This action removes a #${id} requisitionDetail`;
  }
}
