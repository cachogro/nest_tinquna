import { Module } from '@nestjs/common';
import { CommonService } from './service/common.service';
import { CommonController } from './controller/common.controller';

@Module({
  controllers: [CommonController],
  providers: [CommonService],
})
export class CommonModule {}
