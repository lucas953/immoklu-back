import { Injectable } from "@nestjs/common";
import { LeaseStatus, PropertyStatus, RentPaymentStatus } from "@prisma/client";
import { PrismaService } from "../database/prisma/prisma.service";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";

const CASH_FLOW_MONTHS = 6;

type NumericValue = { toString(): string } | string | number | null | undefined;

function toNumber(value: NumericValue) {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === "number") {
    return value;
  }

  return Number(value.toString());
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toMoneyString(value: number) {
  return roundCurrency(value).toFixed(2);
}

function toPercent(value: number | null) {
  if (value === null) {
    return null;
  }

  return Math.round((value + Number.EPSILON) * 10) / 10;
}

function toMonthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function toMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
}

function getCashFlowMonths() {
  const months: Array<{ month: string; label: string }> = [];
  const today = new Date();
  const currentMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

  for (let offset = CASH_FLOW_MONTHS - 1; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth() - offset, 1));
    months.push({
      month: toMonthKey(date),
      label: toMonthLabel(date)
    });
  }

  return months;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(user: AuthenticatedUser) {
    const workspace = await this.getWorkspace(user.workspaceId);

    const [properties, activeLeasesCount, tenantsCount, payments, expenses] = await Promise.all([
      this.prisma.property.findMany({
        where: {
          workspaceId: user.workspaceId,
          status: PropertyStatus.ACTIVE
        },
        select: {
          id: true,
          currency: true,
          purchasePrice: true,
          purchasePriceBase: true,
          currentValue: true,
          currentValueBase: true
        }
      }),
      this.prisma.lease.count({
        where: {
          workspaceId: user.workspaceId,
          status: LeaseStatus.ACTIVE
        }
      }),
      this.prisma.tenant.count({
        where: {
          workspaceId: user.workspaceId,
          status: "ACTIVE"
        }
      }),
      this.prisma.rentPayment.findMany({
        where: {
          workspaceId: user.workspaceId
        },
        select: {
          currency: true,
          amountDue: true,
          amountPaid: true,
          baseAmountDue: true,
          baseAmountPaid: true,
          status: true
        }
      }),
      this.prisma.expense.findMany({
        where: {
          workspaceId: user.workspaceId
        },
        select: {
          currency: true,
          amount: true,
          baseAmount: true
        }
      })
    ]);

    const rentalIncome = payments.reduce((total, payment) => {
      if (payment.status !== RentPaymentStatus.PAID && payment.status !== RentPaymentStatus.PARTIALLY_PAID) {
        return total;
      }

      return total + this.getPaymentPaidAmountInBase(payment, workspace.defaultCurrency);
    }, 0);

    const totalExpenses = expenses.reduce((total, expense) => {
      return total + this.getExpenseAmountInBase(expense, workspace.defaultCurrency);
    }, 0);

    const overduePayments = payments.filter((payment) => payment.status === RentPaymentStatus.OVERDUE);
    const overdueAmount = overduePayments.reduce((total, payment) => {
      return total + this.getOutstandingPaymentAmountInBase(payment, workspace.defaultCurrency);
    }, 0);

    const occupiedPropertyIds = new Set(
      (
        await this.prisma.lease.findMany({
          where: {
            workspaceId: user.workspaceId,
            status: LeaseStatus.ACTIVE
          },
          select: {
            propertyId: true
          }
        })
      ).map((lease) => lease.propertyId)
    );

    const portfolioValue = properties.reduce((total, property) => {
      return total + this.getPropertyValueInBase(property, workspace.defaultCurrency);
    }, 0);

    const netCashFlow = rentalIncome - totalExpenses;
    const occupancyRate =
      properties.length === 0 ? 0 : toPercent((occupiedPropertyIds.size / properties.length) * 100) ?? 0;
    const portfolioProfitability = rentalIncome > 0 ? toPercent((netCashFlow / rentalIncome) * 100) : null;

    return {
      baseCurrency: workspace.defaultCurrency,
      rentalIncome: toMoneyString(rentalIncome),
      expenses: toMoneyString(totalExpenses),
      netCashFlow: toMoneyString(netCashFlow),
      occupancyRate,
      overduePaymentsCount: overduePayments.length,
      overdueAmount: toMoneyString(overdueAmount),
      portfolioValue: toMoneyString(portfolioValue),
      portfolioProfitability,
      propertiesCount: properties.length,
      activeLeasesCount,
      tenantsCount
    };
  }

  async cashFlow(user: AuthenticatedUser) {
    const workspace = await this.getWorkspace(user.workspaceId);

    const [payments, expenses] = await Promise.all([
      this.prisma.rentPayment.findMany({
        where: {
          workspaceId: user.workspaceId
        },
        select: {
          currency: true,
          amountPaid: true,
          baseAmountPaid: true,
          paidDate: true,
          dueDate: true,
          status: true
        }
      }),
      this.prisma.expense.findMany({
        where: {
          workspaceId: user.workspaceId
        },
        select: {
          currency: true,
          amount: true,
          baseAmount: true,
          expenseDate: true
        }
      })
    ]);

    const months = getCashFlowMonths();
    const points = new Map(
      months.map((month) => [
        month.month,
        {
          month: month.month,
          label: month.label,
          income: 0,
          expenses: 0
        }
      ])
    );

    for (const payment of payments) {
      if (payment.status !== RentPaymentStatus.PAID && payment.status !== RentPaymentStatus.PARTIALLY_PAID) {
        continue;
      }

      const sourceDate = payment.paidDate ?? payment.dueDate;
      const monthKey = toMonthKey(sourceDate);
      const point = points.get(monthKey);

      if (!point) {
        continue;
      }

      point.income += this.getPaymentPaidAmountInBase(payment, workspace.defaultCurrency);
    }

    for (const expense of expenses) {
      const monthKey = toMonthKey(expense.expenseDate);
      const point = points.get(monthKey);

      if (!point) {
        continue;
      }

      point.expenses += this.getExpenseAmountInBase(expense, workspace.defaultCurrency);
    }

    return {
      baseCurrency: workspace.defaultCurrency,
      points: Array.from(points.values()).map((point) => ({
        month: point.month,
        label: point.label,
        income: toMoneyString(point.income),
        expenses: toMoneyString(point.expenses),
        netCashFlow: toMoneyString(point.income - point.expenses)
      }))
    };
  }

  async profitability(user: AuthenticatedUser) {
    const workspace = await this.getWorkspace(user.workspaceId);

    const [properties, payments, expenses] = await Promise.all([
      this.prisma.property.findMany({
        where: {
          workspaceId: user.workspaceId,
          status: PropertyStatus.ACTIVE
        },
        select: {
          id: true,
          name: true,
          status: true,
          currency: true,
          purchasePrice: true,
          purchasePriceBase: true,
          currentValue: true,
          currentValueBase: true
        }
      }),
      this.prisma.rentPayment.findMany({
        where: {
          workspaceId: user.workspaceId
        },
        select: {
          propertyId: true,
          currency: true,
          amountPaid: true,
          baseAmountPaid: true,
          status: true
        }
      }),
      this.prisma.expense.findMany({
        where: {
          workspaceId: user.workspaceId
        },
        select: {
          propertyId: true,
          currency: true,
          amount: true,
          baseAmount: true
        }
      })
    ]);

    const incomeByProperty = new Map<string, number>();
    const expensesByProperty = new Map<string, number>();
    let portfolioIncome = 0;
    let portfolioExpenses = 0;
    let unassignedExpenses = 0;
    let portfolioValue = 0;

    for (const payment of payments) {
      if (payment.status !== RentPaymentStatus.PAID && payment.status !== RentPaymentStatus.PARTIALLY_PAID) {
        continue;
      }

      const amount = this.getPaymentPaidAmountInBase(payment, workspace.defaultCurrency);
      portfolioIncome += amount;
      incomeByProperty.set(payment.propertyId, (incomeByProperty.get(payment.propertyId) ?? 0) + amount);
    }

    for (const expense of expenses) {
      const amount = this.getExpenseAmountInBase(expense, workspace.defaultCurrency);
      portfolioExpenses += amount;

      if (!expense.propertyId) {
        unassignedExpenses += amount;
        continue;
      }

      expensesByProperty.set(expense.propertyId, (expensesByProperty.get(expense.propertyId) ?? 0) + amount);
    }

    const propertyRows = properties
      .map((property) => {
        const income = incomeByProperty.get(property.id) ?? 0;
        const propertyExpenses = expensesByProperty.get(property.id) ?? 0;
        const netCashFlow = income - propertyExpenses;
        const profitability = income > 0 ? toPercent((netCashFlow / income) * 100) : null;
        const propertyValue = this.getPropertyValueInBase(property, workspace.defaultCurrency);

        portfolioValue += propertyValue;

        return {
          propertyId: property.id,
          propertyName: property.name,
          status: property.status,
          income: toMoneyString(income),
          expenses: toMoneyString(propertyExpenses),
          netCashFlow: toMoneyString(netCashFlow),
          portfolioValue: toMoneyString(propertyValue),
          profitability
        };
      })
      .sort((left, right) => Number(right.netCashFlow) - Number(left.netCashFlow));

    const portfolioNetCashFlow = portfolioIncome - portfolioExpenses;

    return {
      baseCurrency: workspace.defaultCurrency,
      portfolioIncome: toMoneyString(portfolioIncome),
      portfolioExpenses: toMoneyString(portfolioExpenses),
      portfolioNetCashFlow: toMoneyString(portfolioNetCashFlow),
      portfolioProfitability: portfolioIncome > 0 ? toPercent((portfolioNetCashFlow / portfolioIncome) * 100) : null,
      portfolioValue: toMoneyString(portfolioValue),
      unassignedExpenses: toMoneyString(unassignedExpenses),
      properties: propertyRows
    };
  }

  async occupancy(user: AuthenticatedUser) {
    const [properties, activeLeases] = await Promise.all([
      this.prisma.property.findMany({
        where: {
          workspaceId: user.workspaceId,
          status: PropertyStatus.ACTIVE
        },
        select: {
          id: true,
          name: true
        },
        orderBy: {
          name: "asc"
        }
      }),
      this.prisma.lease.findMany({
        where: {
          workspaceId: user.workspaceId,
          status: LeaseStatus.ACTIVE
        },
        select: {
          propertyId: true,
          tenant: {
            select: {
              fullName: true
            }
          }
        }
      })
    ]);

    const activeLeaseByProperty = new Map<string, string>();

    for (const lease of activeLeases) {
      if (!activeLeaseByProperty.has(lease.propertyId)) {
        activeLeaseByProperty.set(lease.propertyId, lease.tenant.fullName);
      }
    }

    const propertyRows = properties.map((property) => ({
      propertyId: property.id,
      propertyName: property.name,
      occupancyStatus: activeLeaseByProperty.has(property.id) ? ("OCCUPIED" as const) : ("VACANT" as const),
      currentTenantName: activeLeaseByProperty.get(property.id) ?? null
    }));

    const occupiedProperties = propertyRows.filter((property) => property.occupancyStatus === "OCCUPIED").length;
    const totalActiveProperties = propertyRows.length;

    return {
      occupiedProperties,
      vacantProperties: totalActiveProperties - occupiedProperties,
      totalActiveProperties,
      occupancyRate:
        totalActiveProperties === 0 ? 0 : toPercent((occupiedProperties / totalActiveProperties) * 100) ?? 0,
      properties: propertyRows
    };
  }

  async overduePayments(user: AuthenticatedUser) {
    const workspace = await this.getWorkspace(user.workspaceId);

    const payments = await this.prisma.rentPayment.findMany({
      where: {
        workspaceId: user.workspaceId,
        status: RentPaymentStatus.OVERDUE
      },
      select: {
        id: true,
        currency: true,
        amountDue: true,
        amountPaid: true,
        baseAmountDue: true,
        baseAmountPaid: true,
        dueDate: true,
        notes: true,
        property: {
          select: {
            name: true
          }
        },
        tenant: {
          select: {
            fullName: true
          }
        }
      },
      orderBy: {
        dueDate: "asc"
      }
    });

    const totalOutstanding = payments.reduce((total, payment) => {
      return total + this.getOutstandingPaymentAmountInBase(payment, workspace.defaultCurrency);
    }, 0);

    return {
      baseCurrency: workspace.defaultCurrency,
      count: payments.length,
      totalOutstanding: toMoneyString(totalOutstanding),
      payments: payments.map((payment) => ({
        paymentId: payment.id,
        propertyName: payment.property.name,
        tenantName: payment.tenant.fullName,
        dueDate: payment.dueDate.toISOString(),
        amountDue: payment.amountDue.toString(),
        amountPaid: payment.amountPaid.toString(),
        outstandingAmount: toMoneyString(
          Math.max(toNumber(payment.amountDue) - toNumber(payment.amountPaid), 0)
        ),
        currency: payment.currency,
        notes: payment.notes
      }))
    };
  }

  private async getWorkspace(workspaceId: string) {
    return this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: {
        defaultCurrency: true
      }
    });
  }

  private getPaymentPaidAmountInBase(
    payment: {
      currency: string;
      amountPaid: NumericValue;
      baseAmountPaid?: NumericValue;
    },
    baseCurrency: string
  ) {
    return payment.currency === baseCurrency ? toNumber(payment.amountPaid) : toNumber(payment.baseAmountPaid);
  }

  private getPaymentDueAmountInBase(
    payment: {
      currency: string;
      amountDue: NumericValue;
      baseAmountDue?: NumericValue;
    },
    baseCurrency: string
  ) {
    return payment.currency === baseCurrency ? toNumber(payment.amountDue) : toNumber(payment.baseAmountDue);
  }

  private getOutstandingPaymentAmountInBase(
    payment: {
      currency: string;
      amountDue: NumericValue;
      amountPaid: NumericValue;
      baseAmountDue?: NumericValue;
      baseAmountPaid?: NumericValue;
    },
    baseCurrency: string
  ) {
    return Math.max(
      this.getPaymentDueAmountInBase(payment, baseCurrency) -
        this.getPaymentPaidAmountInBase(payment, baseCurrency),
      0
    );
  }

  private getExpenseAmountInBase(
    expense: {
      currency: string;
      amount: NumericValue;
      baseAmount?: NumericValue;
    },
    baseCurrency: string
  ) {
    return expense.currency === baseCurrency ? toNumber(expense.amount) : toNumber(expense.baseAmount);
  }

  private getPropertyValueInBase(
    property: {
      currency: string;
      purchasePrice: NumericValue;
      purchasePriceBase?: NumericValue;
      currentValue: NumericValue;
      currentValueBase?: NumericValue;
    },
    baseCurrency: string
  ) {
    if (property.currency === baseCurrency) {
      return toNumber(property.currentValue ?? property.purchasePrice);
    }

    return toNumber(property.currentValueBase ?? property.purchasePriceBase);
  }
}
