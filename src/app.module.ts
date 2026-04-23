import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { DocumentsModule } from "./documents/documents.module";
import { ExpensesModule } from "./expenses/expenses.module";
import { LeasesModule } from "./leases/leases.module";
import { PaymentsModule } from "./payments/payments.module";
import { PrismaModule } from "./database/prisma/prisma.module";
import { PropertiesModule } from "./properties/properties.module";
import { ReportsModule } from "./reports/reports.module";
import { StorageModule } from "./storage/storage.module";
import { TenantsModule } from "./tenants/tenants.module";
import { UsersModule } from "./users/users.module";
import { WorkspaceModule } from "./workspace/workspace.module";
import { envSchema } from "./config/validation/env.schema";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (input) => envSchema.parse(input)
    }),
    PrismaModule,
    StorageModule,
    AuthModule,
    UsersModule,
    WorkspaceModule,
    PropertiesModule,
    TenantsModule,
    LeasesModule,
    PaymentsModule,
    ExpensesModule,
    DocumentsModule,
    ReportsModule,
    DashboardModule
  ]
})
export class AppModule {}
