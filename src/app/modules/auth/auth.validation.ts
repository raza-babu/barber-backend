import { fcm } from "googleapis/build/src/apis/fcm";
import z from "zod";
const loginUser = z.object({
  body: z.object({
    email: z
      .string({
        required_error: "Email is required!",
      })
      .email({
        message: "Invalid email format!",
      }),
    password: z.string({
      required_error: "Password is required!",
    }),
    fcmToken: z.string().optional(),
  
  }),
});

export const authValidation = { loginUser };
