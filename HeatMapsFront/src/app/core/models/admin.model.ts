export interface Admin {
  id: number;
  username: string;
  email: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  admin: Admin;
  token: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface RegisterResponse {
  message: string;
  verificationRequired: boolean;
}

export interface VerifyCodeResponse {
  admin: Admin;
  token: string;
}

export interface VerifyCodeErrorResponse {
  message: string;
  attemptsLeft: number;
  statusCode: number;
}

export interface SessionResponse {
  admin: Admin;
  isValid: boolean;
}

export interface AllowedEmail {
  id: number;
  email: string;
  addedBy: string;
  createdAt: string;
}
