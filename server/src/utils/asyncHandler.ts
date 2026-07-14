import { Request, Response, NextFunction, RequestHandler } from 'express';

// Express 4는 async 라우트 핸들러 안에서 발생한 Promise 거부를 자동으로 잡지 않는다.
// 이 래퍼로 감싸면 예외가 next(err)로 전달되어 index.ts의 전역 에러 미들웨어가 처리한다.
export function asyncHandler<T extends Request = Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    fn(req as T, res, next).catch(next);
  };
}
