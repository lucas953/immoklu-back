import { Controller, Get, Param, Post } from "@nestjs/common";
import { ReportsService } from "./reports.service";

@Controller({ path: "reports", version: "1" })
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  create() {
    return this.reportsService.create();
  }

  @Get()
  findAll() {
    return this.reportsService.findAll();
  }

  @Get(":reportId")
  findOne(@Param("reportId") reportId: string) {
    return this.reportsService.findOne(reportId);
  }

  @Get(":reportId/download")
  download(@Param("reportId") reportId: string) {
    return this.reportsService.download(reportId);
  }
}
