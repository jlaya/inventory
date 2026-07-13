import { PartialType } from '@nestjs/mapped-types';
import { CreateClosureLogDto } from './create-closure_log.dto';

export class UpdateClosureLogDto extends PartialType(CreateClosureLogDto) {}
