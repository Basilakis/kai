export interface Request {
  body: any;
  query: any;
  params: any;
  headers: Record<string, string | string[] | undefined>;
}

export interface Response {
  status: (code: number) => Response;
  json: (data: any) => void;
  send: (data: any) => void;
  end: () => void;
  setHeader: (name: string, value: string | string[]) => void;
}

export interface NextFunction {
  (err?: any): void;
}

export interface RequestHandler {
  (req: Request, res: Response, next: NextFunction): void | Promise<void>;
}