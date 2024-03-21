/*
  Warnings:

  - You are about to drop the `Burn` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Burn";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "User";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "Token" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "burned" BOOLEAN NOT NULL,
    "minted" BOOLEAN NOT NULL,
    "originChain" INTEGER NOT NULL,
    "destinationChain" INTEGER NOT NULL,
    "originBlockNumber" INTEGER,
    "burnTimestamp" DATETIME,
    "burnEVMTransactionHash" TEXT,
    "mintEVMTransactionHash" TEXT,
    "burnStarkTransaction_id" INTEGER,
    "mintStarkTransaction_id" INTEGER,
    "originCollectionAddress" TEXT NOT NULL,
    "destinationCollectionAddress" TEXT NOT NULL,
    "originTokenId" INTEGER NOT NULL,
    "destinationTokenId" INTEGER NOT NULL,
    "fromOriginWalletAddress" TEXT NOT NULL,
    "toOriginWalletAddress" TEXT,
    "toDestinationWalletAddress" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "AddressMapping" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "originChain" INTEGER NOT NULL,
    "destinationChain" INTEGER NOT NULL,
    "originWalletAddress" TEXT NOT NULL,
    "destinationWalletAddress" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Token_originTokenId_key" ON "Token"("originTokenId");

-- CreateIndex
CREATE UNIQUE INDEX "Token_destinationTokenId_key" ON "Token"("destinationTokenId");
