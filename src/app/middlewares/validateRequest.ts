import { NextFunction, Request, Response } from "express";
import { AnyZodObject } from "zod";

const validateRequest =
  (schema: AnyZodObject) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Enforce strict schema to disallow extra fields
      // const strictSchema = schema.strict();
      // const parsedData = await strictSchema.parseAsync({
      //   body: req.body,
      // });
      const parsedData = await schema.parseAsync({
        body: req.body,
      });
      // req.body = strictSchema.parse(parsedData.body);
      // console.log("Parsed Data:", parsedData);
      req.body = parsedData.body;
      return next();
    } catch (err) {
      next(err);
    }
  };

export default validateRequest;