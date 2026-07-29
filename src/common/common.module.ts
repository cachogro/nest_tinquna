import { Module } from '@nestjs/common';
import { CommonService } from './service/common.service';
import { CommonController } from './controller/common.controller';
import { ExcelService } from './excel/excel.service';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  controllers: [CommonController],
  providers: [CommonService, ExcelService],
  exports: [
    //TypeOrmModule,
    ExcelService
  ],
})
export class CommonModule {}
