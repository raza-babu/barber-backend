import * as jwt from 'jsonwebtoken';
import type { Secret, SignOptions } from 'jsonwebtoken';

// ...existing code...
export const generateToken = (
  payload: {
    id: string;
    email: string;
    role: string;
    purpose: string;
    functions: string[];
    subscriptionPlan: string;
  },
  secret: Secret,
  expiresIn: SignOptions['expiresIn'], // use SignOptions type here
) => {
  const options: SignOptions = { algorithm: 'HS256', expiresIn };
  const token = jwt.sign(payload as object, secret as Secret, options);
  return token;
};

export const refreshToken = (
  payload: { id: string; email: string; role: string },
  secret: Secret,
  expiresIn: SignOptions['expiresIn'], // use SignOptions type here
) => {
  const options: SignOptions = { algorithm: 'HS256', expiresIn };
  const token = jwt.sign(payload as object, secret as Secret, options);
  return token;
};
