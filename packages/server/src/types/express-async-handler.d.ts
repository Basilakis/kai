declare module 'express-async-handler' {
  import { Request, Response, NextFunction, RequestHandler } from 'express';
  
  function expressAsyncHandler(handler: (req: Request, res: Response, next: NextFunction) => Promise<any>): RequestHandler;
  
  export default expressAsyncHandler;
}