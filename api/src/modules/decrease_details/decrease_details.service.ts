import { Injectable } from '@nestjs/common';
import { CreateDecreaseDetailDto } from './dto/create-decrease_detail.dto';
import { UpdateDecreaseDetailDto } from './dto/update-decrease_detail.dto';

@Injectable()
export class DecreaseDetailsService {
  create(createDecreaseDetailDto: CreateDecreaseDetailDto) {
    return 'This action adds a new decreaseDetail';
  }

  findAll() {
    return `This action returns all decreaseDetails`;
  }

  findOne(id: number) {
    return `This action returns a #${id} decreaseDetail`;
  }

  update(id: number, updateDecreaseDetailDto: UpdateDecreaseDetailDto) {
    return `This action updates a #${id} decreaseDetail`;
  }

  remove(id: number) {
    return `This action removes a #${id} decreaseDetail`;
  }
}
