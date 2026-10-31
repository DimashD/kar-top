import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface RequestUser { userId: string; }

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): RequestUser | undefined => {
  return ctx.switchToHttp().getRequest().user;
});
