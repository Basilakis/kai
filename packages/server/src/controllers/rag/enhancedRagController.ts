import { Controller, Get, Post, Body, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AuthGuard } from '../../guards/auth.guard';
import { EnhancedRagService } from '../../services/rag/enhancedRagService';

@ApiTags('Enhanced RAG')
@Controller('api/rag')
export class EnhancedRagController {
  constructor(private readonly enhancedRagService: EnhancedRagService) {}

  @Post('query')
  @ApiOperation({ summary: 'Process a query with the enhanced RAG system' })
  @ApiResponse({ status: 200, description: 'Query processed successfully' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        textQuery: { type: 'string', nullable: true },
        imageData: { type: 'string', nullable: true },
        options: { type: 'object', nullable: true }
      }
    }
  })
  async processQuery(
    @Body('textQuery') textQuery?: string,
    @Body('imageData') imageData?: string,
    @Body('options') options?: any
  ) {
    return this.enhancedRagService.processQuery(textQuery, imageData, options);
  }

  @Post('feedback')
  @ApiOperation({ summary: 'Submit feedback for a RAG response' })
  @ApiResponse({ status: 200, description: 'Feedback submitted successfully' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        response: { type: 'object' },
        feedback: { type: 'object' }
      },
      required: ['query', 'response', 'feedback']
    }
  })
  async submitFeedback(
    @Body('query') query: string,
    @Body('response') response: any,
    @Body('feedback') feedback: any
  ) {
    return this.enhancedRagService.submitFeedback(query, response, feedback);
  }

  @Get('stats')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get statistics for the enhanced RAG system' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getSystemStats() {
    return this.enhancedRagService.getSystemStats();
  }

  @Post('admin/fine-tune')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Trigger fine-tuning for the enhanced RAG system' })
  @ApiResponse({ status: 200, description: 'Fine-tuning triggered successfully' })
  async triggerFineTuning() {
    // This would call a method to trigger fine-tuning
    // For now, we'll just return a success message
    return { success: true, message: 'Fine-tuning triggered' };
  }

  @Get('admin/models')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get models from the model registry' })
  @ApiResponse({ status: 200, description: 'Models retrieved successfully' })
  async getModels(@Query('type') type?: string) {
    // This would call a method to get models from the registry
    // For now, we'll just return a success message
    return { success: true, models: [] };
  }

  @Get('admin/ab-tests')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get A/B tests from the model registry' })
  @ApiResponse({ status: 200, description: 'A/B tests retrieved successfully' })
  async getABTests(@Query('status') status?: string) {
    // This would call a method to get A/B tests from the registry
    // For now, we'll just return a success message
    return { success: true, abTests: [] };
  }
}
