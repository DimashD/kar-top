-- Привязка email к пользователю (OTP на почту, дешевле SMS). docs/20 §5
ALTER TABLE "User" ADD COLUMN "email" TEXT;
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
