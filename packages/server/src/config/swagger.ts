/**
 * Swagger Configuration
 * 
 * This file configures the Swagger/OpenAPI documentation for the API.
 * It defines information about the API, available servers, security schemes,
 * and paths to scan for JSDoc annotations.
 */

import swaggerJsdoc from 'swagger-jsdoc';
import { Options } from 'swagger-jsdoc';

const options: Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Kai API Documentation',
      version: '1.0.0',
      description: 'API documentation for the Kai backend services',
      license: {
        name: 'Private',
        url: 'https://yourcompany.com',
      },
      contact: {
        name: 'API Support',
        url: 'https://yourcompany.com/support',
        email: 'support@yourcompany.com',
      },
    },
    servers: [
      {
        url: '/api',
        description: 'Development server',
      },
      {
        url: 'https://api.yourcompany.com/api',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT Bearer token',
        },
      },
      schemas: {
        Material: {
          type: 'object',
          required: ['name', 'materialType'],
          properties: {
            id: {
              type: 'string',
              description: 'Unique identifier for the material',
              example: '5f8c7d5e9b8f7e6d5c4b3a2b'
            },
            name: {
              type: 'string',
              description: 'Name of the material',
              example: 'Italian Marble'
            },
            materialType: {
              type: 'string',
              description: 'Type of material',
              enum: ['wood', 'metal', 'stone', 'fabric', 'plastic', 'ceramic', 'glass', 'composite', 'other'],
              example: 'stone'
            },
            description: {
              type: 'string',
              description: 'Detailed description of the material',
              example: 'High-quality Italian Carrara marble with distinctive veining patterns'
            },
            manufacturer: {
              type: 'string',
              description: 'Name of the manufacturer',
              example: 'Carrara Marbles Ltd.'
            },
            color: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  example: 'White'
                },
                hex: {
                  type: 'string',
                  example: '#F5F5F5'
                },
                rgb: {
                  type: 'array',
                  items: {
                    type: 'integer'
                  },
                  example: [245, 245, 245]
                }
              }
            },
            finish: {
              type: 'string',
              enum: ['polished', 'matte', 'glossy', 'textured', 'brushed', 'honed', 'satin', 'other'],
              example: 'polished'
            },
            dimensions: {
              type: 'object',
              properties: {
                length: {
                  type: 'number',
                  example: 120
                },
                width: {
                  type: 'number',
                  example: 60
                },
                height: {
                  type: 'number',
                  example: 2
                },
                unit: {
                  type: 'string',
                  enum: ['mm', 'cm', 'in', 'ft', 'm'],
                  example: 'cm'
                }
              }
            },
            imageUrl: {
              type: 'string',
              format: 'uri',
              description: 'URL to the primary image of the material',
              example: 'https://storage.yourdomain.com/materials/italian-marble-123.jpg'
            },
            thumbnailUrl: {
              type: 'string',
              format: 'uri',
              description: 'URL to the thumbnail image',
              example: 'https://storage.yourdomain.com/materials/thumbnails/italian-marble-123.jpg'
            },
            price: {
              type: 'object',
              properties: {
                value: {
                  type: 'number',
                  example: 129.99
                },
                currency: {
                  type: 'string',
                  example: 'USD'
                },
                unit: {
                  type: 'string',
                  example: 'sqm'
                }
              }
            },
            tags: {
              type: 'array',
              items: {
                type: 'string'
              },
              example: ['premium', 'natural', 'italian', 'marble']
            },
            features: {
              type: 'array',
              items: {
                type: 'string'
              },
              example: ['stain-resistant', 'waterproof', 'heat-resistant']
            },
            metadata: {
              type: 'object',
              additionalProperties: true,
              description: 'Additional metadata properties specific to the material type',
              example: {
                hardness: 3.5,
                porosity: 'low',
                mineralContent: 'calcite, dolomite'
              }
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Date and time when the material was created',
              example: '2023-01-15T08:30:00Z'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Date and time when the material was last updated',
              example: '2023-02-20T14:15:30Z'
            },
            createdBy: {
              type: 'string',
              description: 'User ID who created the material',
              example: 'user_12345'
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              type: 'string',
              example: 'Material not found'
            },
            code: {
              type: 'integer',
              example: 404
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2023-05-10T12:15:30Z'
            }
          }
        },
        Pagination: {
          type: 'object',
          properties: {
            currentPage: {
              type: 'integer',
              example: 1
            },
            totalPages: {
              type: 'integer',
              example: 5
            },
            limit: {
              type: 'integer',
              example: 10
            },
            total: {
              type: 'integer',
              example: 47
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: [
      {
        name: 'Auth',
        description: 'Authentication and authorization operations',
      },
      {
        name: 'Materials',
        description: 'Material management operations',
      },
      {
        name: 'Catalogs',
        description: 'Catalog management operations',
      },
      {
        name: 'Recognition',
        description: 'Material recognition operations',
      },
      {
        name: 'Admin',
        description: 'Administrative operations',
      },
      {
        name: 'Search',
        description: 'Search operations',
      },
      {
        name: 'Agents',
        description: 'AI agent operations',
      },
      {
        name: 'PDF',
        description: 'PDF processing operations',
      },
      {
        name: 'Crawler',
        description: 'Web crawling operations',
      },
    ],
  },
  // Paths to files containing OpenAPI annotations
  apis: [
    'src/routes/*.ts',
    'src/routes/**/*.ts',
    'src/controllers/*.ts',
    'src/controllers/**/*.ts',
    'src/models/*.ts',
  ],
};

// Initialize swagger-jsdoc
const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;