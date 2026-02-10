import { Injectable } from '@nestjs/common'
import { PrismaService } from 'src/infra/database/prisma.service'

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserSales(userId: string) {
    const sales = await this.prisma.sale.findMany({
      where: { userId },
      include: {
        session: true,
        seats: {
          include: {
            seat: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return {
      userId,
      total: sales.length,
      sales,
    }
  }
}
