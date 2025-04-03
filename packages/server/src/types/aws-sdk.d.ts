declare module '@aws-sdk/client-s3' {
  export class S3Client {
    constructor(config: any);
    send(command: any): Promise<any>;
  }

  export class PutObjectCommand {
    constructor(input: {
      Bucket: string;
      Key: string;
      Body: Buffer | string;
      ContentType?: string;
      Metadata?: Record<string, string>;
      ACL?: string;
    });
  }

  export class GetObjectCommand {
    constructor(input: {
      Bucket: string;
      Key: string;
      Prefix?: string;
    });
  }

  export class DeleteObjectCommand {
    constructor(input: {
      Bucket: string;
      Key: string;
    });
  }

  export class ListObjectsCommand {
    constructor(input: {
      Bucket: string;
      Prefix?: string;
    });
  }
}

declare module '@aws-sdk/s3-request-presigner' {
  import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
  
  export function getSignedUrl(
    client: S3Client,
    command: GetObjectCommand,
    options?: { expiresIn?: number }
  ): Promise<string>;
}