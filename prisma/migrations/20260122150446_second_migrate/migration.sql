-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "avatar" TEXT,
ADD COLUMN     "isGroup" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "ownerId" TEXT;
