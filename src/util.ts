import { ZodType } from "zod";

export type IsAny<T> = 0 extends (1 & T) ? true : false;

export type ZodOutput<T> = T extends ZodType<infer TOut> ? TOut : never;
