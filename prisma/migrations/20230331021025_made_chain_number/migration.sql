-- CreateTable
CREATE TABLE "Burn" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "minted" INTEGER NOT NULL,
    "chain" INTEGER NOT NULL,
    "blockNumber" TEXT NOT NULL,
    "blockTimestamp" DATETIME NOT NULL,
    "txHash" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "fromAddress" TEXT,
    "toAddress" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "name" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "Burn_tokenId_key" ON "Burn"("tokenId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
