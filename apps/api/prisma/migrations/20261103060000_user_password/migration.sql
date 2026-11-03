-- Пароль для входа сотрудников платформы (без OTP). docs/27
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;
