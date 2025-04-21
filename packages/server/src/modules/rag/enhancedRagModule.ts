import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EnhancedRagController } from '../../controllers/rag/enhancedRagController';
import { EnhancedRagService } from '../../services/rag/enhancedRagService';

@Module({
  imports: [ConfigModule],
  controllers: [EnhancedRagController],
  providers: [EnhancedRagService],
  exports: [EnhancedRagService]
})
export class EnhancedRagModule {}
