import { Body, Controller, Get, Param, Post, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { CreateReportDto } from "./dto/create-report.dto";
import { ReportsService } from "./reports.service";

@UseGuards(JwtAuthGuard)
@Controller("reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateReportDto) {
    return this.reportsService.create(user, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.findAll(user);
  }

  @Get(":reportId")
  findOne(@CurrentUser() user: AuthenticatedUser, @Param("reportId") reportId: string) {
    return this.reportsService.findOne(user, reportId);
  }

  @Get(":reportId/download")
  async download(
    @CurrentUser() user: AuthenticatedUser,
    @Param("reportId") reportId: string,
    @Res() response: Response
  ) {
    const file = await this.reportsService.download(user, reportId);

    response.setHeader("Content-Type", file.contentType);
    response.setHeader("Content-Disposition", `attachment; filename="${file.fileName}"`);
    response.send(file.content);
  }
}
