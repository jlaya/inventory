import { Injectable } from '@nestjs/common';
import { CreateStockMovementDto } from './dto/create-stock_movement.dto';
import { UpdateStockMovementDto } from './dto/update-stock_movement.dto';

@Injectable()
export class StockMovementsService {
  create(createStockMovementDto: CreateStockMovementDto) {
    return 'This action adds a new stockMovement';
  }

  findAll() {
    return `This action returns all stockMovements`;
  }

  findOne(id: number) {
    return `This action returns a #${id} stockMovement`;
  }

  update(id: number, updateStockMovementDto: UpdateStockMovementDto) {
    return `This action updates a #${id} stockMovement`;
  }

  remove(id: number) {
    return `This action removes a #${id} stockMovement`;
  }
}
