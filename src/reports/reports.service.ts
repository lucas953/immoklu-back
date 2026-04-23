import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, PropertyStatus, RentPaymentStatus, ReportFormat, ReportStatus, ReportType } from "@prisma/client";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { PrismaService } from "../database/prisma/prisma.service";
import { CreateReportDto } from "./dto/create-report.dto";
import { buildCsv } from "./exporters/csv/csv-exporter";
import { buildPdfDocument } from "./exporters/pdf/pdf-exporter";

function toNumber(value: { toString(): string } | string | number | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === "number") {
    return value;
  }

  return Number(value.toString());
}

function toMoney(value: number) {
  return value.toFixed(2);
}

function toMonthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatMonthLabel(monthKey: string) {
  const parts = monthKey.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const date = new Date(Date.UTC(year, month - 1, 1));
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
}

const financialReportSelect = Prisma.validator<Prisma.FinancialReportSelect>()({
  id: true,
  type: true,
  format: true,
  status: true,
  fromDate: true,
  toDate: true,
  baseCurrency: true,
  filters: true,
  fileName: true,
  generatedAt: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true
});

type FinancialReportRow = Prisma.FinancialReportGetPayload<{
  select: typeof financialReportSelect;
}>;

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: AuthenticatedUser, dto: CreateReportDto) {
    if (dto.toDate < dto.fromDate) {
      throw new BadRequestException("The report end date must be on or after the start date.");
    }

    const workspace = await this.getWorkspace(user.workspaceId);

    if (dto.propertyId) {
      const property = await this.prisma.property.findFirst({
        where: {
          id: dto.propertyId,
          workspaceId: user.workspaceId
        },
        select: { id: true }
      });

      if (!property) {
        throw new NotFoundException("Property not found.");
      }
    }

    const report = await this.prisma.financialReport.create({
      data: {
        workspaceId: user.workspaceId,
        type: dto.type,
        format: dto.format,
        status: ReportStatus.READY,
        fromDate: dto.fromDate,
        toDate: dto.toDate,
        baseCurrency: workspace.defaultCurrency,
        filters: dto.propertyId ? ({ propertyId: dto.propertyId } satisfies Prisma.JsonObject) : Prisma.JsonNull,
        fileName: this.buildFileName(dto),
        generatedAt: new Date()
      },
      select: financialReportSelect
    });

    return this.serializeReport(report);
  }

  async findAll(user: AuthenticatedUser) {
    const reports = await this.prisma.financialReport.findMany({
      where: {
        workspaceId: user.workspaceId
      },
      select: financialReportSelect,
      orderBy: [{ createdAt: "desc" }, { generatedAt: "desc" }]
    });

    return reports.map((report) => this.serializeReport(report));
  }

  async findOne(user: AuthenticatedUser, reportId: string) {
    const report = await this.getReport(user.workspaceId, reportId);
    return this.serializeReport(report);
  }

  async download(user: AuthenticatedUser, reportId: string) {
    const report = await this.getReport(user.workspaceId, reportId);
    const filters = this.parseFilters(report.filters);
    const reportParams: {
      type: ReportType;
      format: ReportFormat;
      fromDate: Date;
      toDate: Date;
      baseCurrency: string;
      propertyId?: string;
    } = {
      type: report.type,
      format: report.format,
      fromDate: report.fromDate,
      toDate: report.toDate,
      baseCurrency: report.baseCurrency
    };
    if (filters.propertyId) {
      reportParams.propertyId = filters.propertyId;
    }
    const content = await this.buildReportContent(user.workspaceId, reportParams);

    const fileNameParams: {
      type: ReportType;
      format: ReportFormat;
      fromDate: Date;
      toDate: Date;
      propertyId?: string;
    } = {
      type: report.type,
      format: report.format,
      fromDate: report.fromDate,
      toDate: report.toDate
    };
    if (filters.propertyId) {
      fileNameParams.propertyId = filters.propertyId;
    }
    return {
      fileName: report.fileName ?? this.buildFileName(fileNameParams),
      contentType: report.format === ReportFormat.CSV ? "text/csv; charset=utf-8" : "application/pdf",
      content
    };
  }

  private async buildReportContent(
    workspaceId: string,
    params: {
      type: ReportType;
      format: ReportFormat;
      fromDate: Date;
      toDate: Date;
      baseCurrency: string;
      propertyId?: string;
    }
  ) {
    switch (params.type) {
      case ReportType.INCOME:
        return this.buildIncomeReport(workspaceId, params);
      case ReportType.EXPENSE:
        return this.buildExpenseReport(workspaceId, params);
      case ReportType.PNL:
        return this.buildPnlReport(workspaceId, params);
      case ReportType.PORTFOLIO_SUMMARY:
        return this.buildPortfolioSummaryReport(workspaceId, params);
      default:
        throw new BadRequestException("Unsupported report type.");
    }
  }

  private async buildIncomeReport(
    workspaceId: string,
    params: {
      format: ReportFormat;
      fromDate: Date;
      toDate: Date;
      baseCurrency: string;
      propertyId?: string;
    }
  ) {
    const payments = await this.prisma.rentPayment.findMany({
      where: {
        workspaceId,
        dueDate: {
          gte: params.fromDate,
          lte: params.toDate
        },
        ...(params.propertyId ? { propertyId: params.propertyId } : {})
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        dueDate: true,
        paidDate: true,
        amountDue: true,
        amountPaid: true,
        currency: true,
        status: true,
        paymentMethod: true,
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
      }
    });

    const headers = [
      "Payment ID",
      "Property",
      "Tenant",
      "Due Date",
      "Paid Date",
      "Amount Due",
      "Amount Paid",
      "Currency",
      "Status",
      "Payment Method"
    ];
    const rows = payments.map((payment) => [
      payment.id,
      payment.property.name,
      payment.tenant.fullName,
      formatDate(payment.dueDate),
      payment.paidDate ? formatDate(payment.paidDate) : "",
      payment.amountDue.toString(),
      payment.amountPaid.toString(),
      payment.currency,
      payment.status,
      payment.paymentMethod ?? ""
    ]);

    if (params.format === ReportFormat.CSV) {
      return buildCsv(headers, rows);
    }

    return buildPdfDocument("Income Report", [
      {
        heading: `Period: ${formatDate(params.fromDate)} to ${formatDate(params.toDate)} (${params.baseCurrency})`,
        lines: rows.length
          ? rows.map((row) => `${row[1]} | ${row[2]} | due ${row[3]} | paid ${row[6]} ${row[7]} | ${row[8]}`)
          : ["No rent payments found for the selected range."]
      }
    ]);
  }

  private async buildExpenseReport(
    workspaceId: string,
    params: {
      format: ReportFormat;
      fromDate: Date;
      toDate: Date;
      baseCurrency: string;
      propertyId?: string;
    }
  ) {
    const expenses = await this.prisma.expense.findMany({
      where: {
        workspaceId,
        expenseDate: {
          gte: params.fromDate,
          lte: params.toDate
        },
        ...(params.propertyId ? { propertyId: params.propertyId } : {})
      },
      orderBy: [{ expenseDate: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        amount: true,
        currency: true,
        expenseDate: true,
        vendorPayee: true,
        property: {
          select: {
            name: true
          }
        },
        category: {
          select: {
            name: true
          }
        }
      }
    });

    const headers = ["Expense ID", "Property", "Category", "Date", "Vendor / Payee", "Amount", "Currency"];
    const rows = expenses.map((expense) => [
      expense.id,
      expense.property?.name ?? "Portfolio level",
      expense.category?.name ?? "Uncategorized",
      formatDate(expense.expenseDate),
      expense.vendorPayee ?? "",
      expense.amount.toString(),
      expense.currency
    ]);

    if (params.format === ReportFormat.CSV) {
      return buildCsv(headers, rows);
    }

    return buildPdfDocument("Expense Report", [
      {
        heading: `Period: ${formatDate(params.fromDate)} to ${formatDate(params.toDate)} (${params.baseCurrency})`,
        lines: rows.length
          ? rows.map((row) => `${row[1]} | ${row[2]} | ${row[3]} | ${row[5]} ${row[6]} | ${row[4] || "No vendor"}`)
          : ["No expenses found for the selected range."]
      }
    ]);
  }

  private async buildPnlReport(
    workspaceId: string,
    params: {
      format: ReportFormat;
      fromDate: Date;
      toDate: Date;
      baseCurrency: string;
      propertyId?: string;
    }
  ) {
    const [payments, expenses] = await Promise.all([
      this.prisma.rentPayment.findMany({
        where: {
          workspaceId,
          dueDate: {
            gte: params.fromDate,
            lte: params.toDate
          },
          ...(params.propertyId ? { propertyId: params.propertyId } : {})
        },
        select: {
          dueDate: true,
          amountPaid: true,
          baseAmountPaid: true,
          currency: true,
          status: true
        }
      }),
      this.prisma.expense.findMany({
        where: {
          workspaceId,
          expenseDate: {
            gte: params.fromDate,
            lte: params.toDate
          },
          ...(params.propertyId ? { propertyId: params.propertyId } : {})
        },
        select: {
          expenseDate: true,
          amount: true,
          baseAmount: true,
          currency: true
        }
      })
    ]);

    const months = new Map<string, { income: number; expenses: number }>();

    for (const payment of payments) {
      if (payment.status !== RentPaymentStatus.PAID && payment.status !== RentPaymentStatus.PARTIALLY_PAID) {
        continue;
      }

      const key = toMonthKey(payment.dueDate);
      const month = months.get(key) ?? { income: 0, expenses: 0 };
      month.income += payment.currency === params.baseCurrency ? toNumber(payment.amountPaid) : toNumber(payment.baseAmountPaid);
      months.set(key, month);
    }

    for (const expense of expenses) {
      const key = toMonthKey(expense.expenseDate);
      const month = months.get(key) ?? { income: 0, expenses: 0 };
      month.expenses += expense.currency === params.baseCurrency ? toNumber(expense.amount) : toNumber(expense.baseAmount);
      months.set(key, month);
    }

    const sortedMonths = Array.from(months.entries())
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([month, totals]) => ({
        month,
        label: formatMonthLabel(month),
        income: totals.income,
        expenses: totals.expenses,
        net: totals.income - totals.expenses
      }));

    const totalIncome = sortedMonths.reduce((sum, row) => sum + row.income, 0);
    const totalExpenses = sortedMonths.reduce((sum, row) => sum + row.expenses, 0);
    const totalNet = totalIncome - totalExpenses;

    if (params.format === ReportFormat.CSV) {
      return buildCsv(
        ["Month", "Income", "Expenses", "Net Cash Flow", "Currency"],
        sortedMonths.map((row) => [
          row.label,
          toMoney(row.income),
          toMoney(row.expenses),
          toMoney(row.net),
          params.baseCurrency
        ])
      );
    }

    return buildPdfDocument("P&L Report", [
      {
        heading: `Period: ${formatDate(params.fromDate)} to ${formatDate(params.toDate)} (${params.baseCurrency})`,
        lines: sortedMonths.length
          ? sortedMonths.map(
              (row) =>
                `${row.label} | income ${toMoney(row.income)} | expenses ${toMoney(row.expenses)} | net ${toMoney(row.net)}`
            )
          : ["No income or expenses found for the selected range."]
      },
      {
        heading: "Totals",
        lines: [
          `Income: ${toMoney(totalIncome)} ${params.baseCurrency}`,
          `Expenses: ${toMoney(totalExpenses)} ${params.baseCurrency}`,
          `Net Cash Flow: ${toMoney(totalNet)} ${params.baseCurrency}`
        ]
      }
    ]);
  }

  private async buildPortfolioSummaryReport(
    workspaceId: string,
    params: {
      format: ReportFormat;
      fromDate: Date;
      toDate: Date;
      baseCurrency: string;
      propertyId?: string;
    }
  ) {
    const [properties, payments, expenses, activeLeases] = await Promise.all([
      this.prisma.property.findMany({
        where: {
          workspaceId,
          status: PropertyStatus.ACTIVE,
          ...(params.propertyId ? { id: params.propertyId } : {})
        },
        orderBy: {
          name: "asc"
        },
        select: {
          id: true,
          name: true,
          currency: true,
          purchasePrice: true,
          purchasePriceBase: true,
          currentValue: true,
          currentValueBase: true
        }
      }),
      this.prisma.rentPayment.findMany({
        where: {
          workspaceId,
          dueDate: {
            gte: params.fromDate,
            lte: params.toDate
          },
          ...(params.propertyId ? { propertyId: params.propertyId } : {})
        },
        select: {
          propertyId: true,
          amountPaid: true,
          baseAmountPaid: true,
          currency: true,
          status: true
        }
      }),
      this.prisma.expense.findMany({
        where: {
          workspaceId,
          expenseDate: {
            gte: params.fromDate,
            lte: params.toDate
          },
          ...(params.propertyId ? { propertyId: params.propertyId } : {})
        },
        select: {
          propertyId: true,
          amount: true,
          baseAmount: true,
          currency: true
        }
      }),
      this.prisma.lease.findMany({
        where: {
          workspaceId,
          status: "ACTIVE",
          ...(params.propertyId ? { propertyId: params.propertyId } : {})
        },
        select: {
          propertyId: true
        }
      })
    ]);

    const incomeByProperty = new Map<string, number>();
    const expensesByProperty = new Map<string, number>();
    const occupiedPropertyIds = new Set(activeLeases.map((lease) => lease.propertyId));

    for (const payment of payments) {
      if (payment.status !== RentPaymentStatus.PAID && payment.status !== RentPaymentStatus.PARTIALLY_PAID) {
        continue;
      }

      const amount = payment.currency === params.baseCurrency ? toNumber(payment.amountPaid) : toNumber(payment.baseAmountPaid);
      incomeByProperty.set(payment.propertyId, (incomeByProperty.get(payment.propertyId) ?? 0) + amount);
    }

    for (const expense of expenses) {
      if (!expense.propertyId) {
        continue;
      }

      const amount = expense.currency === params.baseCurrency ? toNumber(expense.amount) : toNumber(expense.baseAmount);
      expensesByProperty.set(expense.propertyId, (expensesByProperty.get(expense.propertyId) ?? 0) + amount);
    }

    const rows = properties.map((property) => {
      const income = incomeByProperty.get(property.id) ?? 0;
      const expenseAmount = expensesByProperty.get(property.id) ?? 0;
      const net = income - expenseAmount;
      const portfolioValue =
        property.currency === params.baseCurrency
          ? toNumber(property.currentValue ?? property.purchasePrice)
          : toNumber(property.currentValueBase ?? property.purchasePriceBase);

      return {
        propertyName: property.name,
        occupancyStatus: occupiedPropertyIds.has(property.id) ? "OCCUPIED" : "VACANT",
        income,
        expenses: expenseAmount,
        net,
        portfolioValue
      };
    });

    if (params.format === ReportFormat.CSV) {
      return buildCsv(
        ["Property", "Occupancy", "Income", "Expenses", "Net Cash Flow", "Portfolio Value", "Currency"],
        rows.map((row) => [
          row.propertyName,
          row.occupancyStatus,
          toMoney(row.income),
          toMoney(row.expenses),
          toMoney(row.net),
          toMoney(row.portfolioValue),
          params.baseCurrency
        ])
      );
    }

    return buildPdfDocument("Portfolio Summary Report", [
      {
        heading: `Period: ${formatDate(params.fromDate)} to ${formatDate(params.toDate)} (${params.baseCurrency})`,
        lines: rows.length
          ? rows.map(
              (row) =>
                `${row.propertyName} | ${row.occupancyStatus} | net ${toMoney(row.net)} | value ${toMoney(row.portfolioValue)}`
            )
          : ["No active properties found for the selected range."]
      }
    ]);
  }

  private async getWorkspace(workspaceId: string) {
    return this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: {
        defaultCurrency: true
      }
    });
  }

  private async getReport(workspaceId: string, reportId: string) {
    const report = await this.prisma.financialReport.findFirst({
      where: {
        id: reportId,
        workspaceId
      },
      select: financialReportSelect
    });

    if (!report) {
      throw new NotFoundException("Report not found.");
    }

    return report;
  }

  private buildFileName(dto: {
    type: ReportType;
    format: ReportFormat;
    fromDate: Date;
    toDate: Date;
    propertyId?: string;
  }) {
    const propertySuffix = dto.propertyId ? "-property" : "";
    return `immoklu-${dto.type.toLowerCase()}${propertySuffix}-${formatDate(dto.fromDate)}-${formatDate(dto.toDate)}.${dto.format.toLowerCase()}`;
  }

  private parseFilters(filters: Prisma.JsonValue | null) {
    if (!filters || typeof filters !== "object" || Array.isArray(filters)) {
      return {};
    }

    const propertyId =
      "propertyId" in filters && typeof filters.propertyId === "string" ? filters.propertyId : undefined;

    return { propertyId };
  }

  private serializeReport(report: FinancialReportRow) {
    const filters = this.parseFilters(report.filters);

    return {
      id: report.id,
      type: report.type,
      format: report.format,
      status: report.status,
      fromDate: report.fromDate.toISOString(),
      toDate: report.toDate.toISOString(),
      baseCurrency: report.baseCurrency,
      propertyId: filters.propertyId ?? null,
      fileName: report.fileName,
      generatedAt: report.generatedAt?.toISOString() ?? null,
      expiresAt: report.expiresAt?.toISOString() ?? null,
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString()
    };
  }
}
