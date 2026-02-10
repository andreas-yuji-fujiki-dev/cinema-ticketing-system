/*
  Warnings:

  - A unique constraint covering the columns `[seatId]` on the table `SaleSeat` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "SaleSeat_seatId_key" ON "SaleSeat"("seatId");
