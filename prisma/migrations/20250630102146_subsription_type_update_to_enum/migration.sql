/*
  Warnings:

  - The `subscription_type` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "SubscriptionType" AS ENUM ('FREE', 'PRO');

-- AlterTable
ALTER TABLE "User" DROP COLUMN "subscription_type",
ADD COLUMN     "subscription_type" "SubscriptionType" NOT NULL DEFAULT 'FREE';
