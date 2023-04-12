/*
  Warnings:

  - You are about to drop the column `blockTimestamp` on the `Burn` table. All the data in the column will be lost.
  - You are about to drop the column `txHash` on the `Burn` table. All the data in the column will be lost.
  - You are about to alter the column `blockNumber` on the `Burn` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.
  - You are about to alter the column `tokenId` on the `Burn` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.
  - Added the required column `timestamp` to the `Burn` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Burn" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "minted" INTEGER NOT NULL,
    "chain" INTEGER NOT NULL,
    "blockNumber" INTEGER,
    "timestamp" DATETIME NOT NULL,
    "transactionHash" TEXT,
    "transaction_id" INTEGER,
    "tokenAddress" TEXT NOT NULL,
    "tokenId" INTEGER NOT NULL,
    "fromAddress" TEXT,
    "toAddress" TEXT NOT NULL
);
INSERT INTO "new_Burn" ("blockNumber", "chain", "fromAddress", "id", "minted", "toAddress", "tokenAddress", "tokenId") SELECT "blockNumber", "chain", "fromAddress", "id", "minted", "toAddress", "tokenAddress", "tokenId" FROM "Burn";
DROP TABLE "Burn";
ALTER TABLE "new_Burn" RENAME TO "Burn";
CREATE UNIQUE INDEX "Burn_tokenId_key" ON "Burn"("tokenId");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
